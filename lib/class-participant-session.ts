import { createId, getDatabase, type SessionUser } from "./auth";
import type { ClassRoom } from "./live-classrooms";
import {
  findProviderParticipantByCustomId,
  providerParticipantCreateFailureIsDefinite,
  removeProviderParticipant,
  type MeetingParticipantRole,
} from "./live-class-realtimekit";
import { participantIdentityTokenMatches } from "./class-media-identity";

export const PARTICIPANT_SESSION_TTL_SECONDS = 90;
export const PARTICIPANT_SESSION_PER_HUMAN_LIMIT = 4;
export const GROUP_CALL_PARTICIPANT_LIMIT = 100;
export const STAGED_ROOM_PARTICIPANT_LIMIT = 1_000;
export const STAGED_PUBLISHER_LIMIT = 9;
export const CLASS_GUEST_COOKIE = "smartlingo_class_guest";

export type ClassParticipantSession = {
  id: string;
  roomId: string;
  generation: number;
  mediaIdentity: string;
  humanIdentity: string;
  userId: string | null;
  displayName: string;
  role: MeetingParticipantRole;
  tokenHash: string;
  providerMeetingId: string | null;
  providerParticipantId: string | null;
  companionProviderParticipantId: string | null;
  publisherReserved: number;
  companionReserved: number;
  companionPublisherReserved: number;
  publisherStartedAt: number | null;
  publisherInterruptedAt: number | null;
  active: number;
  joinedAt: number;
  lastSeenAt: number;
  revokedAt: number | null;
  revocationReason: string | null;
};

const SESSION_SELECT = `SELECT id,room_id AS roomId,generation,
  media_identity AS mediaIdentity,human_identity AS humanIdentity,
  user_id AS userId,display_name AS displayName,role,token_hash AS tokenHash,
  provider_meeting_id AS providerMeetingId,
  provider_participant_id AS providerParticipantId,
  companion_provider_participant_id AS companionProviderParticipantId,
  publisher_reserved AS publisherReserved,companion_reserved AS companionReserved,
  companion_publisher_reserved AS companionPublisherReserved,
  publisher_started_at AS publisherStartedAt,
  publisher_interrupted_at AS publisherInterruptedAt,active,
  joined_at AS joinedAt,last_seen_at AS lastSeenAt,revoked_at AS revokedAt,
  revocation_reason AS revocationReason FROM class_participant_sessions`;

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

