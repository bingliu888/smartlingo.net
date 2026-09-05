import { boundedJsonBody } from "@/lib/bounded-request-body";
import {
  classAccess,
  classByCode,
  recordClassJoin,
  verifyClassEntryPassword,
} from "@/lib/live-classrooms";
import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import {
  abandonDefiniteParticipantAttempt,
  attachCompanionParticipant,
  attachProviderParticipant,
  beginProviderParticipantAttempt,
  claimCompanionParticipant,
  classGuestCookieHeader,
  participantCapacity,
  releaseCompanionParticipant,
  requireParticipantSession,
  reserveParticipantSession,
  reservePublisher,
  revokeParticipantSession,
} from "@/lib/class-participant-session";
import { ensureClassProviderGeneration } from "@/lib/class-provider-lifecycle";
import { createProviderParticipant } from "@/lib/live-class-realtimekit";
import { bindVerifiedStageSpeakers } from "@/lib/class-managers";
import {
  approvedWebinarMediaAllowed,
  baseClassPublishAllowed,
  type ClassMediaKind,
} from "@/lib/class-publish-policy";
import {
  blockedClassPasswordAttempt,
  clearClassPasswordFailures,
  enforceClassJoinLimit,
  recordClassPasswordFailure,
} from "@/lib/class-request-protection";

type JoinBody = {
  displayName?: unknown;
  password?: unknown;
  identity?: unknown;
  publish?: unknown;
  start?: unknown;
  screenShareCompanion?: unknown;
  sessionToken?: unknown;
  mic?: unknown;
  camera?: unknown;
};

function joinFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "REALTIMEKIT_REQUEST_FAILED";
  if (code === "STREAMING_ROOM_FULL")
    return Response.json({ error: "Too many people in streaming", errorCode: code }, { status: 409 });
  if (code === "PUBLISHER_LIMIT_REACHED")
    return Response.json({ error: "The 9-speaker stage is full", errorCode: code }, { status: 409 });
  if (code === "PARTICIPANT_SESSION_LIMIT")
    return Response.json({ error: "This account or guest already has four active tabs", errorCode: code }, { status: 409 });
  if (code === "PARTICIPANT_SESSION_CONFLICT")
    return Response.json({ error: "This course tab was replaced by a newer connection", errorCode: code }, { status: 409 });
  if (code === "PARTICIPANT_SESSION_KICKED")
    return Response.json({ error: "A moderator removed this participant", errorCode: code }, { status: 403 });
  if (code === "CLASS_DELETION_PENDING")
    return Response.json({ error: "Course is no longer available", errorCode: code }, { status: 410 });
  if (code === "CLASS_PROVIDER_TEARDOWN_PENDING"
    || code === "CLASS_PROVIDER_CREATE_RECOVERY_PENDING"
    || code === "PARTICIPANT_SESSION_GENERATION_ENDED")
    return Response.json({ error: "The live room is resetting. Try again shortly.", errorCode: code }, {
      status: 503,
      headers: { "retry-after": "10", "cache-control": "no-store" },
    });
  console.error("Course room RealtimeKit join failed", code);
  return Response.json({ error: "Live media is temporarily unavailable", errorCode: "REALTIME_UPDATE_UNAVAILABLE" }, {
    status: 502,
    headers: { "cache-control": "no-store" },
  });
}

