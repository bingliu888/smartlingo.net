import { getDatabase } from "./auth";
import { processClassDeletions } from "./class-deletion";
import {
  cleanupExpiredParticipantSessions,
  cleanupRevokedProviderParticipants,
  recoverAmbiguousParticipantCreates,
} from "./class-participant-session";
import {
  processClassProviderTeardowns,
  queueExpiredClassProviderGenerations,
  recoverClassProviderCreates,
} from "./class-provider-lifecycle";
import { recoverAmbiguousRecordingStarts } from "./class-recording";
import { stopProviderRecordingForTeardown } from "./live-class-realtimekit";
import {
  cleanupExpiredStorageReservations,
  commitMemberStorageReservation,
  releaseMemberStorageReservation,
  releaseStorageResource,
} from "./member-storage-quota";
import { abortR2MultipartUploadIdempotently } from "./r2-batch-delete";

type FileBucket = {
  delete(keys: string | string[]): Promise<unknown>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{
    objects: Array<{ key: string }>;
    truncated?: boolean;
    cursor?: string;
  }>;
  resumeMultipartUpload(key: string, uploadId: string): { abort(): Promise<void> };
};

export type ClassMaintenanceEnvironment = { CLASS_FILES?: FileBucket };
const DEADLINE_MS = 45_000;

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

function retryAt(attempts: number, now = nowSeconds()) {
  return now + Math.min(6 * 60 * 60, 30 * 2 ** Math.min(10, Math.max(0, attempts)));
}

async function cleanupExpiredSessions() {
  const roomIds = (await getDatabase().prepare(`SELECT DISTINCT room_id AS roomId
    FROM class_participant_sessions WHERE active=1 AND last_seen_at<=?
    ORDER BY room_id LIMIT 4`).bind(nowSeconds() - 45).run<{ roomId: string }>()).results || [];
  for (const row of roomIds) await cleanupExpiredParticipantSessions(row.roomId, 25);
}

async function processRecordingCleanup(limit = 6) {
  const now = nowSeconds();
  const jobs = (await getDatabase().prepare(`SELECT provider_recording_id AS id,attempts
    FROM provider_recording_cleanup_jobs WHERE next_attempt_at<=?
    ORDER BY next_attempt_at,updated_at,id LIMIT ?`).bind(now, limit)
    .run<{ id: string; attempts: number }>()).results || [];
  for (const job of jobs) {
    try {
      await stopProviderRecordingForTeardown(job.id);
      await getDatabase().prepare(
        "DELETE FROM provider_recording_cleanup_jobs WHERE provider_recording_id=?",
      ).bind(job.id).run();
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      await getDatabase().prepare(`UPDATE provider_recording_cleanup_jobs SET attempts=?,
        next_attempt_at=?,last_error=?,updated_at=? WHERE provider_recording_id=?`).bind(
        attempts,
        retryAt(attempts, now),
        error instanceof Error ? error.message.slice(0, 240) : "Recording cleanup failed",
        now,
        job.id,
      ).run();
    }
  }
}

async function processFileTombstones(bucket: FileBucket | undefined, limit = 12) {
  if (!bucket) return;
  const now = nowSeconds();
  const rows = (await getDatabase().prepare(`SELECT object_key AS objectKey,
    resource_kind AS resourceKind,resource_id AS resourceId,attempts
    FROM class_file_tombstones WHERE next_attempt_at<=?
    ORDER BY next_attempt_at,updated_at,object_key LIMIT ?`).bind(now, limit)
    .run<{ objectKey: string; resourceKind: "material" | "playlist" | "recording";
      resourceId: string; attempts: number }>()).results || [];
  for (const row of rows) {
    try {
      await bucket.delete(row.objectKey);
      await releaseStorageResource(
        row.resourceKind === "recording" ? "recording_audio" : row.resourceKind,
        row.resourceId,
      );
      await getDatabase().prepare("DELETE FROM class_file_tombstones WHERE object_key=?")
        .bind(row.objectKey).run();
    } catch (error) {
      const attempts = Number(row.attempts || 0) + 1;
      await getDatabase().prepare(`UPDATE class_file_tombstones SET attempts=?,
        next_attempt_at=?,last_error=?,updated_at=? WHERE object_key=?`).bind(
        attempts,
        retryAt(attempts, now),
        error instanceof Error ? error.message.slice(0, 240) : "File cleanup failed",
        now,
        row.objectKey,
      ).run();
    }
  }
}