function base64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function classSessionTokenHash(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function activeSessionAfterMutation(session: Pick<ClassParticipantSession, "id" | "tokenHash">) {
  return getDatabase().prepare(
    `${SESSION_SELECT} WHERE id=? AND token_hash=? AND active=1 LIMIT 1`,
  ).bind(session.id, session.tokenHash).first<ClassParticipantSession>();
}

function randomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function cookieValue(request: Request, name: string) {
  return (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;
}

export async function classHumanIdentity(request: Request, user: SessionUser | null) {
  if (user) return { humanIdentity: `member:${user.id}`, guestCookie: null };
  const existing = cookieValue(request, CLASS_GUEST_COOKIE);
  const guestCookie = existing && /^[A-Za-z0-9_-]{32,128}$/.test(existing)
    ? existing
    : randomToken();
  return {
    humanIdentity: `guest:${(await classSessionTokenHash(guestCookie)).slice(0, 48)}`,
    guestCookie: existing ? null : guestCookie,
  };
}

export function classGuestCookieHeader(value: string) {
  return `${CLASS_GUEST_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
}

export function participantSessionToken(request: Request, bodyToken?: unknown) {
  const header = request.headers.get("x-class-session-token") || "";
  const value = String(bodyToken || header).trim();
  return /^[A-Za-z0-9_-]{40,128}$/.test(value) ? value : null;
}

export function participantCapacity(room: Pick<ClassRoom, "realtimeMode">) {
  return room.realtimeMode === "group_call"
    ? GROUP_CALL_PARTICIPANT_LIMIT
    : STAGED_ROOM_PARTICIPANT_LIMIT;
}

function sessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("STREAMING_ROOM_FULL")) return "STREAMING_ROOM_FULL";
  if (message.includes("PUBLISHER_LIMIT_REACHED")) return "PUBLISHER_LIMIT_REACHED";
  return null;
}

export async function reserveParticipantSession(input: {
  request: Request;
  room: ClassRoom;
  user: SessionUser | null;
  mediaIdentity: string;
  displayName: string;
  role: MeetingParticipantRole;
  currentToken?: unknown;
}) {
  const db = getDatabase();
  const now = nowSeconds();
  const identity = await classHumanIdentity(input.request, input.user);
  const token = randomToken();
  const tokenHash = await classSessionTokenHash(token);
  const sessionId = createId();
  const staleBefore = now - PARTICIPANT_SESSION_TTL_SECONDS;
  const banned = await db.prepare(
    "SELECT 1 AS banned FROM class_participant_bans WHERE room_id=? AND human_identity=? LIMIT 1",
  ).bind(input.room.id, identity.humanIdentity).first<{ banned: number }>();
  if (banned) throw new Error("PARTICIPANT_SESSION_KICKED");

  const previous = await db.prepare(
    `${SESSION_SELECT} WHERE room_id=? AND media_identity=? LIMIT 1`,
  ).bind(input.room.id, input.mediaIdentity).first<ClassParticipantSession>();
  let expectedTokenHash = "";
  if (previous) {
    const supplied = participantSessionToken(input.request, input.currentToken);
    const suppliedHash = supplied ? await classSessionTokenHash(supplied) : null;
    // A media identity is a per-device capability, not a client-selected
    // nickname. Even after Leave or expiry, only the holder of the prior
    // secret may rotate that identity and inherit its webinar approvals.
    if (!participantIdentityTokenMatches(previous.tokenHash, suppliedHash))
      throw new Error("PARTICIPANT_SESSION_CONFLICT");
    expectedTokenHash = previous.tokenHash;
  }
  const activeForHuman = await db.prepare(`SELECT COUNT(*) AS count
    FROM class_participant_sessions WHERE room_id=? AND human_identity=?
      AND media_identity<>? AND active=1 AND last_seen_at>?`)
    .bind(input.room.id, identity.humanIdentity, input.mediaIdentity, staleBefore)
    .first<{ count: number }>();
  if (Number(activeForHuman?.count || 0) >= PARTICIPANT_SESSION_PER_HUMAN_LIMIT)
    throw new Error("PARTICIPANT_SESSION_LIMIT");

  const statements = [
    db.prepare(
      "UPDATE class_participant_sessions SET active=0,publisher_reserved=0,companion_reserved=0,companion_publisher_reserved=0,revoked_at=?,revocation_reason='expired' WHERE room_id=? AND active=1 AND last_seen_at<=?",
    ).bind(now, input.room.id, staleBefore),
  ];
  if (previous?.providerMeetingId && previous.providerParticipantId) {
    statements.push(db.prepare(`INSERT INTO provider_participant_cleanup_jobs(
      provider_meeting_id,provider_participant_id,room_id,participant_session_id,
      attempts,next_attempt_at,requested_at,updated_at
    ) VALUES(?,?,?,?,0,?,?,?) ON CONFLICT(provider_meeting_id,provider_participant_id)
      DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
      .bind(previous.providerMeetingId, previous.providerParticipantId, input.room.id, previous.id, now, now, now));
  }
  statements.push(
    // Fence token rotation inside the same D1 batch. Two concurrent reconnects
    // can both observe the old token, but only the first may delete that exact
    // row; the loser reaches the unique key and the whole batch rolls back.
    db.prepare(`DELETE FROM class_participant_sessions
      WHERE room_id=? AND media_identity=? AND (
        active=0 OR last_seen_at<=? OR token_hash=?
      )`).bind(input.room.id, input.mediaIdentity, staleBefore, expectedTokenHash),
    db.prepare(`INSERT INTO class_participant_sessions(
      id,room_id,generation,media_identity,human_identity,user_id,display_name,role,
      token_hash,provider_meeting_id,active,joined_at,last_seen_at
    ) SELECT ?,?,?,?,?,?,?,?,?,?,1,?,? WHERE EXISTS(
      SELECT 1 FROM live_class_rooms WHERE id=? AND status='active'
        AND provider_meeting_id=? AND provider_generation=?
    ) AND NOT EXISTS(
      SELECT 1 FROM class_deletion_jobs WHERE room_id=?
    ) AND NOT EXISTS(
      SELECT 1 FROM class_provider_teardown_jobs WHERE room_id=? AND blocks_join=1
    ) AND NOT EXISTS(
      SELECT 1 FROM class_participant_bans WHERE room_id=? AND human_identity=?
    ) AND (
      SELECT COUNT(*) FROM class_participant_sessions
      WHERE room_id=? AND human_identity=? AND media_identity<>? AND active=1
    )<?`).bind(
      sessionId,
      input.room.id,
      Number(input.room.providerGeneration || 0),
      input.mediaIdentity,
      identity.humanIdentity,
      input.user?.id || null,
      input.displayName.slice(0, 80) || "Guest",
      input.role,
      tokenHash,
      input.room.providerMeetingId,
      now,
      now,
      input.room.id,
      input.room.providerMeetingId,
      Number(input.room.providerGeneration || 0),
      input.room.id,
      input.room.id,
      input.room.id,
      identity.humanIdentity,
      input.room.id,
      identity.humanIdentity,
      input.mediaIdentity,
      PARTICIPANT_SESSION_PER_HUMAN_LIMIT,
    ),
  );
  try {
    const results = await db.batch(statements);
    // D1 can report `meta.changes = 0` for an INSERT ... SELECT that did
    // persist. The new session id is unique to this reservation attempt, so
    // reading that exact row is the authoritative success check. Without this
    // read-back, a successful insert is misreported as a tab-limit failure and
    // leaves an unattached active lease behind.
    const inserted = await db.prepare(`${SESSION_SELECT} WHERE id=? LIMIT 1`)
      .bind(sessionId).first<ClassParticipantSession>();
    if (inserted?.active && inserted.tokenHash === tokenHash)
      return { session: inserted, token, guestCookie: identity.guestCookie };
    if (Number(results[results.length - 1]?.meta?.changes || 0) !== 1) {
      const lifecycle = await db.prepare(`SELECT status,
        provider_meeting_id AS providerMeetingId,
        provider_generation AS providerGeneration,
        EXISTS(SELECT 1 FROM class_deletion_jobs WHERE room_id=live_class_rooms.id) AS deleting,
        EXISTS(SELECT 1 FROM class_provider_teardown_jobs
          WHERE room_id=live_class_rooms.id AND blocks_join=1) AS retiring
        FROM live_class_rooms WHERE id=? LIMIT 1`).bind(input.room.id).first<{
          status: string;
          providerMeetingId: string | null;
          providerGeneration: number;
          deleting: number;
          retiring: number;
        }>();
      if (!lifecycle || lifecycle.status !== "active" || lifecycle.deleting)
        throw new Error("CLASS_DELETION_PENDING");
      if (lifecycle.retiring) throw new Error("CLASS_PROVIDER_TEARDOWN_PENDING");
      if (await db.prepare(`SELECT 1 FROM class_participant_bans
        WHERE room_id=? AND human_identity=? LIMIT 1`)
        .bind(input.room.id, identity.humanIdentity).first())
        throw new Error("PARTICIPANT_SESSION_KICKED");
      if (lifecycle.providerMeetingId !== input.room.providerMeetingId
        || lifecycle.providerGeneration !== Number(input.room.providerGeneration || 0))
        throw new Error("PARTICIPANT_SESSION_GENERATION_ENDED");
      throw new Error("PARTICIPANT_SESSION_LIMIT");
    }
  } catch (error) {
    const code = sessionError(error);
    if (code) throw new Error(code);
    const diagnostic = error instanceof Error ? error.message : String(error || "");
    if (diagnostic.includes("UNIQUE constraint failed: class_participant_sessions"))
      throw new Error("PARTICIPANT_SESSION_CONFLICT");
    throw error;
  }
  const session = await db.prepare(`${SESSION_SELECT} WHERE id=? LIMIT 1`)
    .bind(sessionId).first<ClassParticipantSession>();
  if (!session) throw new Error("PARTICIPANT_SESSION_RESERVATION_FAILED");
  return { session, token, guestCookie: identity.guestCookie };
}

