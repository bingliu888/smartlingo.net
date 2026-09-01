import { createId, getDatabase } from "./auth";
import type { ClassRoom } from "./live-classrooms";
import type { ClassParticipantSession } from "./class-participant-session";
import {
  findProviderRecordingByCorrelation,
  providerRecordingStartFailureIsDefinite,
  startProviderRecording,
  stopProviderRecordingForTeardown,
} from "./live-class-realtimekit";
import { MAX_PROVIDER_SESSION_SECONDS } from "./class-session-policy";
import {
  releaseMemberStorageReservation,
  reserveMemberStorage,
} from "./member-storage-quota";

export const MONTHLY_RECORDING_QUOTA_SECONDS = 20 * 60 * 60;
export const PROVIDER_AUDIO_RESERVE_BYTES_PER_SECOND = 64 * 1024;
const DELETED_RECORDING_R2_GRACE_SECONDS = 6 * 60 * 60;

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

function utcMonthStartSeconds(now = nowSeconds()) {
  const date = new Date(now * 1_000);
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1_000);
}

export function providerAudioReservationBytes(seconds: number) {
  return Math.min(
    1024 * 1024 * 1024,
    Math.max(1024 * 1024, Math.floor(seconds) * PROVIDER_AUDIO_RESERVE_BYTES_PER_SECOND),
  );
}

function recordingObjectKey(roomId: string, artifactId: string) {
  return `classes/${roomId}/recordings/${artifactId}.m4a`;
}