async function cleanupStaleUploads(bucket: FileBucket | undefined) {
  if (!bucket) return;
  const now = nowSeconds();
  const materials = (await getDatabase().prepare(`SELECT upload.id,
    upload.object_key AS objectKey,upload.quota_reservation_id AS quotaId,
    upload.file_size_bytes AS fileSize,
    EXISTS(SELECT 1 FROM live_class_materials item WHERE item.id=upload.id) AS committed
    FROM class_material_uploads upload WHERE upload.updated_at<=?
      AND COALESCE(upload.cleanup_next_at,0)<=? ORDER BY upload.updated_at,id LIMIT 8`)
    .bind(now - 3_600, now).run<{ id: string; objectKey: string; quotaId: string;
      fileSize: number; committed: number }>()).results || [];
  for (const upload of materials) {
    try {
      if (upload.committed)
        await commitMemberStorageReservation(upload.quotaId, upload.fileSize);
      else {
        await bucket.delete(upload.objectKey);
        await releaseMemberStorageReservation(upload.quotaId);
      }
      await getDatabase().prepare("DELETE FROM class_material_uploads WHERE id=?")
        .bind(upload.id).run();
    } catch {
      await getDatabase().prepare(`UPDATE class_material_uploads SET
        cleanup_attempts=cleanup_attempts+1,cleanup_next_at=?,updated_at=? WHERE id=?`)
        .bind(now + 300, now, upload.id).run();
    }
  }
  const playlists = (await getDatabase().prepare(`SELECT upload.id,
    upload.r2_key AS r2Key,upload.r2_upload_id AS uploadId,
    upload.quota_reservation_id AS quotaId,upload.file_size_bytes AS fileSize,
    EXISTS(SELECT 1 FROM class_playlist_items item WHERE item.id=upload.id) AS committed
    FROM class_playlist_uploads upload WHERE upload.updated_at<=?
      AND COALESCE(upload.cleanup_next_at,0)<=? ORDER BY upload.updated_at,id LIMIT 6`)
    .bind(now - 3_600, now).run<{ id: string; r2Key: string; uploadId: string;
      quotaId: string; fileSize: number; committed: number }>()).results || [];
  for (const upload of playlists) {
    try {
      if (upload.committed)
        await commitMemberStorageReservation(upload.quotaId, upload.fileSize);
      else {
        await abortR2MultipartUploadIdempotently(bucket, upload.r2Key, upload.uploadId);
        await bucket.delete(upload.r2Key).catch(() => undefined);
        await releaseMemberStorageReservation(upload.quotaId);
      }
      await getDatabase().prepare("DELETE FROM class_playlist_uploads WHERE id=?")
        .bind(upload.id).run();
    } catch {
      await getDatabase().prepare(`UPDATE class_playlist_uploads SET
        cleanup_attempts=cleanup_attempts+1,cleanup_next_at=?,updated_at=? WHERE id=?`)
        .bind(now + 300, now, upload.id).run();
    }
  }
}

async function retainBoundedRows() {
  const now = nowSeconds();
  await getDatabase().batch([
    getDatabase().prepare(`DELETE FROM sessions WHERE id IN (
      SELECT id FROM sessions WHERE expires_at<=? ORDER BY expires_at,id LIMIT 500)`)
      .bind(now),
    getDatabase().prepare(`DELETE FROM account_request_limits
      WHERE (scope,actor_key) IN (SELECT scope,actor_key FROM account_request_limits
        WHERE updated_at<=? ORDER BY updated_at,scope,actor_key LIMIT 500)`)
      .bind(now - 2 * 86_400),
    getDatabase().prepare(`DELETE FROM class_password_failures WHERE id IN (
      SELECT id FROM class_password_failures WHERE last_failed_at<=?
      ORDER BY last_failed_at,id LIMIT 500)`).bind(now - 86_400),
    getDatabase().prepare(`DELETE FROM webhook_processing_claims WHERE id IN (
      SELECT id FROM webhook_processing_claims WHERE claimed_at<=?
      ORDER BY claimed_at,id LIMIT 500)`).bind(now - 6 * 60 * 60),
    getDatabase().prepare(`DELETE FROM processed_webhooks WHERE id IN (
      SELECT id FROM processed_webhooks WHERE processed_at<=?
      ORDER BY processed_at,id LIMIT 1000)`).bind(now - 7 * 86_400),
    getDatabase().prepare(`DELETE FROM live_class_media_presence WHERE id IN (
      SELECT id FROM live_class_media_presence WHERE active=0 OR last_seen_at<=?
      ORDER BY last_seen_at,id LIMIT 500)`).bind(now - 86_400),
    getDatabase().prepare(`UPDATE class_shared_content_state SET active=0,
      claim_token=NULL,lease_until=NULL,updated_at=? WHERE active=1 AND lease_until<=?`)
      .bind(now, now),
  ]);
}

export async function runClassMaintenance(environment: ClassMaintenanceEnvironment) {
  const started = Date.now();
  const withinDeadline = () => Date.now() - started < DEADLINE_MS;
  await cleanupExpiredSessions();
  if (withinDeadline()) await cleanupRevokedProviderParticipants(8);
  if (withinDeadline()) await recoverAmbiguousParticipantCreates(12);
  if (withinDeadline()) await recoverAmbiguousRecordingStarts(4);
  if (withinDeadline()) await processRecordingCleanup(6);
  if (withinDeadline()) await queueExpiredClassProviderGenerations(5);
  if (withinDeadline()) await recoverClassProviderCreates(3);
  if (withinDeadline()) await processClassProviderTeardowns(5);
  if (withinDeadline()) await processFileTombstones(environment.CLASS_FILES, 12);
  if (withinDeadline()) await cleanupStaleUploads(environment.CLASS_FILES);
  if (withinDeadline()) await cleanupExpiredStorageReservations(100);
  if (withinDeadline()) await processClassDeletions(environment.CLASS_FILES, 3);
  if (withinDeadline()) await retainBoundedRows();
}