export async function requireParticipantSession(input: {
  request: Request;
  room: ClassRoom;
  token?: unknown;
  identity?: unknown;
  touch?: boolean;
}) {
  const token = participantSessionToken(input.request, input.token);
  if (!token) throw new Error("PARTICIPANT_SESSION_REQUIRED");
  const tokenHash = await classSessionTokenHash(token);
  const now = nowSeconds();
  const session = await getDatabase().prepare(
    `${SESSION_SELECT} WHERE room_id=? AND token_hash=? LIMIT 1`,
  ).bind(input.room.id, tokenHash).first<ClassParticipantSession>();
  if (!session || !session.active || session.lastSeenAt <= now - PARTICIPANT_SESSION_TTL_SECONDS)
    throw new Error(session?.revocationReason === "moderator_kick"
      ? "PARTICIPANT_SESSION_KICKED"
      : "PARTICIPANT_SESSION_EXPIRED");
  if (session.generation !== Number(input.room.providerGeneration || 0)
    || (input.room.providerMeetingId && session.providerMeetingId !== input.room.providerMeetingId))
    throw new Error("PARTICIPANT_SESSION_GENERATION_ENDED");
  if (input.identity && String(input.identity) !== session.mediaIdentity)
    throw new Error("PARTICIPANT_SESSION_IDENTITY_MISMATCH");
  if (input.touch !== false) {
    const touched = await getDatabase().prepare(`UPDATE class_participant_sessions
      SET last_seen_at=? WHERE id=? AND token_hash=? AND active=1 AND last_seen_at>?`)
      .bind(now, session.id, session.tokenHash, now - PARTICIPANT_SESSION_TTL_SECONDS).run();
    if (Number(touched.meta?.changes || 0) !== 1) {
      const persisted = await activeSessionAfterMutation(session);
      if (!persisted || persisted.lastSeenAt < now)
        throw new Error("PARTICIPANT_SESSION_CONFLICT");
      session.lastSeenAt = persisted.lastSeenAt;
    } else session.lastSeenAt = now;
  }
  return session;
}