async function compensateStartedClassRecording(input: {
  roomId: string;
  artifactId: string;
  quotaId: string;
  storageReservationId: string;
  providerRecordingId: string;
}) {
  const now = nowSeconds();
  await getDatabase().batch([
    getDatabase().prepare(`INSERT INTO provider_recording_cleanup_jobs(
      provider_recording_id,room_id,attempts,next_attempt_at,requested_at,updated_at
    ) VALUES(?,?,0,?,?,?) ON CONFLICT(provider_recording_id) DO UPDATE SET
      room_id=COALESCE(provider_recording_cleanup_jobs.room_id,excluded.room_id),
      next_attempt_at=MIN(provider_recording_cleanup_jobs.next_attempt_at,excluded.next_attempt_at),
      updated_at=excluded.updated_at`).bind(
      input.providerRecordingId,
      input.roomId,
      now,
      now,
      now,
    ),
    getDatabase().prepare(`UPDATE class_recording_artifacts SET status='errored',
      updated_at=? WHERE id=? AND status<>'deleted'`).bind(now, input.artifactId),
    getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
      state='released',reserved_seconds=0,updated_at=?
      WHERE id=? AND state='reserved'`).bind(now, input.quotaId),
    getDatabase().prepare(`UPDATE member_storage_quota_reservations SET
      state='released',reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
      WHERE id=? AND state='reserved' AND EXISTS (
        SELECT 1 FROM class_recording_artifacts
        WHERE id=? AND status<>'deleted'
      )`).bind(now, input.storageReservationId, input.artifactId),
    getDatabase().prepare(`DELETE FROM class_recording_claims
      WHERE room_id=? AND artifact_id=?`).bind(input.roomId, input.artifactId),
  ]);
  await stopProviderRecordingForTeardown(input.providerRecordingId).catch(() => undefined);
}

export async function deleteClassRecordingArtifact(roomId: string, artifactId: string) {
  const artifact = await getDatabase().prepare(`SELECT artifact.status,
    artifact.audio_r2_key AS objectKey,
    claim.provider_recording_id AS providerRecordingId
    FROM class_recording_artifacts artifact
    LEFT JOIN class_recording_claims claim ON claim.artifact_id=artifact.id
    WHERE artifact.id=? AND artifact.room_id=? LIMIT 1`).bind(artifactId, roomId)
    .first<{ status: string; objectKey: string | null; providerRecordingId: string | null }>();
  if (!artifact) return false;
  const now = nowSeconds();
  const active = ["pending", "recording", "processing"].includes(artifact.status);
  const objectKey = artifact.objectKey || recordingObjectKey(roomId, artifactId);
  await getDatabase().batch([
    // The archive stream has a five-hour total timeout. Active deletions keep
    // the deterministic R2 tombstone beyond that bound so an in-flight writer
    // cannot recreate the object after a premature successful delete.
    getDatabase().prepare(`INSERT INTO class_file_tombstones(
      object_key,room_id,resource_kind,resource_id,attempts,next_attempt_at,
      requested_at,updated_at
    ) VALUES(?,?,'recording',?,0,?,?,?) ON CONFLICT(object_key) DO UPDATE SET
      next_attempt_at=MAX(class_file_tombstones.next_attempt_at,excluded.next_attempt_at),
      updated_at=excluded.updated_at`).bind(
      objectKey,
      roomId,
      artifactId,
      now + (active ? DELETED_RECORDING_R2_GRACE_SECONDS : 0),
      now,
      now,
    ),
    getDatabase().prepare(`UPDATE class_recording_artifacts SET
      status='deleted',audio_r2_key=NULL,audio_size_bytes=0,updated_at=?
      WHERE id=? AND room_id=?`).bind(now, artifactId, roomId),
    getDatabase().prepare(`INSERT INTO provider_recording_cleanup_jobs(
      provider_recording_id,room_id,attempts,next_attempt_at,requested_at,updated_at
    ) SELECT provider_recording_id,room_id,0,?,?,?
      FROM class_recording_claims
      WHERE room_id=? AND artifact_id=? AND provider_recording_id IS NOT NULL
      ON CONFLICT(provider_recording_id) DO UPDATE SET
        room_id=COALESCE(provider_recording_cleanup_jobs.room_id,excluded.room_id),
        next_attempt_at=MIN(provider_recording_cleanup_jobs.next_attempt_at,excluded.next_attempt_at),
        updated_at=excluded.updated_at`).bind(now, now, now, roomId, artifactId),
    // Preserve an ambiguous provider-start claim for correlation recovery.
    // An unattempted start is safe to close because startReservedClassRecording
    // fences the external call on its own successful claim transition.
    getDatabase().prepare(`DELETE FROM class_recording_claims
      WHERE room_id=? AND artifact_id=? AND (
        provider_recording_id IS NOT NULL OR provider_start_attempted_at IS NULL
      )`).bind(roomId, artifactId),
    getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
      state='released',reserved_seconds=0,updated_at=?
      WHERE artifact_id=? AND state='reserved' AND NOT EXISTS (
        SELECT 1 FROM class_recording_claims WHERE artifact_id=?
      )`).bind(now, artifactId, artifactId),
  ]);
  if (artifact.providerRecordingId)
    await stopProviderRecordingForTeardown(artifact.providerRecordingId).catch(() => undefined);
  return true;
}

