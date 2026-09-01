import { createId, getDatabase } from "./auth";

export const MEMBER_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;
export const MEMBER_STORAGE_OBJECTS = 20_000;
export const MATERIAL_FILE_MAX_BYTES = 15 * 1024 * 1024;
export const PLAYLIST_FILE_MAX_BYTES = 500 * 1024 * 1024;
const RESERVATION_SECONDS = 30 * 60;

export type StorageResourceKind =
  | "material"
  | "playlist"
  | "recording_audio"
  | "recording_transcript"
  | "recording_summary";

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

export async function reserveMemberStorage(input: {
  hostUserId: string;
  roomId: string;
  resourceKind: StorageResourceKind;
  resourceId: string;
  bytes: number;
  objects?: number;
  expiresInSeconds?: number;
}) {
  const bytes = Math.floor(input.bytes);
  const objects = Math.floor(input.objects ?? 1);
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MEMBER_STORAGE_BYTES
    || !Number.isSafeInteger(objects) || objects < 0 || objects > MEMBER_STORAGE_OBJECTS)
    throw new Error("INVALID_STORAGE_RESERVATION");
  const now = nowSeconds();
  const expiresInSeconds = Math.max(60, Math.min(24 * 60 * 60,
    Math.floor(input.expiresInSeconds || RESERVATION_SECONDS)));
  const id = createId();
  const result = await getDatabase().prepare(`INSERT INTO member_storage_quota_reservations(
    id,host_user_id,room_id,resource_kind,resource_id,reserved_bytes,
    reserved_objects,state,expires_at,created_at,updated_at
  ) SELECT ?,?,?,?,?,?,?,'reserved',?,?,? WHERE
    COALESCE((SELECT SUM(reserved_bytes) FROM member_storage_quota_reservations
      WHERE host_user_id=? AND state IN ('used','reserved')
        AND (state='used' OR expires_at>?)),0)+?<=?
    AND COALESCE((SELECT SUM(reserved_objects) FROM member_storage_quota_reservations
      WHERE host_user_id=? AND state IN ('used','reserved')
        AND (state='used' OR expires_at>?)),0)+?<=?
  ON CONFLICT(resource_kind,resource_id) DO NOTHING
  RETURNING id`).bind(
    id,
    input.hostUserId,
    input.roomId,
    input.resourceKind,
    input.resourceId,
    bytes,
    objects,
    now + expiresInSeconds,
    now,
    now,
    input.hostUserId,
    now,
    bytes,
    MEMBER_STORAGE_BYTES,
    input.hostUserId,
    now,
    objects,
    MEMBER_STORAGE_OBJECTS,
  ).first<{ id: string }>();
  if (!result?.id) throw new Error("MEMBER_STORAGE_QUOTA_EXCEEDED");
  return { id: result.id, expiresAt: now + expiresInSeconds };
}

export async function commitMemberStorageReservation(
  reservationId: string,
  exactBytes: number,
) {
  const bytes = Math.max(0, Math.floor(exactBytes));
  const now = nowSeconds();
  const result = await getDatabase().prepare(`UPDATE member_storage_quota_reservations
    SET state='used',reserved_bytes=?,expires_at=NULL,updated_at=?
    WHERE id=? AND state='reserved' AND reserved_bytes>=? AND expires_at>?`)
    .bind(bytes, now, reservationId, bytes, now).run();
  if (Number(result.meta?.changes || 0) === 1) return;
  const existing = await getDatabase().prepare(`SELECT state,reserved_bytes AS reservedBytes
    FROM member_storage_quota_reservations WHERE id=? LIMIT 1`)
    .bind(reservationId).first<{ state: string; reservedBytes: number }>();
  if (existing?.state === "used" && Number(existing.reservedBytes) === bytes) return;
  throw new Error("STORAGE_RESERVATION_EXPIRED");
}

export async function releaseMemberStorageReservation(reservationId: string) {
  await getDatabase().prepare(`UPDATE member_storage_quota_reservations
    SET state='released',reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
    WHERE id=? AND state<>'released'`).bind(nowSeconds(), reservationId).run();
}

export async function releaseStorageResource(kind: StorageResourceKind, resourceId: string) {
  await getDatabase().prepare(`UPDATE member_storage_quota_reservations
    SET state='released',reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
    WHERE resource_kind=? AND resource_id=?`).bind(nowSeconds(), kind, resourceId).run();
}

export async function cleanupExpiredStorageReservations(limit = 100) {
  const now = nowSeconds();
  const result = await getDatabase().prepare(`UPDATE member_storage_quota_reservations
    SET state='released',reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
    WHERE id IN (SELECT id FROM member_storage_quota_reservations
      WHERE state='reserved' AND expires_at<=? ORDER BY expires_at,id LIMIT ?)`)
    .bind(now, now, Math.max(1, Math.min(500, Math.floor(limit)))).run();
  return Number(result.meta?.changes || 0);
}