export async function activeParticipantSessionByMediaIdentity(roomId: string, identity: string) {
  return getDatabase().prepare(
    `${SESSION_SELECT} WHERE room_id=? AND media_identity=? AND active=1 LIMIT 1`,
  ).bind(roomId, identity).first<ClassParticipantSession>();
}

export async function markPublisherMediaState(
  session: ClassParticipantSession,
  publishing: boolean,
) {
  const now = nowSeconds();
  const result = await getDatabase().prepare(`UPDATE class_participant_sessions SET
    publisher_started_at=CASE
      WHEN ?=1 THEN COALESCE(publisher_started_at,?) ELSE NULL END,
    publisher_interrupted_at=CASE WHEN ?=1 THEN NULL ELSE publisher_interrupted_at END,
    last_seen_at=? WHERE id=? AND token_hash=? AND active=1`).bind(
      publishing ? 1 : 0,
      now,
      publishing ? 1 : 0,
      now,
      session.id,
      session.tokenHash,
    ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const persisted = await activeSessionAfterMutation(session);
    const matches = publishing
      ? Boolean(persisted?.publisherStartedAt)
      : persisted?.publisherStartedAt === null;
    if (!matches) throw new Error("PARTICIPANT_SESSION_CONFLICT");
    session.publisherStartedAt = persisted!.publisherStartedAt;
  } else session.publisherStartedAt = publishing ? (session.publisherStartedAt || now) : null;
}

