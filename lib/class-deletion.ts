import { getDatabase } from "./auth";
import { queueClassProviderTeardown } from "./class-provider-lifecycle";
import { stopProviderRecordingForTeardown } from "./live-class-realtimekit";
import {
  abortR2MultipartUploadIdempotently,
  deleteOneR2PrefixPage,
  type R2ListBucket,
  type R2MultipartBucket,
} from "./r2-batch-delete";

type ClassFileBucket = R2ListBucket & R2MultipartBucket;

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

function retryAt(attempts: number, now = nowSeconds()) {
  return now + Math.min(6 * 60 * 60, 30 * 2 ** Math.min(10, Math.max(0, attempts)));
}

export async function requestClassDeletion(input: {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  providerMeetingId: string | null;
  providerGeneration: number;
}) {
  const now = nowSeconds();
  await getDatabase().batch([
    getDatabase().prepare(`INSERT INTO class_deletion_jobs(
      room_id,room_code,host_user_id,attempts,next_attempt_at,requested_at,updated_at
    ) VALUES(?,?,?,0,?,?,?) ON CONFLICT(room_id) DO UPDATE SET
      next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),
      last_error=NULL,updated_at=excluded.updated_at`)
      .bind(input.roomId, input.roomCode, input.hostUserId, now, now, now),
    getDatabase().prepare(`UPDATE live_class_rooms SET status='archived',stream_active=0,
      mute_all=0,updated_at=? WHERE id=?`).bind(now, input.roomId),
    getDatabase().prepare(`INSERT OR IGNORE INTO provider_recording_cleanup_jobs(
      provider_recording_id,room_id,attempts,next_attempt_at,requested_at,updated_at
    ) SELECT provider_recording_id,room_id,0,?,?,? FROM class_recording_claims
      WHERE room_id=? AND provider_recording_id IS NOT NULL`)
      .bind(now, now, now, input.roomId),
  ]);
  if (input.providerMeetingId) {
    await queueClassProviderTeardown({
      roomId: input.roomId,
      providerMeetingId: input.providerMeetingId,
      generation: input.providerGeneration,
      reason: "delete",
    });
  }
}

async function stopDeletingClassRecordings(roomId: string) {
  const recordings = (await getDatabase().prepare(`SELECT provider_recording_id AS id
    FROM class_recording_claims WHERE room_id=? AND provider_recording_id IS NOT NULL`)
    .bind(roomId).run<{ id: string }>()).results || [];
  for (const recording of recordings)
    await stopProviderRecordingForTeardown(recording.id).catch(() => undefined);
}

async function abortDeletingClassUploads(bucket: ClassFileBucket, roomId: string) {
  const uploads = (await getDatabase().prepare(`SELECT id,r2_key AS r2Key,
    r2_upload_id AS uploadId FROM class_playlist_uploads WHERE room_id=? LIMIT 25`)
    .bind(roomId).run<{ id: string; r2Key: string; uploadId: string }>()).results || [];
  for (const upload of uploads) {
    await abortR2MultipartUploadIdempotently(bucket, upload.r2Key, upload.uploadId);
    await getDatabase().prepare("DELETE FROM class_playlist_uploads WHERE id=?")
      .bind(upload.id).run();
  }
  return !await getDatabase().prepare(
    "SELECT 1 FROM class_playlist_uploads WHERE room_id=? LIMIT 1",
  ).bind(roomId).first();
}

async function classHasRecentFileWriters(roomId: string, now: number) {
  return Boolean(await getDatabase().prepare(`SELECT 1 FROM (
    SELECT updated_at FROM class_material_uploads WHERE room_id=?
    UNION ALL
    SELECT updated_at FROM class_playlist_uploads WHERE room_id=?
  ) WHERE updated_at>? LIMIT 1`).bind(roomId, roomId, now - 3_600).first());
}

export async function processClassDeletions(bucket: ClassFileBucket | undefined, limit = 3) {
  const now = nowSeconds();
  const jobs = (await getDatabase().prepare(`SELECT deletion.room_id AS roomId,
    deletion.host_user_id AS hostUserId,deletion.attempts,
    room.provider_meeting_id AS providerMeetingId,
    room.provider_generation AS providerGeneration
    FROM class_deletion_jobs deletion
    LEFT JOIN live_class_rooms room ON room.id=deletion.room_id
    WHERE deletion.next_attempt_at<=?
    ORDER BY deletion.next_attempt_at,deletion.updated_at,deletion.room_id LIMIT ?`)
    .bind(now, Math.max(1, Math.min(5, Math.floor(limit))))
    .run<{ roomId: string; hostUserId: string; attempts: number;
      providerMeetingId: string | null; providerGeneration: number | null }>()).results || [];
  let completed = 0;
  for (const job of jobs) {
    try {
      if (!bucket) throw new Error("CLASS_FILE_STORAGE_UNAVAILABLE");
      if (job.providerMeetingId) await queueClassProviderTeardown({
        roomId: job.roomId,
        providerMeetingId: job.providerMeetingId,
        generation: Number(job.providerGeneration || 0),
        reason: "delete",
      });
      if (await classHasRecentFileWriters(job.roomId, now)) {
        await getDatabase().prepare(`UPDATE class_deletion_jobs SET next_attempt_at=?,
          last_error=NULL,updated_at=? WHERE room_id=?`)
          .bind(now + 300, now, job.roomId).run();
        continue;
      }
      await stopDeletingClassRecordings(job.roomId);
      if (!await abortDeletingClassUploads(bucket, job.roomId)) {
        await getDatabase().prepare(`UPDATE class_deletion_jobs SET next_attempt_at=?,
          last_error=NULL,updated_at=? WHERE room_id=?`)
          .bind(now + 5, now, job.roomId).run();
        continue;
      }
      const page = await deleteOneR2PrefixPage(bucket, `classes/${job.roomId}/`);
      if (!page.empty) {
        await getDatabase().prepare(`UPDATE class_deletion_jobs SET next_attempt_at=?,
          last_error=NULL,updated_at=? WHERE room_id=?`)
          .bind(now + 5, now, job.roomId).run();
        continue;
      }
      await getDatabase().batch([
        getDatabase().prepare(`UPDATE member_storage_quota_reservations SET
          state='released',reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
          WHERE room_id=? AND state<>'released'`).bind(now, job.roomId),
        getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
          state='released',reserved_seconds=0,updated_at=?
          WHERE room_id=? AND state='reserved'`).bind(now, job.roomId),
        getDatabase().prepare("DELETE FROM live_class_rooms WHERE id=?").bind(job.roomId),
        getDatabase().prepare("DELETE FROM class_deletion_jobs WHERE room_id=?").bind(job.roomId),
      ]);
      completed += 1;
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      await getDatabase().prepare(`UPDATE class_deletion_jobs SET attempts=?,
        next_attempt_at=?,last_error=?,updated_at=? WHERE room_id=?`).bind(
        attempts,
        retryAt(attempts, now),
        error instanceof Error ? error.message.slice(0, 240) : "Class deletion failed",
        now,
        job.roomId,
      ).run();
    }
  }
  return { processed: jobs.length, completed };
}
