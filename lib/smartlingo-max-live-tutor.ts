import { OPEN_TUTOR_PAID_SECONDS } from "./smartlingo-open-tutor";
import { hangupSmartAiLiveVoice } from "./smartlingo-ai-gateway";

type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success?: boolean }>;
  all<T>(): Promise<{ results?: T[] }>;
};
export type LiveTutorDatabase = { prepare(sql: string): Statement };

type TutorSession = {
  id: string; userId: string; language: string; usageDay: number;
  usedSeconds: number; lastActiveAt: number;
};
type LiveCall = {
  id: string; userId: string; tutorSessionId: string; usageDay: number;
  providerCallId: string | null; startedAt: number; deadlineAt: number;
  reservedSeconds: number; status: string;
};

export const MAX_LIVE_HEARTBEAT_GRACE_SECONDS = 45;
export const MAX_LIVE_CONNECT_GRACE_SECONDS = 30;
const SELECT_CALL = `SELECT id,user_id AS userId,tutor_session_id AS tutorSessionId,
  usage_day AS usageDay,provider_call_id AS providerCallId,started_at AS startedAt,
  deadline_at AS deadlineAt,reserved_seconds AS reservedSeconds,status
  FROM smartlingo_max_live_tutor_calls`;

export async function reserveMaxLiveTutorCall(input: {
  database: LiveTutorDatabase; userId: string; tutorSessionId: string;
  language: string; limit: number; now: number; id: string; accessEndsAt?: number;
}) {
  const { database, userId, tutorSessionId, language, limit, now, id } = input;
  if (limit <= 0 || limit > OPEN_TUTOR_PAID_SECONDS) return null;
  const day = Math.floor(now / 86_400);
  const row = await database.prepare(`SELECT id,user_id AS userId,target_language AS language,
    usage_day AS usageDay,used_seconds AS usedSeconds,last_active_at AS lastActiveAt
    FROM smartlingo_max_tutor_sessions WHERE id=? AND user_id=? AND usage_day=? LIMIT 1`)
    .bind(tutorSessionId, userId, day).first<TutorSession>();
  if (!row || row.language !== language || row.usedSeconds >= limit) return null;
  const reservedSeconds = limit - row.usedSeconds;
  const deadlineAt = Math.min(now + reservedSeconds, (day + 1) * 86_400,
    input.accessEndsAt || Number.POSITIVE_INFINITY);
  if (deadlineAt <= now) return null;
  try {
    const inserted = await database.prepare(`INSERT INTO smartlingo_max_live_tutor_calls
      (id,user_id,tutor_session_id,usage_day,language,provider_call_id,started_at,
       last_heartbeat_at,deadline_at,reserved_seconds,status)
      VALUES(?,?,?,?,?,NULL,?,?,?,?, 'connecting') RETURNING id`)
      .bind(id, userId, tutorSessionId, day, language, now, now, deadlineAt, reservedSeconds)
      .first<{ id: string }>();
    if (!inserted) return null;
  } catch { return null; } // A unique active-call index prevents concurrent connections.
  const charged = await database.prepare(`UPDATE smartlingo_max_tutor_sessions
    SET used_seconds=?,last_active_at=?,updated_at=?
    WHERE id=? AND user_id=? AND usage_day=? AND used_seconds=? RETURNING id`)
    .bind(limit, now, now, tutorSessionId, userId, day, row.usedSeconds).first<{ id: string }>();
  if (!charged) {
    await database.prepare(`DELETE FROM smartlingo_max_live_tutor_calls
      WHERE id=? AND user_id=? AND status='connecting' AND provider_call_id IS NULL`)
      .bind(id, userId).run();
    return null;
  }
  return { id, reservedSeconds, deadlineAt };
}

export async function activateMaxLiveTutorCall(database: LiveTutorDatabase, id: string, userId: string, providerCallId: string) {
  if (!/^rtc_[A-Za-z0-9_-]{6,128}$/.test(providerCallId)) return false;
  const active = await database.prepare(`UPDATE smartlingo_max_live_tutor_calls
    SET provider_call_id=?,status='active' WHERE id=? AND user_id=?
      AND status='connecting' AND provider_call_id IS NULL RETURNING id`)
    .bind(providerCallId, id, userId).first<{ id: string }>();
  return Boolean(active);
}

export async function heartbeatMaxLiveTutorCall(database: LiveTutorDatabase, id: string, userId: string, now: number) {
  const row = await database.prepare(`UPDATE smartlingo_max_live_tutor_calls
    SET last_heartbeat_at=? WHERE id=? AND user_id=? AND status='active'
      AND deadline_at>? RETURNING deadline_at AS deadlineAt`)
    .bind(now, id, userId, now).first<{ deadlineAt: number }>();
  return row ? Math.max(0, row.deadlineAt - now) : null;
}

export async function closeMaxLiveTutorCall(input: {
  database: LiveTutorDatabase; id: string; userId?: string; now: number;
  credentialSource?: Record<string, unknown>; fetcher?: typeof fetch;
}) {
  const { database, id, now } = input;
  const row = await database.prepare(`${SELECT_CALL} WHERE id=?${input.userId ? " AND user_id=?" : ""} LIMIT 1`)
    .bind(...(input.userId ? [id, input.userId] : [id])).first<LiveCall>();
  if (!row) return null;
  if (row.status === "closed") return { usedSeconds: null, ended: true };
  if (row.providerCallId) {
    if (!await hangupSmartAiLiveVoice(row.providerCallId, input)) return null;
  }
  const used = row.providerCallId ? Math.min(row.reservedSeconds, Math.max(0, now - row.startedAt)) : 0;
  const ended = await database.prepare(`UPDATE smartlingo_max_live_tutor_calls
    SET status='closed',ended_at=?,used_seconds=?
    WHERE id=? AND status IN ('connecting','active','closing') RETURNING id`)
    .bind(now, used, id).first<{ id: string }>();
  if (!ended) return { usedSeconds: null, ended: true };
  const refunded = await database.prepare(`SELECT used_seconds AS usedSeconds
    FROM smartlingo_max_tutor_sessions WHERE id=? AND user_id=? AND usage_day=? LIMIT 1`)
    .bind(row.tutorSessionId, row.userId, row.usageDay)
    .first<{ usedSeconds: number }>();
  return { usedSeconds: refunded?.usedSeconds ?? null, ended: true };
}

export async function cleanupMaxLiveTutorCalls(input: {
  database: LiveTutorDatabase; now: number; credentialSource?: Record<string, unknown>; fetcher?: typeof fetch;
}) {
  const { results } = await input.database.prepare(`SELECT id FROM smartlingo_max_live_tutor_calls
    WHERE (status='connecting' AND started_at<=?)
       OR (status IN ('active','closing') AND (deadline_at<=? OR last_heartbeat_at<=?))
    ORDER BY started_at LIMIT 40`)
    .bind(input.now - MAX_LIVE_CONNECT_GRACE_SECONDS, input.now,
      input.now - MAX_LIVE_HEARTBEAT_GRACE_SECONDS).all<{ id: string }>();
  for (const row of results || []) {
    await closeMaxLiveTutorCall({ ...input, id: row.id }).catch(() => null);
  }
  await input.database.prepare(`DELETE FROM smartlingo_max_live_tutor_calls
    WHERE status='closed' AND ended_at<?`).bind(input.now - 7 * 86_400).run();
}