export async function beginProviderParticipantAttempt(
  session: ClassParticipantSession,
  providerMeetingId: string,
) {
  const now = nowSeconds();
  const id = createId();
  const customParticipantId = `sl:${session.id}:${id}`;
  await getDatabase().prepare(`INSERT INTO provider_participant_create_attempts(
    id,room_id,participant_session_id,provider_meeting_id,custom_participant_id,
    session_token_hash,next_check_at,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?, ?,?) ON CONFLICT(participant_session_id) DO UPDATE SET
    id=excluded.id,provider_meeting_id=excluded.provider_meeting_id,
    custom_participant_id=excluded.custom_participant_id,session_token_hash=excluded.session_token_hash,
    not_found_confirmations=0,attempts=0,next_check_at=excluded.next_check_at,
    last_error=NULL,created_at=excluded.created_at,updated_at=excluded.updated_at`)
    .bind(id, session.roomId, session.id, providerMeetingId, customParticipantId,
      session.tokenHash, now + 30, now, now).run();
  return { id, customParticipantId };
}

export async function attachProviderParticipant(
  session: ClassParticipantSession,
  attemptId: string,
  providerMeetingId: string,
  participantId: string,
) {
  const result = await getDatabase().prepare(`UPDATE class_participant_sessions SET
    provider_meeting_id=?,provider_participant_id=?
    WHERE id=? AND active=1 AND token_hash=?`).bind(
    providerMeetingId,
    participantId,
    session.id,
    session.tokenHash,
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const persisted = await activeSessionAfterMutation(session);
    if (persisted?.providerMeetingId === providerMeetingId
      && persisted.providerParticipantId === participantId) {
      session.providerMeetingId = providerMeetingId;
      session.providerParticipantId = participantId;
      await getDatabase().prepare("DELETE FROM provider_participant_create_attempts WHERE id=?")
        .bind(attemptId).run();
      return;
    }
    const now = nowSeconds();
    await getDatabase().prepare(`INSERT INTO provider_participant_cleanup_jobs(
      provider_meeting_id,provider_participant_id,room_id,participant_session_id,
      attempts,next_attempt_at,requested_at,updated_at
    ) VALUES(?,?,?,?,0,?,?,?) ON CONFLICT(provider_meeting_id,provider_participant_id)
      DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
      .bind(providerMeetingId, participantId, session.roomId, session.id, now, now, now).run();
    throw new Error("PARTICIPANT_SESSION_REPLACED");
  }
  await getDatabase().prepare("DELETE FROM provider_participant_create_attempts WHERE id=?")
    .bind(attemptId).run();
}

export async function claimCompanionParticipant(
  session: ClassParticipantSession,
  publisher = true,
) {
  try {
    const result = await getDatabase().prepare(`UPDATE class_participant_sessions SET
      companion_reserved=1,companion_publisher_reserved=?
      WHERE id=? AND token_hash=? AND active=1 AND companion_reserved=0
        AND companion_provider_participant_id IS NULL`).bind(
      publisher ? 1 : 0,
      session.id,
      session.tokenHash,
    ).run();
    if (Number(result.meta?.changes || 0) !== 1) {
      const persisted = await activeSessionAfterMutation(session);
      if (persisted?.companionReserved !== 1
        || persisted.companionPublisherReserved !== (publisher ? 1 : 0)
        || persisted.companionProviderParticipantId !== null)
        throw new Error("PARTICIPANT_SESSION_CONFLICT");
    }
    session.companionReserved = 1;
    session.companionPublisherReserved = publisher ? 1 : 0;
  } catch (error) {
    const code = sessionError(error);
    if (code) throw new Error(code);
    throw error;
  }
}

export async function attachCompanionParticipant(
  session: ClassParticipantSession,
  attemptId: string,
  providerMeetingId: string,
  participantId: string,
) {
  const result = await getDatabase().prepare(`UPDATE class_participant_sessions SET
    provider_meeting_id=?,companion_provider_participant_id=?
    WHERE id=? AND active=1 AND token_hash=? AND companion_reserved=1`).bind(
    providerMeetingId,
    participantId,
    session.id,
    session.tokenHash,
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const persisted = await activeSessionAfterMutation(session);
    if (persisted?.providerMeetingId !== providerMeetingId
      || persisted.companionProviderParticipantId !== participantId) {
      const now = nowSeconds();
      await getDatabase().prepare(`INSERT INTO provider_participant_cleanup_jobs(
        provider_meeting_id,provider_participant_id,room_id,participant_session_id,
        attempts,next_attempt_at,requested_at,updated_at
      ) VALUES(?,?,?,?,0,?,?,?) ON CONFLICT(provider_meeting_id,provider_participant_id)
        DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
        .bind(providerMeetingId, participantId, session.roomId, session.id, now, now, now).run();
      throw new Error("PARTICIPANT_SESSION_REPLACED");
    }
  }
  session.providerMeetingId = providerMeetingId;
  session.companionProviderParticipantId = participantId;
  await getDatabase().prepare("DELETE FROM provider_participant_create_attempts WHERE id=?")
    .bind(attemptId).run();
}