async function recoverableJoinFailure(error: unknown, rotatedSessionToken?: string) {
  const failure = joinFailure(error);
  if (!rotatedSessionToken) return failure;
  const payload = await failure.json().catch(() => ({})) as Record<string, unknown>;
  return Response.json({ ...payload, sessionToken: rotatedSessionToken }, {
    status: failure.status,
    headers: failure.headers,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  if (room.status !== "active")
    return Response.json({ error: "Course is no longer available" }, { status: 410 });

  const limited = await enforceClassJoinLimit(request, room.id);
  if (limited) return limited;

  let body: JoinBody;
  try {
    body = await boundedJsonBody<JoinBody>(request, 8 * 1024);
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "Invalid course entry" }, { status: 400 });
  }

  const user = await getSessionUser(request);
  const access = await classAccess(room, user, true);
  if (!access.allowed)
    return Response.json({ error: "Private course invitation required" }, { status: 403 });
  if (room.realtimeMode === "livestream") await bindVerifiedStageSpeakers(user);

  if (room.hasPassword && !access.manager) {
    const blocked = await blockedClassPasswordAttempt(request, room.id, user?.id || null);
    if (blocked) return blocked;
    if (!await verifyClassEntryPassword(code, String(body.password || ""))) {
      const failure = await recordClassPasswordFailure(request, room.id, user?.id || null);
      return failure || Response.json({
        error: "Incorrect course password",
        errorCode: "INCORRECT_CLASS_PASSWORD",
      }, { status: 403 });
    }
    await clearClassPasswordFailures(request, room.id, user?.id || null);
  }

  const db = getDatabase();
  const now = Math.floor(Date.now() / 1_000);
  const identity = String(body.identity || crypto.randomUUID())
    .replace(/[^A-Za-z0-9:_-]/g, "")
    .slice(0, 100);
  if (identity.length < 8)
    return Response.json({ error: "Invalid participant identity" }, { status: 400 });
  const displayName = String(body.displayName || user?.displayName || "Guest")
    .trim().slice(0, 80) || "Guest";
  const wantsPublish = body.publish === true;
  const wantsStart = body.start === true;
  const wantsMic = body.mic === true;
  const wantsCamera = room.streamingMode === "video" && body.camera === true;

  if (wantsStart && !access.manager)
    return Response.json({ error: "Manager access required" }, { status: 403 });

  let canPublish = baseClassPublishAllowed(access.manager, room.realtimeMode);
  let approvedMediaKinds: ClassMediaKind[] = [];
  if (room.realtimeMode === "webinar" && !canPublish) {
    const approvals = await db.prepare(`SELECT media_kind AS mediaKind
      FROM live_class_stage_requests WHERE room_id=? AND identity=?
        AND status='approved' AND media_kind IN ('audio','video')`)
      .bind(room.id, identity).run<{ mediaKind: ClassMediaKind }>();
    approvedMediaKinds = (approvals.results || []).map((approval) => approval.mediaKind);
    canPublish = wantsPublish
      ? Boolean(wantsMic || wantsCamera)
        && approvedWebinarMediaAllowed(
          { mic: wantsMic, camera: wantsCamera },
          approvedMediaKinds,
        )
      : approvedMediaKinds.length > 0;
  }
  if (room.realtimeMode === "livestream" && !canPublish && user?.emailVerified) {
    canPublish = Boolean(await db.prepare(
      "SELECT 1 FROM live_class_stage_speakers WHERE room_id=? AND user_id=? LIMIT 1",
    ).bind(room.id, user.id).first());
  }
  if (wantsPublish && !canPublish) {
    return Response.json({
      error: room.realtimeMode === "webinar"
        ? "Raise your hand and wait for host approval"
        : "The host has not added this member email as a speaker",
      errorCode: "STAGE_ACCESS_REQUIRED",
    }, { status: 403 });
  }

  let providerMeetingId = room.providerMeetingId;
  if (access.manager && (wantsStart || wantsPublish || body.screenShareCompanion === true)) {
    try { providerMeetingId = await ensureClassProviderGeneration(room); }
    catch (error) { return joinFailure(error); }
  }
  if (!providerMeetingId)
    return Response.json({ error: "STREAM_NOT_ACTIVE", errorCode: "STREAM_NOT_ACTIVE" }, { status: 409 });

  const companion = body.screenShareCompanion === true;
  if (companion && (room.streamingMode !== "audio"
    || room.realtimeMode === "livestream")) {
    return Response.json({ error: "Screen-share companion is unavailable" }, { status: 409 });
  }

  if (companion) {
    let companionSession: Awaited<ReturnType<typeof requireParticipantSession>> | null = null;
    let companionAttempt: Awaited<ReturnType<typeof beginProviderParticipantAttempt>> | null = null;
    try {
      companionSession = await requireParticipantSession({
        request,
        room,
        token: body.sessionToken,
      });
      const companionPublisher = companionSession.role === "host";
      await claimCompanionParticipant(companionSession, companionPublisher);
      companionAttempt = await beginProviderParticipantAttempt(companionSession, providerMeetingId);
      const participant = await createProviderParticipant(
        providerMeetingId,
        companionAttempt.customParticipantId,
        `${displayName} · Screen`,
        companionPublisher ? "host" : "viewer",
        "video",
        room.realtimeMode,
        companionPublisher
          ? { audio: false, video: true, screenshare: true }
          : { audio: false, video: false, screenshare: false },
      );
      await attachCompanionParticipant(
        companionSession,
        companionAttempt.id,
        providerMeetingId,
        participant.id,
      );
      return Response.json({
        authToken: participant.token,
        sessionToken: String(body.sessionToken),
        sessionId: companionSession.id,
        identity: companionSession.mediaIdentity,
        role: companionPublisher ? "host" : "viewer",
        meetingId: providerMeetingId,
        generation: room.providerGeneration,
        streamingMode: room.streamingMode,
        realtimeMode: room.realtimeMode,
        manager: companionPublisher,
        canPublish: companionPublisher,
        emailVerified: Boolean(user?.emailVerified),
        participantLimit: participantCapacity(room),
        publisherLimit: room.realtimeMode === "group_call" ? 100 : 9,
        screenShareCompanion: true,
      }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      const definite = companionAttempt
        ? await abandonDefiniteParticipantAttempt(companionAttempt.id, error).catch(() => false)
        : true;
      if (companionSession && definite)
        await releaseCompanionParticipant(companionSession).catch(() => undefined);
      return joinFailure(error);
    }
  }

  const role: "viewer" | "member" | "host" = access.manager
    ? "host"
    : wantsPublish
      ? "member"
      : "viewer";
  let reserved: Awaited<ReturnType<typeof reserveParticipantSession>> | null = null;
  let attempt: Awaited<ReturnType<typeof beginProviderParticipantAttempt>> | null = null;
  try {
    reserved = await reserveParticipantSession({
      request,
      room,
      user,
      mediaIdentity: identity,
      displayName,
      role,
      currentToken: body.sessionToken,
    });
    const publishing = access.manager || wantsPublish;
    if (publishing) await reservePublisher(reserved.session);
    attempt = await beginProviderParticipantAttempt(reserved.session, providerMeetingId);
    const allowedMedia = publishing
      ? room.realtimeMode === "webinar" && !access.manager
        ? {
            audio: approvedMediaKinds.includes("audio"),
            video: approvedMediaKinds.includes("video"),
            screenshare: false,
          }
        : {
            audio: true,
            video: room.streamingMode === "video",
            screenshare: access.manager && room.realtimeMode !== "livestream",
          }
      : { audio: false, video: false, screenshare: false };
    const participant = await createProviderParticipant(
      providerMeetingId,
      attempt.customParticipantId,
      displayName,
      role,
      room.streamingMode,
      room.realtimeMode,
      allowedMedia,
    );
    await attachProviderParticipant(
      reserved.session,
      attempt.id,
      providerMeetingId,
      participant.id,
    );

    await db.prepare(`INSERT INTO live_class_media_presence(
      id,room_id,identity,user_id,display_name,is_member,mic_on,camera_on,active,last_seen_at
    ) VALUES(?,?,?,?,?,?,0,0,1,?) ON CONFLICT(room_id,identity) DO UPDATE SET
      user_id=excluded.user_id,display_name=excluded.display_name,
      is_member=excluded.is_member,mic_on=0,camera_on=0,active=1,
      last_seen_at=excluded.last_seen_at`).bind(
      createId(),
      room.id,
      identity,
      user?.id || null,
      displayName,
      user ? 1 : 0,
      now,
    ).run();
    if (user) await recordClassJoin(user.id, room.id, now);

    const headers = new Headers({ "cache-control": "no-store" });
    if (reserved.guestCookie)
      headers.append("set-cookie", classGuestCookieHeader(reserved.guestCookie));
    return Response.json({
      authToken: participant.token,
      sessionToken: reserved.token,
      sessionId: reserved.session.id,
      identity: reserved.session.mediaIdentity,
      role,
      meetingId: providerMeetingId,
      generation: room.providerGeneration,
      streamingMode: room.streamingMode,
      realtimeMode: room.realtimeMode,
      manager: access.manager,
      canPublish,
      emailVerified: Boolean(user?.emailVerified),
      participantLimit: participantCapacity(room),
      publisherLimit: room.realtimeMode === "group_call" ? 100 : 9,
      screenShareCompanion: false,
    }, { headers });
  } catch (error) {
    if (attempt) await abandonDefiniteParticipantAttempt(attempt.id, error).catch(() => undefined);
    if (reserved) await revokeParticipantSession(reserved.session, "leave").catch(() => undefined);
    return recoverableJoinFailure(error, reserved?.token);
  }
}
