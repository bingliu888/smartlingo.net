import { createId, getDatabase } from "./auth";
import type { ClassRoom } from "./live-classrooms";
import {
  createProviderMeeting,
  deactivateProviderMeeting,
  findProviderMeetingsByExactTitle,
  kickAllProviderParticipants,
  providerMeetingCreateFailureIsDefinite,
  providerMeetingCreateTitle,
  stopProviderLivestreamForTeardown,
} from "./live-class-realtimekit";
import { MAX_PROVIDER_SESSION_SECONDS } from "./class-session-policy";

const PROVIDER_CREATE_RECOVERY_SECONDS = 15 * 60;

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

export function classProviderGenerationExpired(
  room: Pick<ClassRoom, "providerMeetingId" | "providerGenerationStartedAt">,
  now = nowSeconds(),
) {
  return Boolean(
    room.providerMeetingId
      && room.providerGenerationStartedAt
      && room.providerGenerationStartedAt <= now - MAX_PROVIDER_SESSION_SECONDS,
  );
}

function retryAt(attempts: number, now = nowSeconds()) {
  return now + Math.min(3_600, 2 ** Math.min(10, Math.max(1, attempts)));
}

export async function queueClassProviderTeardown(input: {
  roomId: string;
  providerMeetingId: string;
  generation: number;
  reason: "delete" | "idle" | "closed" | "duration" | "create_loser";
  blocksJoin?: boolean;
}) {
  const db = getDatabase();
  const now = nowSeconds();
  await db.batch([
    db.prepare(`INSERT INTO class_provider_teardown_jobs(
      provider_meeting_id,room_id,generation,reason,blocks_join,attempts,
      next_attempt_at,requested_at,updated_at
    ) VALUES(?,?,?,?,?,0,?,?,?) ON CONFLICT(provider_meeting_id) DO UPDATE SET
      reason=CASE WHEN class_provider_teardown_jobs.reason='delete' THEN 'delete' ELSE excluded.reason END,
      blocks_join=MAX(blocks_join,excluded.blocks_join),
      next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
      .bind(input.providerMeetingId, input.roomId, input.generation, input.reason,
        input.blocksJoin === false ? 0 : 1, now, now, now),
    db.prepare(`UPDATE live_class_rooms SET provider_meeting_id=NULL,stream_active=0,mute_all=0,
      live_started_at=NULL,provider_generation_started_at=NULL,provider_create_deadline_at=NULL,
      updated_at=? WHERE id=? AND provider_meeting_id=?`)
      .bind(now, input.roomId, input.providerMeetingId),
    db.prepare(`UPDATE class_participant_sessions SET active=0,publisher_reserved=0,
      companion_reserved=0,companion_publisher_reserved=0,revoked_at=?,
      revocation_reason='generation_end'
      WHERE room_id=? AND generation=? AND active=1`)
      .bind(now, input.roomId, input.generation),
    db.prepare(`INSERT OR IGNORE INTO provider_recording_cleanup_jobs(
      provider_recording_id,room_id,attempts,next_attempt_at,requested_at,updated_at
    ) SELECT provider_recording_id,room_id,0,?,?,? FROM class_recording_claims
      WHERE attempted_provider_meeting_id=? AND provider_recording_id IS NOT NULL`)
      .bind(now, now, now, input.providerMeetingId),
  ]);
}

export async function ensureClassProviderGeneration(room: ClassRoom) {
  const now = nowSeconds();
  const current = await getDatabase().prepare(`SELECT status,
    provider_meeting_id AS providerMeetingId,
    provider_generation AS providerGeneration,
    provider_generation_started_at AS providerGenerationStartedAt,
    live_started_at AS liveStartedAt,stream_active AS streamActive,
    EXISTS(SELECT 1 FROM class_deletion_jobs WHERE room_id=live_class_rooms.id) AS deleting
    FROM live_class_rooms WHERE id=? LIMIT 1`).bind(room.id).first<{
      status: string;
      providerMeetingId: string | null;
      providerGeneration: number;
      providerGenerationStartedAt: number | null;
      liveStartedAt: number | null;
      streamActive: number;
      deleting: number;
    }>();
  if (!current || current.status !== "active" || current.deleting)
    throw new Error("CLASS_DELETION_PENDING");
  room.providerMeetingId = current.providerMeetingId;
  room.providerGeneration = current.providerGeneration;
  room.providerGenerationStartedAt = current.providerGenerationStartedAt;
  room.liveStartedAt = current.liveStartedAt;
  room.streamActive = current.streamActive;
  if (room.providerMeetingId && !room.providerGenerationStartedAt) {
    const result = await getDatabase().prepare(`UPDATE live_class_rooms SET
      provider_generation=CASE WHEN provider_generation<1 THEN 1 ELSE provider_generation END,
      provider_generation_started_at=?,live_started_at=COALESCE(live_started_at,?),
      updated_at=? WHERE id=? AND provider_meeting_id=? AND provider_generation_started_at IS NULL`)
      .bind(now, now, now, room.id, room.providerMeetingId).run();
    if (Number(result.meta?.changes || 0) === 1) {
      room.providerGeneration = Math.max(1, room.providerGeneration);
      room.providerGenerationStartedAt = now;
      room.liveStartedAt ||= now;
    }
  }
  if (room.providerMeetingId && !classProviderGenerationExpired(room, now))
    return room.providerMeetingId;
  if (room.providerMeetingId) {
    await queueClassProviderTeardown({
      roomId: room.id,
      providerMeetingId: room.providerMeetingId,
      generation: room.providerGeneration,
      reason: "duration",
    });
    room.providerMeetingId = null;
    room.providerGenerationStartedAt = null;
  }

  const db = getDatabase();
  const blocking = await db.prepare(
    "SELECT 1 AS blocked FROM class_provider_teardown_jobs WHERE room_id=? AND blocks_join=1 LIMIT 1",
  ).bind(room.id).first<{ blocked: number }>();
  if (blocking) throw new Error("CLASS_PROVIDER_TEARDOWN_PENDING");

  const attempt = await db.prepare(`SELECT correlation_id AS correlationId,
    provider_title AS providerTitle,provider_meeting_id AS providerMeetingId,
    deadline_at AS deadlineAt FROM class_provider_create_attempts WHERE room_id=? LIMIT 1`)
    .bind(room.id).first<{
      correlationId: string;
      providerTitle: string;
      providerMeetingId: string | null;
      deadlineAt: number;
    }>();
  if (attempt?.providerMeetingId) {
    const attached = await db.prepare(`UPDATE live_class_rooms SET provider_meeting_id=?,
      provider_generation=provider_generation+1,provider_generation_started_at=?,
      live_started_at=?,stream_active=1,provider_create_deadline_at=NULL,updated_at=?
      WHERE id=? AND status='active' AND provider_meeting_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM class_deletion_jobs WHERE room_id=?)`).bind(
      attempt.providerMeetingId,
      now,
      now,
      now,
      room.id,
      room.id,
    ).run();
    if (Number(attached.meta?.changes || 0) === 1) {
      await db.prepare("DELETE FROM class_provider_create_attempts WHERE room_id=?")
        .bind(room.id).run();
      room.providerMeetingId = attempt.providerMeetingId;
      room.providerGeneration += 1;
      room.providerGenerationStartedAt = now;
      room.liveStartedAt = now;
      room.streamActive = 1;
      return attempt.providerMeetingId;
    }
    const deleting = await db.prepare(
      "SELECT 1 FROM class_deletion_jobs WHERE room_id=? LIMIT 1",
    ).bind(room.id).first();
    if (deleting) {
      await queueClassProviderTeardown({
        roomId: room.id,
        providerMeetingId: attempt.providerMeetingId,
        generation: room.providerGeneration + 1,
        reason: "create_loser",
      });
      await db.prepare("DELETE FROM class_provider_create_attempts WHERE room_id=?")
        .bind(room.id).run();
      throw new Error("CLASS_DELETION_PENDING");
    }
  }
  if (attempt) throw new Error("CLASS_PROVIDER_CREATE_RECOVERY_PENDING");

  const correlationId = createId();
  const providerTitle = providerMeetingCreateTitle(room.title, correlationId);
  const deadlineAt = now + PROVIDER_CREATE_RECOVERY_SECONDS;
  const claimed = await db.prepare(`INSERT OR IGNORE INTO class_provider_create_attempts(
    correlation_id,room_id,provider_title,next_attempt_at,deadline_at,created_at,updated_at
  ) SELECT ?,?,?,?,?,?,? WHERE EXISTS(
    SELECT 1 FROM live_class_rooms WHERE id=? AND status='active'
  ) AND NOT EXISTS(
    SELECT 1 FROM class_deletion_jobs WHERE room_id=?
  )`).bind(
    correlationId,
    room.id,
    providerTitle,
    now + 30,
    deadlineAt,
    now,
    now,
    room.id,
    room.id,
  ).run();
  if (Number(claimed.meta?.changes || 0) !== 1) {
    const deleting = await db.prepare(
      "SELECT 1 FROM class_deletion_jobs WHERE room_id=? LIMIT 1",
    ).bind(room.id).first();
    if (deleting) throw new Error("CLASS_DELETION_PENDING");
    throw new Error("CLASS_PROVIDER_CREATE_RECOVERY_PENDING");
  }

  try {
    const provider = await createProviderMeeting(room.title, false,
      room.realtimeMode === "livestream", correlationId);
    if (!provider?.id) throw new Error("REALTIME_PROVIDER_MEETING_RESULT_MALFORMED");
    await db.prepare(`UPDATE class_provider_create_attempts SET provider_meeting_id=?,
      next_attempt_at=?,updated_at=? WHERE correlation_id=?`)
      .bind(provider.id, now, now, correlationId).run();
    const attached = await db.prepare(`UPDATE live_class_rooms SET provider_meeting_id=?,
      provider_generation=provider_generation+1,provider_generation_started_at=?,
      live_started_at=?,stream_active=1,provider_create_deadline_at=NULL,updated_at=?
      WHERE id=? AND status='active' AND provider_meeting_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM class_deletion_jobs WHERE room_id=?)`).bind(
      provider.id,
      now,
      now,
      now,
      room.id,
      room.id,
    ).run();
    if (Number(attached.meta?.changes || 0) !== 1) {
      await queueClassProviderTeardown({
        roomId: room.id,
        providerMeetingId: provider.id,
        generation: room.providerGeneration + 1,
        reason: "create_loser",
      });
      throw new Error("CLASS_PROVIDER_CREATE_LOST_RACE");
    }
    await db.prepare("DELETE FROM class_provider_create_attempts WHERE correlation_id=?")
      .bind(correlationId).run();
    room.providerMeetingId = provider.id;
    room.providerGeneration += 1;
    room.providerGenerationStartedAt = now;
    room.liveStartedAt = now;
    room.streamActive = 1;
    return provider.id;
  } catch (error) {
    if (providerMeetingCreateFailureIsDefinite(error)) {
      await db.prepare("DELETE FROM class_provider_create_attempts WHERE correlation_id=?")
        .bind(correlationId).run();
    } else {
      await db.prepare(`UPDATE class_provider_create_attempts SET discovery_attempts=discovery_attempts+1,
        next_attempt_at=?,last_error=?,updated_at=? WHERE correlation_id=?`).bind(
        now + 30,
        error instanceof Error ? error.message.slice(0, 240) : "Ambiguous provider create",
        now,
        correlationId,
      ).run();
    }
    throw error;
  }
}

export async function recoverClassProviderCreates(limit = 5) {
  const db = getDatabase();
  const now = nowSeconds();
  const attempts = (await db.prepare(`SELECT correlation_id AS correlationId,
    room_id AS roomId,provider_title AS providerTitle,provider_meeting_id AS providerMeetingId,
    discovery_attempts AS discoveryAttempts,no_match_confirmations AS noMatchConfirmations,
    deadline_at AS deadlineAt FROM class_provider_create_attempts
    WHERE next_attempt_at<=? ORDER BY next_attempt_at,updated_at LIMIT ?`)
    .bind(now, Math.max(1, Math.min(10, Math.floor(limit))))
    .run<{
      correlationId: string;
      roomId: string;
      providerTitle: string;
      providerMeetingId: string | null;
      discoveryAttempts: number;
      noMatchConfirmations: number;
      deadlineAt: number;
    }>()).results || [];
  for (const attempt of attempts) {
    try {
      let providers = attempt.providerMeetingId
        ? [{ id: attempt.providerMeetingId }]
        : await findProviderMeetingsByExactTitle(attempt.providerTitle);
      if (providers.length > 1) {
        for (const loser of providers.slice(1)) if (loser.id) {
          await queueClassProviderTeardown({
            roomId: attempt.roomId,
            providerMeetingId: loser.id,
            generation: 0,
            reason: "create_loser",
          });
        }
        providers = providers.slice(0, 1);
      }
      const providerId = providers[0]?.id;
      if (providerId) {
        const room = await db.prepare(`SELECT provider_meeting_id AS providerMeetingId,
          provider_generation AS providerGeneration FROM live_class_rooms WHERE id=? LIMIT 1`)
          .bind(attempt.roomId).first<{ providerMeetingId: string | null; providerGeneration: number }>();
        if (!room) {
          await queueClassProviderTeardown({
            roomId: attempt.roomId,
            providerMeetingId: providerId,
            generation: 0,
            reason: "create_loser",
          });
        } else if (!room.providerMeetingId) {
          const attached = await db.prepare(`UPDATE live_class_rooms SET provider_meeting_id=?,
            provider_generation=provider_generation+1,provider_generation_started_at=?,
            live_started_at=?,stream_active=1,provider_create_deadline_at=NULL,updated_at=?
            WHERE id=? AND status='active' AND provider_meeting_id IS NULL
              AND NOT EXISTS(SELECT 1 FROM class_deletion_jobs WHERE room_id=?)`)
            .bind(providerId, now, now, now, attempt.roomId, attempt.roomId).run();
          if (Number(attached.meta?.changes || 0) !== 1) {
            await queueClassProviderTeardown({
              roomId: attempt.roomId,
              providerMeetingId: providerId,
              generation: room.providerGeneration + 1,
              reason: "create_loser",
            });
          }
        } else if (room.providerMeetingId !== providerId) {
          await queueClassProviderTeardown({
            roomId: attempt.roomId,
            providerMeetingId: providerId,
            generation: room.providerGeneration + 1,
            reason: "create_loser",
          });
        }
        await db.prepare("DELETE FROM class_provider_create_attempts WHERE correlation_id=?")
          .bind(attempt.correlationId).run();
        continue;
      }
      const confirmations = Number(attempt.noMatchConfirmations || 0) + 1;
      if (now >= attempt.deadlineAt && confirmations >= 3) {
        await db.prepare("DELETE FROM class_provider_create_attempts WHERE correlation_id=?")
          .bind(attempt.correlationId).run();
      } else {
        await db.prepare(`UPDATE class_provider_create_attempts SET
          discovery_attempts=discovery_attempts+1,no_match_confirmations=?,
          next_attempt_at=?,last_error=NULL,updated_at=? WHERE correlation_id=?`)
          .bind(confirmations, now + 60, now, attempt.correlationId).run();
      }
    } catch (error) {
      const failures = Number(attempt.discoveryAttempts || 0) + 1;
      await db.prepare(`UPDATE class_provider_create_attempts SET discovery_attempts=?,
        next_attempt_at=?,last_error=?,updated_at=? WHERE correlation_id=?`).bind(
        failures,
        retryAt(failures, now),
        error instanceof Error ? error.message.slice(0, 240) : "Provider recovery failed",
        now,
        attempt.correlationId,
      ).run();
    }
  }
  return attempts.length;
}

export async function processClassProviderTeardowns(limit = 5) {
  const db = getDatabase();
  const now = nowSeconds();
  const jobs = (await db.prepare(`SELECT provider_meeting_id AS providerMeetingId,
    room_id AS roomId,generation,attempts FROM class_provider_teardown_jobs
    WHERE next_attempt_at<=? ORDER BY next_attempt_at,updated_at LIMIT ?`)
    .bind(now, Math.max(1, Math.min(10, Math.floor(limit))))
    .run<{ providerMeetingId: string; roomId: string; generation: number; attempts: number }>()).results || [];
  let completed = 0;
  for (const job of jobs) {
    try {
      await stopProviderLivestreamForTeardown(job.providerMeetingId).catch(() => undefined);
      await kickAllProviderParticipants(job.providerMeetingId);
      await deactivateProviderMeeting(job.providerMeetingId);
      await db.prepare("DELETE FROM class_provider_teardown_jobs WHERE provider_meeting_id=?")
        .bind(job.providerMeetingId).run();
      completed += 1;
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      await db.prepare(`UPDATE class_provider_teardown_jobs SET attempts=?,next_attempt_at=?,
        last_error=?,updated_at=? WHERE provider_meeting_id=?`).bind(
        attempts,
        retryAt(attempts, now),
        error instanceof Error ? error.message.slice(0, 240) : "Provider teardown failed",
        now,
        job.providerMeetingId,
      ).run();
    }
  }
  return { processed: jobs.length, completed };
}

export async function queueExpiredClassProviderGenerations(limit = 10) {
  const now = nowSeconds();
  const rooms = (await getDatabase().prepare(`SELECT id,
    provider_meeting_id AS providerMeetingId,provider_generation AS providerGeneration
    FROM live_class_rooms WHERE provider_meeting_id IS NOT NULL
      AND provider_generation_started_at<=?
    ORDER BY provider_generation_started_at,id LIMIT ?`)
    .bind(now - MAX_PROVIDER_SESSION_SECONDS, Math.max(1, Math.min(25, limit)))
    .run<{ id: string; providerMeetingId: string; providerGeneration: number }>()).results || [];
  for (const room of rooms) await queueClassProviderTeardown({
    roomId: room.id,
    providerMeetingId: room.providerMeetingId,
    generation: room.providerGeneration,
    reason: "duration",
  });
  return rooms.length;
}