export async function releaseCompanionParticipant(session: ClassParticipantSession) {
  if (session.providerMeetingId && session.companionProviderParticipantId) {
    const now = nowSeconds();
    await getDatabase().prepare(`INSERT INTO provider_participant_cleanup_jobs(
      provider_meeting_id,provider_participant_id,room_id,participant_session_id,
      attempts,next_attempt_at,requested_at,updated_at
    ) VALUES(?,?,?,?,0,?,?,?) ON CONFLICT(provider_meeting_id,provider_participant_id)
      DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
      .bind(session.providerMeetingId, session.companionProviderParticipantId,
        session.roomId, session.id, now, now, now).run();
  }
  await getDatabase().prepare(`UPDATE class_participant_sessions SET
    companion_provider_participant_id=NULL,companion_reserved=0,
    companion_publisher_reserved=0 WHERE id=? AND token_hash=? AND active=1`).bind(
    session.id,
    session.tokenHash,
  ).run();
  session.companionProviderParticipantId = null;
  session.companionReserved = 0;
  session.companionPublisherReserved = 0;
}

export async function abandonDefiniteParticipantAttempt(attemptId: string, error: unknown) {
  if (providerParticipantCreateFailureIsDefinite(error)) {
    await getDatabase().prepare("DELETE FROM provider_participant_create_attempts WHERE id=?")
      .bind(attemptId).run();
    return true;
  } else {
    const message = error instanceof Error ? error.message.slice(0, 240) : "Ambiguous provider response";
    await getDatabase().prepare(`UPDATE provider_participant_create_attempts SET
      attempts=attempts+1,next_check_at=?,last_error=?,updated_at=? WHERE id=?`)
      .bind(nowSeconds() + 30, message, nowSeconds(), attemptId).run();
    return false;
  }
}

export async function reservePublisher(session: ClassParticipantSession) {
  try {
    const result = await getDatabase().prepare(
      "UPDATE class_participant_sessions SET publisher_reserved=1 WHERE id=? AND token_hash=? AND active=1",
    ).bind(session.id, session.tokenHash).run();
    if (Number(result.meta?.changes || 0) !== 1) {
      const persisted = await activeSessionAfterMutation(session);
      if (persisted?.publisherReserved !== 1)
        throw new Error("PARTICIPANT_SESSION_CONFLICT");
    }
    session.publisherReserved = 1;
    return session;
  } catch (error) {
    const code = sessionError(error);
    if (code) throw new Error(code);
    throw error;
  }
}

export async function releasePublisherIfIdle(session: ClassParticipantSession) {
  await getDatabase().prepare(
    "UPDATE class_participant_sessions SET publisher_reserved=0 WHERE id=? AND token_hash=? AND active=1",
  ).bind(session.id, session.tokenHash).run();
  session.publisherReserved = 0;
}

async function queueSessionProviderRemoval(session: ClassParticipantSession) {
  if (!session.providerMeetingId) return;
  const now = nowSeconds();
  for (const participantId of [session.providerParticipantId, session.companionProviderParticipantId]) {
    if (!participantId) continue;
    await getDatabase().prepare(`INSERT INTO provider_participant_cleanup_jobs(
      provider_meeting_id,provider_participant_id,room_id,participant_session_id,
      attempts,next_attempt_at,requested_at,updated_at
    ) VALUES(?,?,?,?,0,?,?,?) ON CONFLICT(provider_meeting_id,provider_participant_id)
      DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
      .bind(session.providerMeetingId, participantId, session.roomId,
        session.id, now, now, now).run();
  }
}

export async function revokeParticipantSession(
  session: ClassParticipantSession,
  reason: "leave" | "expired" | "moderator_kick" | "generation_end" = "leave",
) {
  await queueSessionProviderRemoval(session);
  const now = nowSeconds();
  await getDatabase().prepare(`UPDATE class_participant_sessions SET
    active=0,publisher_reserved=0,companion_reserved=0,companion_publisher_reserved=0,
    revoked_at=?,revocation_reason=? WHERE id=? AND active=1`)
    .bind(now, reason, session.id).run();
  session.active = 0;
}

export async function heartbeatParticipantSession(session: ClassParticipantSession) {
  const now = nowSeconds();
  const result = await getDatabase().prepare(
    "UPDATE class_participant_sessions SET last_seen_at=? WHERE id=? AND token_hash=? AND active=1",
  ).bind(now, session.id, session.tokenHash).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const persisted = await activeSessionAfterMutation(session);
    if (!persisted || persisted.lastSeenAt < now)
      throw new Error("PARTICIPANT_SESSION_EXPIRED");
    session.lastSeenAt = persisted.lastSeenAt;
  } else session.lastSeenAt = now;
}

