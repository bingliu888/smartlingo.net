import { boundedJsonBody } from "@/lib/bounded-request-body";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { createId, getDatabase, getSessionUser, type SessionUser } from "@/lib/auth";
import {
  activeParticipantSessionByMediaIdentity,
  cleanupExpiredParticipantSessions,
  heartbeatParticipantSession,
  markPublisherMediaState,
  moderatorBanParticipant,
  releaseCompanionParticipant,
  releasePublisherIfIdle,
  requireParticipantSession,
  reservePublisher,
  revokeParticipantSession,
  type ClassParticipantSession,
} from "@/lib/class-participant-session";
import {
  classProviderGenerationExpired,
  queueClassProviderTeardown,
} from "@/lib/class-provider-lifecycle";
import { normalizeEmailAddress } from "@/lib/email-address";
import { UNVERIFIED_PUBLISHER_CONTINUOUS_SECONDS } from "@/lib/verified-member-policy";
import { bindVerifiedStageSpeakers, verifiedRegisteredUser } from "@/lib/class-managers";
import {
  approvedWebinarMediaAllowed,
  baseClassPublishAllowed,
  classMediaIdentityProjection,
  livestreamPublisherIdentityAllowed,
  type ClassMediaKind,
} from "@/lib/class-publish-policy";

type MediaBody = {
  action?: unknown;
  sessionToken?: unknown;
  identity?: unknown;
  targetIdentity?: unknown;
  mic?: unknown;
  camera?: unknown;
  value?: unknown;
  mediaKind?: unknown;
  approve?: unknown;
  email?: unknown;
  authorizeOnly?: unknown;
  humanIdentity?: unknown;
};

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

function sessionFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "PARTICIPANT_SESSION_REQUIRED";
  const status = code === "PARTICIPANT_SESSION_KICKED"
    ? 403
    : code === "PARTICIPANT_SESSION_CONFLICT"
      ? 409
    : code.includes("EXPIRED") || code.includes("GENERATION")
      ? 410
      : 401;
  return Response.json({ error: code, errorCode: code }, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function requireSession(
  request: Request,
  room: NonNullable<Awaited<ReturnType<typeof classByCode>>>,
  body: MediaBody,
  touch = true,
) {
  return requireParticipantSession({
    request,
    room,
    token: body.sessionToken,
    identity: body.identity,
    touch,
  });
}

async function sessionEmailVerified(session: ClassParticipantSession) {
  if (!session.userId) return false;
  return Boolean((await getDatabase().prepare(
    "SELECT email_verified AS emailVerified FROM users WHERE id=? LIMIT 1",
  ).bind(session.userId).first<{ emailVerified: number }>())?.emailVerified);
}

async function livestreamSpeakerAllowed(
  roomId: string,
  user: SessionUser | null,
  participantUserId?: string | null,
) {
  if (!user || !livestreamPublisherIdentityAllowed(user, participantUserId)) return false;
  await bindVerifiedStageSpeakers(user);
  return Boolean(await getDatabase().prepare(
    "SELECT 1 FROM live_class_stage_speakers WHERE room_id=? AND user_id=? LIMIT 1",
  ).bind(roomId, user.id).first());
}

async function interruptUnverifiedPublisher(
  session: ClassParticipantSession,
  roomId: string,
  identity: string,
) {
  await revokeParticipantSession(session, "leave");
  await getDatabase().prepare(
    "UPDATE live_class_media_presence SET mic_on=0,camera_on=0,active=0,last_seen_at=? WHERE room_id=? AND identity=?",
  ).bind(nowSeconds(), roomId, identity).run();
  return Response.json({
    error: "Verify your email to continue publishing. You can rejoin immediately as a viewer.",
    errorCode: "UNVERIFIED_PUBLISHER_INTERRUPTED",
  }, { status: 409, headers: { "cache-control": "no-store" } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Not found" }, { status: 404 });
  const requestedIdentity = String(new URL(request.url).searchParams.get("identity") || "").slice(0, 100);
  const user = await getSessionUser(request);
  const access = await classAccess(room, user, true);
  if (!access.allowed) return Response.json({ error: "Access denied" }, { status: 403 });

  let selfSession: ClassParticipantSession | null = null;
  if (requestedIdentity) {
    try {
      selfSession = await requireParticipantSession({
        request,
        room,
        identity: requestedIdentity,
        touch: false,
      });
    } catch {}
  }
  const selfIdentity = selfSession?.mediaIdentity || null;

  const now = nowSeconds();
  const db = getDatabase();
  await cleanupExpiredParticipantSessions(room.id, 25);
  await db.prepare(`UPDATE live_class_media_presence SET active=0,mic_on=0,camera_on=0
    WHERE room_id=? AND NOT EXISTS(
      SELECT 1 FROM class_participant_sessions session
      WHERE session.room_id=live_class_media_presence.room_id
        AND session.media_identity=live_class_media_presence.identity
        AND session.active=1 AND session.last_seen_at>?
    )`).bind(room.id, now - 90).run();

  let streamActive = Boolean(room.streamActive && room.providerMeetingId);
  if (streamActive && classProviderGenerationExpired(room, now)) {
    await queueClassProviderTeardown({
      roomId: room.id,
      providerMeetingId: room.providerMeetingId!,
      generation: room.providerGeneration,
      reason: "duration",
    });
    streamActive = false;
  }

  const rawUsers = (await db.prepare(`SELECT presence.identity,
    presence.user_id AS userId,presence.display_name AS displayName,
    presence.is_member AS isMember,presence.mic_on AS micOn,
    presence.camera_on AS cameraOn,presence.last_seen_at AS lastSeenAt,
    session.human_identity AS humanIdentity
    FROM live_class_media_presence presence
    JOIN class_participant_sessions session
      ON session.room_id=presence.room_id AND session.media_identity=presence.identity
    WHERE presence.room_id=? AND presence.active=1 AND session.active=1
      AND session.generation=? AND session.last_seen_at>?
    ORDER BY presence.display_name,presence.identity LIMIT 1000`)
    .bind(room.id, room.providerGeneration, now - 90)
    .run<{
      identity: string;
      userId: string | null;
      displayName: string;
      isMember: number;
      micOn: number;
      cameraOn: number;
      lastSeenAt: number;
      humanIdentity: string;
    }>()).results || [];
  const activeUsers = rawUsers.filter((item) => !item.identity.startsWith("screenshare:"));
  const managerIds = new Set([
    room.hostUserId,
    ...((await db.prepare("SELECT user_id AS userId FROM live_class_cohosts WHERE room_id=? AND identity_bound_at>0")
      .bind(room.id).run<{ userId: string }>()).results || []).map((item) => item.userId),
  ]);
  const hostOnline = activeUsers.some((item) => item.userId === room.hostUserId);
  const shared = await db.prepare(`SELECT active,lease_until AS leaseUntil
    FROM class_shared_content_state WHERE room_id=? LIMIT 1`)
    .bind(room.id).first<{ active: number; leaseUntil: number | null }>();
  const screenShareActive = Boolean(shared?.active && Number(shared.leaseUntil || 0) > now);

  const requests = access.manager && room.realtimeMode === "webinar"
    ? (await db.prepare(`SELECT identity,display_name AS displayName,
        media_kind AS mediaKind,status FROM live_class_stage_requests
        WHERE room_id=? AND status='pending' ORDER BY created_at LIMIT 100`)
      .bind(room.id).run()).results || []
    : [];
  const speakers = access.manager && room.realtimeMode === "livestream"
    ? (await db.prepare(`SELECT member_email AS email FROM live_class_stage_speakers
        WHERE room_id=? AND user_id IS NOT NULL ORDER BY created_at LIMIT 100`)
      .bind(room.id).run()).results || []
    : [];

  let canPublish = baseClassPublishAllowed(access.manager, room.realtimeMode);
  let approvedMediaKinds: ClassMediaKind[] = [];
  if (!canPublish && room.realtimeMode === "webinar" && selfIdentity) {
    const approvals = await db.prepare(`SELECT media_kind AS mediaKind
      FROM live_class_stage_requests WHERE room_id=? AND identity=?
        AND status='approved' AND media_kind IN ('audio','video')`)
      .bind(room.id, selfIdentity).run<{ mediaKind: ClassMediaKind }>();
    approvedMediaKinds = (approvals.results || []).map((approval) => approval.mediaKind);
    canPublish = approvedMediaKinds.length > 0;
  }
  if (!canPublish && room.realtimeMode === "livestream")
    canPublish = await livestreamSpeakerAllowed(room.id, user);

  return Response.json({
    streamActive,
    providerMeetingId: streamActive ? room.providerMeetingId : null,
    generation: room.providerGeneration,
    generationStartedAt: room.providerGenerationStartedAt,
    sessionDeadlineAt: room.providerGenerationStartedAt
      ? room.providerGenerationStartedAt + 120 * 60
      : null,
    streamingMode: room.streamingMode,
    realtimeMode: room.realtimeMode,
    manager: access.manager,
    canPublish,
    approvedMediaKinds,
    hostOnline,
    participantLimit: room.realtimeMode === "group_call" ? 100 : 1000,
    publisherLimit: room.realtimeMode === "group_call" ? 100 : 9,
    users: activeUsers.map(({ identity, userId, humanIdentity, ...item }) => ({
      ...item,
      ...classMediaIdentityProjection(identity, access.manager),
      self: identity === selfIdentity,
      isManager: Boolean(userId && managerIds.has(userId)),
      ...(access.manager ? { humanIdentity } : {}),
    })),
    hasOtherParticipants: activeUsers.some((item) => item.identity !== selfIdentity),
    hasAudience: access.manager
      ? activeUsers.some((item) => item.identity !== selfIdentity
        && !(item.userId && managerIds.has(item.userId)))
      : activeUsers.some((item) => item.identity !== selfIdentity),
    requests,
    speakers,
    screenShareActive,
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Not found" }, { status: 404 });

  let body: MediaBody;
  try { body = await boundedJsonBody<MediaBody>(request, 16 * 1024); }
  catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const user = await getSessionUser(request);
  const access = await classAccess(room, user, true);
  const db = getDatabase();
  const now = nowSeconds();
  const action = String(body.action || "");
  let session: ClassParticipantSession;
  try { session = await requireSession(request, room, body, action !== "leave"); }
  catch (error) { return sessionFailure(error); }
  if (!access.allowed && action !== "leave") {
    await revokeParticipantSession(session, "leave");
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  if (action === "release-companion") {
    if (!access.manager || session.role !== "host")
      return Response.json({ error: "Manager access required" }, { status: 403 });
    await releaseCompanionParticipant(session);
    await db.prepare(`UPDATE class_shared_content_state SET active=0,lease_until=?,updated_at=?
      WHERE room_id=? AND claim_token=?`).bind(now, now, room.id, session.tokenHash).run();
    return Response.json({ ok: true });
  }

  if (action === "screen-share") {
    if (!access.manager || session.role !== "host")
      return Response.json({ error: "Manager access required" }, { status: 403 });
    if (room.realtimeMode === "livestream")
      return Response.json({ error: "Livestream rooms cannot share screens" }, { status: 409 });
    const active = body.value === true;
    if (active) {
      const result = await db.prepare(`INSERT INTO class_shared_content_state(
        room_id,generation,media_identity,source,label,active,claim_token,lease_until,updated_at
      ) VALUES(?,? ,?,'screen','Screen share',1,?,?,?)
      ON CONFLICT(room_id) DO UPDATE SET generation=excluded.generation,
        media_identity=excluded.media_identity,source='screen',label=excluded.label,
        active=1,claim_token=excluded.claim_token,lease_until=excluded.lease_until,
        updated_at=excluded.updated_at
      WHERE class_shared_content_state.active=0
        OR class_shared_content_state.lease_until<=?
        OR class_shared_content_state.claim_token=excluded.claim_token`)
        .bind(room.id, room.providerGeneration, session.mediaIdentity, session.tokenHash,
          now + 15, now, now).run();
      if (Number(result.meta?.changes || 0) !== 1)
        return Response.json({ error: "Another participant is already sharing" }, { status: 409 });
    } else {
      await db.prepare(`UPDATE class_shared_content_state SET active=0,lease_until=?,updated_at=?
        WHERE room_id=? AND claim_token=?`).bind(now, now, room.id, session.tokenHash).run();
    }
    await db.prepare(`UPDATE live_class_media_presence SET camera_on=?,active=1,last_seen_at=?
      WHERE room_id=? AND identity=?`).bind(active ? 1 : 0, now, room.id, session.mediaIdentity).run();
    return Response.json({ screenShareActive: active });
  }

  if (action === "request-stage") {
    if (room.realtimeMode !== "webinar")
      return Response.json({ error: "Invalid stage request" }, { status: 400 });
    const kind = body.mediaKind === "video" ? "video" : "audio";
    await db.prepare(`INSERT INTO live_class_stage_requests(
      id,room_id,identity,user_id,display_name,media_kind,status,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'pending',?,?) ON CONFLICT(room_id,identity,media_kind)
      DO UPDATE SET status='pending',updated_at=excluded.updated_at`).bind(
      createId(), room.id, session.mediaIdentity, session.userId,
      session.displayName, kind, now, now,
    ).run();
    return Response.json({ ok: true });
  }

  if (action === "review-stage") {
    if (!access.manager || room.realtimeMode !== "webinar")
      return Response.json({ error: "Manager access required" }, { status: 403 });
    const targetIdentity = String(body.targetIdentity || "").slice(0, 100);
    if (!targetIdentity)
      return Response.json({ error: "Participant identity is required" }, { status: 400 });
    const kind = body.mediaKind === "video" ? "video" : "audio";
    await db.prepare(`UPDATE live_class_stage_requests SET status=?,updated_at=?
      WHERE room_id=? AND identity=? AND media_kind=?`).bind(
      body.approve === true ? "approved" : "denied",
      now,
      room.id,
      targetIdentity,
      kind,
    ).run();
    if (body.approve !== true) {
      const target = await activeParticipantSessionByMediaIdentity(room.id, targetIdentity);
      if (target?.publisherReserved) {
        await releasePublisherIfIdle(target);
        await revokeParticipantSession(target, "leave");
        await db.prepare(`UPDATE live_class_media_presence SET mic_on=0,camera_on=0,active=0,last_seen_at=?
          WHERE room_id=? AND identity=?`).bind(now, room.id, targetIdentity).run();
      }
    }
    return Response.json({ ok: true });
  }

  if (action === "add-speaker" || action === "remove-speaker") {
    if (!access.manager || room.realtimeMode !== "livestream")
      return Response.json({ error: "Manager access required" }, { status: 403 });
    const email = normalizeEmailAddress(body.email);
    if (!email) return Response.json({ error: "Enter a valid member email" }, { status: 400 });
    if (action === "add-speaker") {
      let target: Awaited<ReturnType<typeof verifiedRegisteredUser>>;
      try { target = await verifiedRegisteredUser(email); }
      catch (error) {
        if (!(error instanceof Error) || error.message !== "MEMBER_NOT_FOUND") throw error;
        return Response.json({
          error: "Verified registered member not found",
          errorCode: "VERIFIED_MEMBER_REQUIRED",
        }, { status: 404 });
      }
      await db.batch([
        db.prepare(`DELETE FROM live_class_stage_speakers
          WHERE room_id=? AND user_id IS NULL AND lower(member_email)=lower(?)`)
          .bind(room.id, target.email),
        db.prepare(`UPDATE live_class_stage_speakers SET member_email=?,added_by_user_id=?
          WHERE room_id=? AND user_id=?`).bind(target.email, user!.id, room.id, target.id),
        db.prepare(`INSERT INTO live_class_stage_speakers(
          id,room_id,member_email,user_id,added_by_user_id,created_at
        ) VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,member_email) DO UPDATE SET
          user_id=excluded.user_id,added_by_user_id=excluded.added_by_user_id`)
          .bind(createId(), room.id, target.email, target.id, user!.id, now),
      ]);
    } else {
      await db.prepare(
        "DELETE FROM live_class_stage_speakers WHERE room_id=? AND lower(member_email)=lower(?)",
      ).bind(room.id, email).run();
    }
    return Response.json({ ok: true });
  }

  if (action === "kick") {
    if (!access.manager || !user)
      return Response.json({ error: "Manager access required" }, { status: 403 });
    const humanIdentity = String(body.humanIdentity || "");
    const target = (await db.prepare(`SELECT human_identity AS humanIdentity,
      user_id AS userId,display_name AS displayName FROM class_participant_sessions
      WHERE room_id=? AND human_identity=? AND active=1 LIMIT 1`)
      .bind(room.id, humanIdentity)
      .first<{ humanIdentity: string; userId: string | null; displayName: string }>());
    if (!target) return Response.json({ error: "Participant not found" }, { status: 404 });
    if (target.userId === room.hostUserId)
      return Response.json({ error: "The permanent host cannot be removed" }, { status: 409 });
    const removed = await moderatorBanParticipant({
      roomId: room.id,
      humanIdentity: target.humanIdentity,
      displayName: target.displayName,
      userId: target.userId,
      bannedByUserId: user.id,
    });
    return Response.json({ ok: true, removed });
  }

  if (action === "allow-reentry") {
    if (!access.manager)
      return Response.json({ error: "Manager access required" }, { status: 403 });
    await db.prepare("DELETE FROM class_participant_bans WHERE room_id=? AND human_identity=?")
      .bind(room.id, String(body.humanIdentity || "")).run();
    return Response.json({ ok: true });
  }

  if (action === "heartbeat") {
    try { await heartbeatParticipantSession(session); }
    catch (error) { return sessionFailure(error); }
    if (room.realtimeMode === "livestream" && session.role !== "viewer"
      && !access.manager && !await livestreamSpeakerAllowed(room.id, user, session.userId))
      return interruptUnverifiedPublisher(session, room.id, session.mediaIdentity);
    if (session.publisherStartedAt
      && session.publisherStartedAt <= now - UNVERIFIED_PUBLISHER_CONTINUOUS_SECONDS
      && !await sessionEmailVerified(session))
      return interruptUnverifiedPublisher(session, room.id, session.mediaIdentity);
    await db.prepare(`UPDATE live_class_media_presence SET
      mic_on=COALESCE(?,mic_on),camera_on=COALESCE(?,camera_on),
      last_seen_at=?,active=1 WHERE room_id=? AND identity=?`).bind(
      typeof body.mic === "boolean" ? (body.mic ? 1 : 0) : null,
      typeof body.camera === "boolean" ? (body.camera ? 1 : 0) : null,
      now,
      room.id,
      session.mediaIdentity,
    ).run();
    if (session.tokenHash) await db.prepare(`UPDATE class_shared_content_state SET
      lease_until=?,updated_at=? WHERE room_id=? AND active=1 AND claim_token=?`)
      .bind(now + 15, now, room.id, session.tokenHash).run();
    return Response.json({ ok: true });
  }

  if (action === "leave") {
    await revokeParticipantSession(session, "leave");
    await db.prepare(`UPDATE live_class_media_presence SET active=0,mic_on=0,camera_on=0,last_seen_at=?
      WHERE room_id=? AND identity=?`).bind(now, room.id, session.mediaIdentity).run();
    await db.prepare(`UPDATE class_shared_content_state SET active=0,lease_until=?,updated_at=?
      WHERE room_id=? AND claim_token=?`).bind(now, now, room.id, session.tokenHash).run();
    // Silent viewers and moderators keep the provider generation alive. A
    // participant leaving never retires a whole room; only the two-hour clock,
    // explicit closure, deletion, or bounded idle maintenance can do that.
    return Response.json({ ok: true });
  }

  if (action === "media") {
    if (!access.allowed)
      return Response.json({ error: "Access denied" }, { status: 403 });
    const wantsMic = body.mic === true;
    const wantsCamera = body.camera === true;
    const publishing = wantsMic || wantsCamera;
    let allowed = baseClassPublishAllowed(access.manager, room.realtimeMode);
    if (!allowed && room.realtimeMode === "webinar") {
      const approvals = await db.prepare(`SELECT media_kind AS mediaKind
        FROM live_class_stage_requests WHERE room_id=? AND identity=?
          AND status='approved' AND media_kind IN ('audio','video')`)
        .bind(room.id, session.mediaIdentity).run<{ mediaKind: ClassMediaKind }>();
      allowed = approvedWebinarMediaAllowed(
        { mic: wantsMic, camera: wantsCamera },
        (approvals.results || []).map((approval) => approval.mediaKind),
      );
    }
    if (!allowed && room.realtimeMode === "livestream")
      allowed = await livestreamSpeakerAllowed(room.id, user, session.userId);
    if (publishing && (!allowed || session.role === "viewer"))
      return Response.json({ error: "STAGE_ACCESS_REQUIRED", errorCode: "STAGE_ACCESS_REQUIRED" }, { status: 403 });

    if (publishing) {
      try { await reservePublisher(session); }
      catch (error) {
        const code = error instanceof Error ? error.message : "PUBLISHER_LIMIT_REACHED";
        return Response.json({ error: "The publisher stage is full", errorCode: code }, { status: 409 });
      }
      if (session.publisherStartedAt
        && session.publisherStartedAt <= now - UNVERIFIED_PUBLISHER_CONTINUOUS_SECONDS
        && !await sessionEmailVerified(session))
        return interruptUnverifiedPublisher(session, room.id, session.mediaIdentity);
    }
    if (body.authorizeOnly === true) return Response.json({ ok: true });
    try { await markPublisherMediaState(session, publishing); }
    catch (error) { return sessionFailure(error); }
    await db.prepare(`UPDATE live_class_media_presence SET mic_on=?,camera_on=?,last_seen_at=?,active=1
      WHERE room_id=? AND identity=?`).bind(
      wantsMic ? 1 : 0,
      wantsCamera ? 1 : 0,
      now,
      room.id,
      session.mediaIdentity,
    ).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
