import { createId, getDatabase } from "./auth";

const WINDOW_SECONDS = 60;
const PASSWORD_WINDOW_SECONDS = 15 * 60;

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

async function sha256(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function networkKey(request: Request) {
  const address = request.headers.get("cf-connecting-ip")?.trim();
  if (!address) throw new Error("CLASS_ENTRY_NETWORK_IDENTITY_UNAVAILABLE");
  return (await sha256(address)).slice(0, 32);
}

function limited(retryAfter = 60, message = "Too many course entry requests") {
  return Response.json({ error: message, errorCode: "CLASS_ENTRY_LIMITED" }, {
    status: 429,
    headers: { "retry-after": String(Math.max(1, retryAfter)), "cache-control": "no-store" },
  });
}

export async function enforceClassJoinLimit(request: Request, roomId: string) {
  let actor: string;
  try { actor = await networkKey(request); }
  catch {
    return Response.json({ error: "Course entry protection is unavailable" }, {
      status: 503,
      headers: { "retry-after": "60", "cache-control": "no-store" },
    });
  }
  const now = nowSeconds();
  const scope = `class-join:${roomId}`;
  const result = await getDatabase().prepare(`INSERT INTO account_request_limits(
    scope,actor_key,window_started_at,request_count,blocked_until,updated_at
  ) VALUES(?,?,?,1,0,?) ON CONFLICT(scope,actor_key) DO UPDATE SET
    window_started_at=CASE WHEN account_request_limits.window_started_at<=? THEN excluded.window_started_at ELSE account_request_limits.window_started_at END,
    request_count=CASE WHEN account_request_limits.window_started_at<=? THEN 1 ELSE account_request_limits.request_count+1 END,
    blocked_until=CASE
      WHEN account_request_limits.blocked_until>? THEN account_request_limits.blocked_until
      WHEN account_request_limits.window_started_at>? AND account_request_limits.request_count>=119 THEN ?
      ELSE 0 END,
    updated_at=excluded.updated_at
  RETURNING request_count AS requestCount,blocked_until AS blockedUntil`)
    .bind(scope, actor, now, now, now - WINDOW_SECONDS, now - WINDOW_SECONDS,
      now, now - WINDOW_SECONDS, now + WINDOW_SECONDS)
    .first<{ requestCount: number; blockedUntil: number }>();
  return result?.blockedUntil && result.blockedUntil > now
    ? limited(result.blockedUntil - now)
    : null;
}

async function passwordActor(request: Request, roomId: string, userId: string | null) {
  const network = await networkKey(request);
  return await sha256(`class-password:${roomId}:${userId ? `member:${userId}` : `network:${network}`}`);
}

export async function blockedClassPasswordAttempt(
  request: Request,
  roomId: string,
  userId: string | null,
) {
  let actor: string;
  try { actor = await passwordActor(request, roomId, userId); }
  catch {
    return Response.json({ error: "Course password protection is unavailable" }, {
      status: 503,
      headers: { "retry-after": "60", "cache-control": "no-store" },
    });
  }
  const now = nowSeconds();
  const state = await getDatabase().prepare(
    "SELECT blocked_until AS blockedUntil,last_failed_at AS lastFailedAt FROM class_password_failures WHERE room_id=? AND actor_key=? LIMIT 1",
  ).bind(roomId, actor).first<{ blockedUntil: number; lastFailedAt: number }>();
  if (state?.blockedUntil && state.blockedUntil > now)
    return limited(state.blockedUntil - now, "Too many course password attempts");
  if (state && state.lastFailedAt <= now - PASSWORD_WINDOW_SECONDS)
    await getDatabase().prepare("DELETE FROM class_password_failures WHERE room_id=? AND actor_key=?")
      .bind(roomId, actor).run();
  return null;
}

export async function recordClassPasswordFailure(
  request: Request,
  roomId: string,
  userId: string | null,
) {
  const actor = await passwordActor(request, roomId, userId);
  const now = nowSeconds();
  const stale = now - PASSWORD_WINDOW_SECONDS;
  const state = await getDatabase().prepare(`INSERT INTO class_password_failures(
    id,room_id,actor_key,failure_count,window_started_at,last_failed_at,blocked_until
  ) VALUES(?,?,?,1,?,?,?) ON CONFLICT(room_id,actor_key) DO UPDATE SET
    failure_count=CASE WHEN class_password_failures.last_failed_at<=? THEN 1 ELSE class_password_failures.failure_count+1 END,
    window_started_at=CASE WHEN class_password_failures.last_failed_at<=? THEN excluded.window_started_at ELSE class_password_failures.window_started_at END,
    last_failed_at=excluded.last_failed_at,
    blocked_until=CASE
      WHEN class_password_failures.last_failed_at<=? THEN excluded.last_failed_at
      WHEN class_password_failures.failure_count<2 THEN excluded.last_failed_at
      WHEN class_password_failures.failure_count=2 THEN excluded.last_failed_at+1
      WHEN class_password_failures.failure_count=3 THEN excluded.last_failed_at+2
      WHEN class_password_failures.failure_count=4 THEN excluded.last_failed_at+4
      WHEN class_password_failures.failure_count=5 THEN excluded.last_failed_at+8
      WHEN class_password_failures.failure_count=6 THEN excluded.last_failed_at+16
      WHEN class_password_failures.failure_count=7 THEN excluded.last_failed_at+32
      WHEN class_password_failures.failure_count=8 THEN excluded.last_failed_at+60
      WHEN class_password_failures.failure_count=9 THEN excluded.last_failed_at+120
      ELSE excluded.last_failed_at+300 END
    RETURNING blocked_until AS blockedUntil`).bind(
      createId(), roomId, actor, now, now, now, stale, stale, stale,
    ).first<{ blockedUntil: number }>();
  return state?.blockedUntil && state.blockedUntil > now
    ? limited(state.blockedUntil - now, "Too many course password attempts")
    : null;
}

export async function clearClassPasswordFailures(
  request: Request,
  roomId: string,
  userId: string | null,
) {
  const actor = await passwordActor(request, roomId, userId);
  await getDatabase().prepare("DELETE FROM class_password_failures WHERE room_id=? AND actor_key=?")
    .bind(roomId, actor).run();
}