export async function cleanupExpiredParticipantSessions(roomId: string, limit = 25) {
  const rows = (await getDatabase().prepare(
    `${SESSION_SELECT} WHERE room_id=? AND active=1 AND last_seen_at<=? ORDER BY last_seen_at,id LIMIT ?`,
  ).bind(roomId, nowSeconds() - PARTICIPANT_SESSION_TTL_SECONDS,
    Math.max(1, Math.min(100, Math.floor(limit)))).run<ClassParticipantSession>()).results || [];
  for (const session of rows) await revokeParticipantSession(session, "expired");
  return rows.length;
}

export async function cleanupRevokedProviderParticipants(limit = 25) {
  const now = nowSeconds();
  const jobs = (await getDatabase().prepare(`SELECT provider_meeting_id AS providerMeetingId,
    provider_participant_id AS providerParticipantId,attempts FROM provider_participant_cleanup_jobs
    WHERE next_attempt_at<=? ORDER BY next_attempt_at,updated_at LIMIT ?`)
    .bind(now, Math.max(1, Math.min(100, Math.floor(limit))))
    .run<{ providerMeetingId: string; providerParticipantId: string; attempts: number }>()).results || [];
  let completed = 0;
  for (const job of jobs) {
    try {
      await removeProviderParticipant(job.providerMeetingId, job.providerParticipantId);
      await getDatabase().prepare(
        "DELETE FROM provider_participant_cleanup_jobs WHERE provider_meeting_id=? AND provider_participant_id=?",
      ).bind(job.providerMeetingId, job.providerParticipantId).run();
      completed += 1;
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      await getDatabase().prepare(`UPDATE provider_participant_cleanup_jobs SET
        attempts=?,next_attempt_at=?,last_error=?,updated_at=?
        WHERE provider_meeting_id=? AND provider_participant_id=?`).bind(
        attempts,
        now + Math.min(3_600, 2 ** Math.min(10, attempts)),
        error instanceof Error ? error.message.slice(0, 240) : "Provider cleanup failed",
        now,
        job.providerMeetingId,
        job.providerParticipantId,
      ).run();
    }
  }
  return { processed: jobs.length, completed };
}

