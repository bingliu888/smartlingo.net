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
  attachProviderParticipant,
  beginProviderParticipantAttempt,
  classGuestCookieHeader,
  participantCapacity,
  reserveParticipantSession,
  reservePublisher,
  revokeParticipantSession,
} from "@/lib/class-participant-session";
import { ensureClassProviderGeneration } from "@/lib/class-provider-lifecycle";
import { createProviderParticipant } from "@/lib/live-class-realtimekit";
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

  if (wantsStart && !access.manager)
    return Response.json({ error: "Manager access required" }, { status: 403 });

  let canPublish = access.manager
    || room.classType === "private"
    || room.realtimeMode === "group_call";
  if (room.realtimeMode === "webinar" && !canPublish) {
    canPublish = Boolean(await db.prepare(
      "SELECT 1 FROM live_class_stage_requests WHERE room_id=? AND identity=? AND status='approved' LIMIT 1",
    ).bind(room.id, identity).first());
  }
  if (room.realtimeMode === "livestream" && !canPublish && user) {
    canPublish = Boolean(await db.prepare(
      "SELECT 1 FROM live_class_stage_speakers WHERE room_id=? AND lower(member_email)=lower(?) LIMIT 1",
    ).bind(room.id, user.email).first());
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
  if (companion && (!access.manager || room.streamingMode !== "audio"
    || room.realtimeMode === "livestream")) {
    return Response.json({ error: "Screen-share companion is unavailable" }, { status: 409 });
  }

  let role: "viewer" | "member" | "host" = access.manager
    ? "host"
    : wantsPublish
      ? "member"
      : "viewer";
  if (companion) role = "host";

  let reserved: Awaited<ReturnType<typeof reserveParticipantSession>> | null = null;
  let attempt: Awaited<ReturnType<typeof beginProviderParticipantAttempt>> | null = null;
  try {
    reserved = await reserveParticipantSession({
      request,
      room,
      user,
      mediaIdentity: companion ? `screenshare:${identity}` : identity,
      displayName: companion ? `${displayName} · Screen` : displayName,
      role,
      currentToken: body.sessionToken,
    });
    const publishing = companion || access.manager || wantsPublish;
    if (publishing) await reservePublisher(reserved.session);
    attempt = await beginProviderParticipantAttempt(reserved.session, providerMeetingId);
    const allowedMedia = publishing
      ? {
          audio: !companion,
          video: companion || room.streamingMode === "video",
          screenshare: access.manager && room.realtimeMode !== "livestream",
        }
      : { audio: false, video: false, screenshare: false };
    const participant = await createProviderParticipant(
      providerMeetingId,
      attempt.customParticipantId,
      companion ? `${displayName} · Screen` : displayName,
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
      companion ? `screenshare:${identity}` : identity,
      user?.id || null,
      companion ? `${displayName} · Screen` : displayName,
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
      screenShareCompanion: companion,
    }, { headers });
  } catch (error) {
    if (attempt) await abandonDefiniteParticipantAttempt(attempt.id, error).catch(() => undefined);
    if (reserved) await revokeParticipantSession(reserved.session, "leave").catch(() => undefined);
    return joinFailure(error);
  }
}