export async function beginClassRecording(
  room: ClassRoom,
  session: ClassParticipantSession,
) {
  if (!room.providerMeetingId || !room.providerGenerationStartedAt)
    throw new Error("STREAM_NOT_ACTIVE");
  if (session.role !== "host" || session.providerMeetingId !== room.providerMeetingId)
    throw new Error("RECORDING_MANAGER_REQUIRED");
  const now = nowSeconds();
  const generationRemaining = Math.max(
    0,
    room.providerGenerationStartedAt + MAX_PROVIDER_SESSION_SECONDS - now,
  );
  if (generationRemaining < 60) throw new Error("PROVIDER_GENERATION_ENDING");
  const artifactId = createId();
  const quotaId = createId();
  const claimToken = createId();
  const correlationId = createId();
  const monthStart = utcMonthStartSeconds(now);
  const quota = await getDatabase().prepare(`INSERT INTO class_recording_quota_reservations(
    id,host_user_id,room_id,artifact_id,month_start,reserved_seconds,
    settled_seconds,state,created_at,updated_at
  ) SELECT ?,?,?,?,?,MIN(?,remaining),0,'reserved',?,? FROM (
    SELECT ?-COALESCE((SELECT SUM(CASE WHEN state='reserved' THEN reserved_seconds
      WHEN state='settled' THEN settled_seconds ELSE 0 END)
      FROM class_recording_quota_reservations
      WHERE host_user_id=? AND month_start=?),0) AS remaining
  ) WHERE remaining>=60`).bind(
    quotaId,
    room.hostUserId,
    room.id,
    artifactId,
    monthStart,
    generationRemaining,
    now,
    now,
    MONTHLY_RECORDING_QUOTA_SECONDS,
    room.hostUserId,
    monthStart,
  ).run();
  if (Number(quota.meta?.changes || 0) !== 1) throw new Error("RECORDING_QUOTA_REACHED");
  const reserved = await getDatabase().prepare(
    "SELECT reserved_seconds AS reservedSeconds FROM class_recording_quota_reservations WHERE id=?",
  ).bind(quotaId).first<{ reservedSeconds: number }>();
  const reservedSeconds = Number(reserved?.reservedSeconds || 0);
  if (reservedSeconds < 60) throw new Error("RECORDING_QUOTA_REACHED");
  let storage: { id: string } | null = null;
  try {
    storage = await reserveMemberStorage({
      hostUserId: room.hostUserId,
      roomId: room.id,
      resourceKind: "recording_audio",
      resourceId: artifactId,
      bytes: providerAudioReservationBytes(reservedSeconds),
      expiresInSeconds: 24 * 60 * 60,
    });
    await getDatabase().batch([
      getDatabase().prepare(`INSERT INTO class_recording_artifacts(
        id,room_id,status,created_at,updated_at
      ) VALUES(?,?,'pending',?,?)`).bind(artifactId, room.id, now, now),
      getDatabase().prepare(`INSERT INTO class_recording_claims(
        room_id,participant_session_id,claim_token,correlation_id,
        attempted_provider_meeting_id,artifact_id,quota_reservation_id,
        storage_reservation_id,claimed_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
        room.id,
        session.id,
        claimToken,
        correlationId,
        room.providerMeetingId,
        artifactId,
        quotaId,
        storage.id,
        now,
        now,
      ),
    ]);
    return { artifactId, quotaId, storageReservationId: storage.id,
      claimToken, correlationId, reservedSeconds };
  } catch (error) {
    if (storage) await releaseMemberStorageReservation(storage.id).catch(() => undefined);
    await getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
      state='released',reserved_seconds=0,updated_at=? WHERE id=?`)
      .bind(now, quotaId).run().catch(() => undefined);
    await getDatabase().prepare("DELETE FROM class_recording_artifacts WHERE id=?")
      .bind(artifactId).run().catch(() => undefined);
    throw error;
  }
}

export async function startReservedClassRecording(input: {
  room: ClassRoom;
  reservation: Awaited<ReturnType<typeof beginClassRecording>>;
}) {
  const providerMeetingId = input.room.providerMeetingId!;
  const attemptedAt = nowSeconds();
  const claimed = await getDatabase().prepare(`UPDATE class_recording_claims SET
    provider_start_attempted_at=?,next_check_at=?,updated_at=?
    WHERE room_id=? AND claim_token=?`).bind(
    attemptedAt,
    attemptedAt + 300,
    attemptedAt,
    input.room.id,
    input.reservation.claimToken,
  ).run();
  if (Number(claimed.meta?.changes || 0) !== 1) {
    await releaseUnstartedClassRecording(input.room.id, input.reservation).catch(() => undefined);
    throw new Error("RECORDING_RESERVATION_CLOSED");
  }
  let startedProviderRecordingId: string | null = null;
  try {
    const recording = await startProviderRecording(
      providerMeetingId,
      input.reservation.reservedSeconds,
      input.reservation.correlationId,
    );
    if (!recording?.id) throw new Error("PROVIDER_RECORDING_RESULT_MALFORMED");
    startedProviderRecordingId = recording.id;
    const now = nowSeconds();
    await getDatabase().batch([
      getDatabase().prepare(`UPDATE class_recording_claims SET provider_recording_id=?,
        next_check_at=NULL,updated_at=? WHERE room_id=? AND claim_token=?
        AND provider_recording_id IS NULL`)
        .bind(recording.id, now, input.room.id, input.reservation.claimToken),
      getDatabase().prepare(`UPDATE class_recording_artifacts SET
        provider_recording_id=?,status='recording',updated_at=?
        WHERE id=? AND status='pending'`)
        .bind(recording.id, now, input.reservation.artifactId),
      getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
        provider_recording_id=?,updated_at=? WHERE id=? AND state='reserved'`)
        .bind(recording.id, now, input.reservation.quotaId),
    ]);
    const accepted = await getDatabase().prepare(`SELECT status,provider_recording_id AS
      providerRecordingId FROM class_recording_artifacts WHERE id=? LIMIT 1`)
      .bind(input.reservation.artifactId)
      .first<{ status: string; providerRecordingId: string | null }>();
    if (accepted?.status !== "recording" || accepted.providerRecordingId !== recording.id)
      throw new Error("RECORDING_RESERVATION_CLOSED");
    return { artifactId: input.reservation.artifactId, providerRecordingId: recording.id };
  } catch (error) {
    if (startedProviderRecordingId) {
      await compensateStartedClassRecording({
        roomId: input.room.id,
        artifactId: input.reservation.artifactId,
        quotaId: input.reservation.quotaId,
        storageReservationId: input.reservation.storageReservationId,
        providerRecordingId: startedProviderRecordingId,
      }).catch(() => undefined);
    } else if (providerRecordingStartFailureIsDefinite(error))
      await releaseUnstartedClassRecording(input.room.id, input.reservation);
    else await getDatabase().prepare(`UPDATE class_recording_claims SET
      next_check_at=?,updated_at=? WHERE room_id=? AND claim_token=?`)
      .bind(attemptedAt + 300, attemptedAt, input.room.id,
        input.reservation.claimToken).run();
    throw error;
  }
}

async function releaseUnstartedClassRecording(
  roomId: string,
  reservation: Awaited<ReturnType<typeof beginClassRecording>>,
) {
  const now = nowSeconds();
  await getDatabase().batch([
    getDatabase().prepare("DELETE FROM class_recording_claims WHERE room_id=? AND claim_token=?")
      .bind(roomId, reservation.claimToken),
    getDatabase().prepare("DELETE FROM class_recording_artifacts WHERE id=? AND status='pending'")
      .bind(reservation.artifactId),
    getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
      state='released',reserved_seconds=0,updated_at=? WHERE id=? AND state='reserved'`)
      .bind(now, reservation.quotaId),
    getDatabase().prepare(`UPDATE member_storage_quota_reservations SET
      state='released',reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
      WHERE id=? AND state='reserved'`).bind(now, reservation.storageReservationId),
  ]);
}

export async function stopActiveClassRecording(roomId: string) {
  const claim = await getDatabase().prepare(`SELECT provider_recording_id AS providerRecordingId,
    artifact_id AS artifactId FROM class_recording_claims
    WHERE room_id=? AND provider_recording_id IS NOT NULL LIMIT 1`)
    .bind(roomId).first<{ providerRecordingId: string; artifactId: string }>();
  if (!claim) throw new Error("RECORDING_NOT_ACTIVE");
  await stopProviderRecordingForTeardown(claim.providerRecordingId);
  await getDatabase().prepare(`UPDATE class_recording_artifacts SET
    status='processing',updated_at=? WHERE id=? AND status IN ('pending','recording')`)
    .bind(nowSeconds(), claim.artifactId).run();
  return claim;
}

export async function recoverAmbiguousRecordingStarts(limit = 5) {
  const now = nowSeconds();
  const boundedLimit = Math.max(1, Math.min(10, limit));
  const abandoned = (await getDatabase().prepare(`SELECT room_id AS roomId,
    artifact_id AS artifactId,quota_reservation_id AS quotaId,
    storage_reservation_id AS storageReservationId,claim_token AS claimToken,
    correlation_id AS correlationId FROM class_recording_claims
    WHERE provider_recording_id IS NULL AND provider_start_attempted_at IS NULL
      AND claimed_at<=? ORDER BY claimed_at,room_id LIMIT ?`)
    .bind(now - 600, boundedLimit)
    .run<{ roomId: string; artifactId: string; quotaId: string;
      storageReservationId: string; claimToken: string; correlationId: string }>()).results || [];
  for (const claim of abandoned) {
    await releaseUnstartedClassRecording(claim.roomId, {
      artifactId: claim.artifactId,
      quotaId: claim.quotaId,
      storageReservationId: claim.storageReservationId,
      claimToken: claim.claimToken,
      correlationId: claim.correlationId,
      reservedSeconds: 0,
    });
    await getDatabase().prepare(`UPDATE class_recording_artifacts SET
      status='errored',updated_at=? WHERE id=? AND status='pending'`)
      .bind(now, claim.artifactId).run();
  }
  const claims = (await getDatabase().prepare(`SELECT room_id AS roomId,
    correlation_id AS correlationId,attempted_provider_meeting_id AS providerMeetingId,
    artifact_id AS artifactId,quota_reservation_id AS quotaId,
    storage_reservation_id AS storageReservationId,
    provider_start_attempted_at AS attemptedAt,not_found_confirmations AS confirmations
    FROM class_recording_claims WHERE provider_recording_id IS NULL
      AND provider_start_attempted_at IS NOT NULL AND next_check_at<=?
    ORDER BY next_check_at,claimed_at LIMIT ?`).bind(now, boundedLimit)
    .run<{ roomId: string; correlationId: string; providerMeetingId: string;
      artifactId: string; quotaId: string; storageReservationId: string;
      attemptedAt: number; confirmations: number }>()).results || [];
  for (const claim of claims) {
    try {
      const recording = await findProviderRecordingByCorrelation(
        claim.providerMeetingId,
        claim.correlationId,
        claim.attemptedAt,
      );
      if (recording?.id) {
        await getDatabase().batch([
          getDatabase().prepare(`UPDATE class_recording_claims SET provider_recording_id=?,
            next_check_at=NULL,updated_at=? WHERE room_id=? AND artifact_id=?
            AND provider_recording_id IS NULL`)
            .bind(recording.id, now, claim.roomId, claim.artifactId),
          getDatabase().prepare(`UPDATE class_recording_artifacts SET
            provider_recording_id=?,status='recording',updated_at=?
            WHERE id=? AND status='pending'`)
            .bind(recording.id, now, claim.artifactId),
          getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
            provider_recording_id=?,updated_at=? WHERE id=?`)
            .bind(recording.id, now, claim.quotaId),
        ]);
        const accepted = await getDatabase().prepare(`SELECT status,provider_recording_id AS
          providerRecordingId FROM class_recording_artifacts WHERE id=? LIMIT 1`)
          .bind(claim.artifactId)
          .first<{ status: string; providerRecordingId: string | null }>();
        if (accepted?.status !== "recording" || accepted.providerRecordingId !== recording.id)
          await compensateStartedClassRecording({
            roomId: claim.roomId,
            artifactId: claim.artifactId,
            quotaId: claim.quotaId,
            storageReservationId: claim.storageReservationId,
            providerRecordingId: recording.id,
          });
      } else if (Number(claim.confirmations || 0) + 1 >= 3) {
        const reservation = await getDatabase().prepare(`SELECT claim_token AS claimToken,
          storage_reservation_id AS storageReservationId FROM class_recording_claims
          WHERE room_id=?`).bind(claim.roomId)
          .first<{ claimToken: string; storageReservationId: string }>();
        if (reservation) await releaseUnstartedClassRecording(claim.roomId, {
          artifactId: claim.artifactId,
          quotaId: claim.quotaId,
          storageReservationId: reservation.storageReservationId,
          claimToken: reservation.claimToken,
          correlationId: claim.correlationId,
          reservedSeconds: 0,
        });
      } else {
        await getDatabase().prepare(`UPDATE class_recording_claims SET
          not_found_confirmations=not_found_confirmations+1,next_check_at=?,updated_at=?
          WHERE room_id=?`).bind(now + 300, now, claim.roomId).run();
      }
    } catch (error) {
      await getDatabase().prepare(`UPDATE class_recording_claims SET next_check_at=?,
        updated_at=? WHERE room_id=?`).bind(now + 300, now, claim.roomId).run();
      console.warn("Recording start recovery deferred",
        error instanceof Error ? error.message.slice(0, 160) : "unknown");
    }
  }
  return claims.length;
}

export async function settleClassRecording(input: {
  providerRecordingId: string;
  artifactId: string;
  recordingSeconds: number;
  objectKey: string;
  objectBytes: number;
}) {
  const now = nowSeconds();
  const claim = await getDatabase().prepare(`SELECT room_id AS roomId,
    storage_reservation_id AS storageReservationId FROM class_recording_claims
    WHERE provider_recording_id=? AND artifact_id=? LIMIT 1`)
    .bind(input.providerRecordingId, input.artifactId)
    .first<{ roomId: string; storageReservationId: string }>();
  if (!claim) throw new Error("RECORDING_CLAIM_NOT_FOUND");
  await getDatabase().batch([
    getDatabase().prepare(`UPDATE class_recording_artifacts SET status='ready',
      audio_r2_key=?,audio_size_bytes=?,recording_seconds=?,updated_at=?
      WHERE id=? AND provider_recording_id=? AND status<>'deleted'`).bind(
      input.objectKey,
      input.objectBytes,
      Math.max(0, Math.floor(input.recordingSeconds)),
      now,
      input.artifactId,
      input.providerRecordingId,
    ),
    getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
      state='settled',reserved_seconds=0,settled_seconds=?,updated_at=?
      WHERE provider_recording_id=? AND EXISTS (
        SELECT 1 FROM class_recording_artifacts WHERE id=? AND status='ready'
      )`).bind(
      Math.max(0, Math.floor(input.recordingSeconds)), now,
      input.providerRecordingId, input.artifactId,
    ),
    getDatabase().prepare(`UPDATE member_storage_quota_reservations SET state='used',
      reserved_bytes=?,expires_at=NULL,updated_at=? WHERE id=? AND EXISTS (
        SELECT 1 FROM class_recording_artifacts WHERE id=? AND status='ready'
      )`).bind(input.objectBytes, now, claim.storageReservationId, input.artifactId),
    getDatabase().prepare(`DELETE FROM class_recording_claims
      WHERE provider_recording_id=? AND EXISTS (
        SELECT 1 FROM class_recording_artifacts WHERE id=? AND status='ready'
      )`).bind(input.providerRecordingId, input.artifactId),
  ]);
  const settled = await getDatabase().prepare(
    "SELECT 1 FROM class_recording_artifacts WHERE id=? AND status='ready' LIMIT 1",
  ).bind(input.artifactId).first();
  if (!settled) throw new Error("RECORDING_DELETED");
}

export async function failClassRecording(providerRecordingId: string) {
  const now = nowSeconds();
  const claim = await getDatabase().prepare(`SELECT artifact_id AS artifactId,
    quota_reservation_id AS quotaId,storage_reservation_id AS storageId
    FROM class_recording_claims WHERE provider_recording_id=? LIMIT 1`)
    .bind(providerRecordingId)
    .first<{ artifactId: string; quotaId: string; storageId: string }>();
  if (!claim) return;
  await getDatabase().batch([
    getDatabase().prepare(`UPDATE class_recording_artifacts SET status='errored',updated_at=?
      WHERE id=? AND status<>'deleted'`)
      .bind(now, claim.artifactId),
    getDatabase().prepare(`UPDATE class_recording_quota_reservations SET
      state='released',reserved_seconds=0,updated_at=? WHERE id=?`)
      .bind(now, claim.quotaId),
    getDatabase().prepare(`UPDATE member_storage_quota_reservations SET
      state='released',reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
      WHERE id=?`).bind(now, claim.storageId),
    getDatabase().prepare("DELETE FROM class_recording_claims WHERE provider_recording_id=?")
      .bind(providerRecordingId),
  ]);
}