export async function recoverAmbiguousParticipantCreates(limit = 10) {
  const now = nowSeconds();
  const attempts = (await getDatabase().prepare(`SELECT id,participant_session_id AS participantSessionId,
    provider_meeting_id AS providerMeetingId,
    custom_participant_id AS customParticipantId,not_found_confirmations AS notFoundConfirmations,
    attempts FROM provider_participant_create_attempts WHERE next_check_at<=?
    ORDER BY next_check_at,updated_at LIMIT ?`).bind(now, Math.max(1, Math.min(25, limit)))
    .run<{ id: string; participantSessionId: string; providerMeetingId: string; customParticipantId: string; notFoundConfirmations: number; attempts: number }>()).results || [];
  const clearRecoveredCompanionClaim = async (participantSessionId: string) => {
    await getDatabase().prepare(`UPDATE class_participant_sessions SET
      companion_reserved=0,companion_publisher_reserved=0
      WHERE id=? AND companion_provider_participant_id IS NULL`).bind(participantSessionId).run();
  };
  for (const attempt of attempts) {
    try {
      const participant = await findProviderParticipantByCustomId(
        attempt.providerMeetingId,
        attempt.customParticipantId,
      );
      if (participant?.id) {
        await removeProviderParticipant(attempt.providerMeetingId, participant.id);
        await getDatabase().prepare("DELETE FROM provider_participant_create_attempts WHERE id=?")
          .bind(attempt.id).run();
        await clearRecoveredCompanionClaim(attempt.participantSessionId);
        continue;
      }
      const confirmations = Number(attempt.notFoundConfirmations || 0) + 1;
      if (confirmations >= 3) {
        await getDatabase().prepare("DELETE FROM provider_participant_create_attempts WHERE id=?")
          .bind(attempt.id).run();
        await clearRecoveredCompanionClaim(attempt.participantSessionId);
      } else {
        await getDatabase().prepare(`UPDATE provider_participant_create_attempts SET
          not_found_confirmations=?,attempts=attempts+1,next_check_at=?,last_error=NULL,updated_at=? WHERE id=?`)
          .bind(confirmations, now + 60, now, attempt.id).run();
      }
    } catch (error) {
      const failures = Number(attempt.attempts || 0) + 1;
      await getDatabase().prepare(`UPDATE provider_participant_create_attempts SET
        attempts=?,next_check_at=?,last_error=?,updated_at=? WHERE id=?`).bind(
        failures,
        now + Math.min(3_600, 2 ** Math.min(10, failures)),
        error instanceof Error ? error.message.slice(0, 240) : "Participant recovery failed",
        now,
        attempt.id,
      ).run();
    }
  }
  return attempts.length;
}

export async function moderatorBanParticipant(input: {
  roomId: string;
  humanIdentity: string;
  displayName: string;
  userId: string | null;
  bannedByUserId: string;
}) {
  const now = nowSeconds();
  await getDatabase().prepare(`INSERT INTO class_participant_bans(
    room_id,human_identity,user_id,display_name,banned_by_user_id,reason,banned_at
  ) VALUES(?,?,?,?,?,'moderator_kick',?) ON CONFLICT(room_id,human_identity)
    DO UPDATE SET user_id=excluded.user_id,display_name=excluded.display_name,
      banned_by_user_id=excluded.banned_by_user_id,banned_at=excluded.banned_at`)
    .bind(input.roomId, input.humanIdentity, input.userId, input.displayName,
      input.bannedByUserId, now).run();
  const sessions = (await getDatabase().prepare(
    `${SESSION_SELECT} WHERE room_id=? AND human_identity=? AND active=1`,
  ).bind(input.roomId, input.humanIdentity).run<ClassParticipantSession>()).results || [];
  for (const session of sessions) await revokeParticipantSession(session, "moderator_kick");
  return sessions.length;
}

export async function allowParticipantReentry(roomId: string, humanIdentity: string) {
  await getDatabase().prepare(
    "DELETE FROM class_participant_bans WHERE room_id=? AND human_identity=?",
  ).bind(roomId, humanIdentity).run();
}
