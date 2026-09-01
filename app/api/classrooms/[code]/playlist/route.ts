import { NextResponse } from "next/server";
import { boundedJsonBody, boundedRequestBody } from "@/lib/bounded-request-body";
import { canManageClass } from "@/lib/class-managers";
import { createId, getDatabase, getSessionUser, type SessionUser } from "@/lib/auth";
import { classAccess, classByCode, type ClassRoom } from "@/lib/live-classrooms";
import {
  PLAYLIST_FILE_MAX_BYTES,
  commitMemberStorageReservation,
  releaseMemberStorageReservation,
  releaseStorageResource,
  reserveMemberStorage,
} from "@/lib/member-storage-quota";
import { abortR2MultipartUploadIdempotently } from "@/lib/r2-batch-delete";

type MultipartPart = { partNumber: number; etag: string };
type MultipartUpload = {
  uploadPart(partNumber: number, value: ArrayBuffer): Promise<MultipartPart>;
  complete(parts: MultipartPart[]): Promise<unknown>;
  abort(): Promise<void>;
};
type R2Bucket = {
  createMultipartUpload(key: string, options: {
    httpMetadata: { contentType: string };
    customMetadata?: Record<string, string>;
  }): Promise<{ uploadId: string; key: string }>;
  resumeMultipartUpload(key: string, uploadId: string): MultipartUpload;
  delete(key: string): Promise<unknown>;
};
type PlaylistItem = {
  id: string;
  title: string;
  sourceType: "upload";
  sourceUrl: null;
  contentType: string;
  fileSizeBytes: number;
  position: number;
  createdAt: number;
};

export const dynamic = "force-dynamic";
const PART_MAX_BYTES = 8 * 1024 * 1024;
const itemSelection = `SELECT id,title,source_type AS sourceType,
  source_url AS sourceUrl,content_type AS contentType,
  file_size_bytes AS fileSizeBytes,position,created_at AS createdAt
  FROM class_playlist_items WHERE room_id=? ORDER BY position,created_at`;

function safeFileName(value: unknown) {
  let decoded = String(value || "video");
  try { decoded = decodeURIComponent(decoded); } catch { /* retain raw input */ }
  return decoded.normalize("NFKC").replace(/[\u0000-\u001f\u007f/\\]+/g, "_")
    .replace(/\s+/g, " ").trim().slice(0, 120) || "video";
}
async function context(request: Request, code: string) {
  const room = await classByCode(code);
  if (!room) return null;
  const user = await getSessionUser(request);
  const access = await classAccess(room, user);
  return { room, user, access, manager: await canManageClass(room, user) };
}

async function managerContext(
  request: Request,
  code: string,
): Promise<{ room: ClassRoom; user: SessionUser } | Response> {
  const value = await context(request, code);
  if (!value) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (!value.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!value.manager) return NextResponse.json({ error: "Teacher permission required" }, { status: 403 });
  return { room: value.room, user: value.user };
}

async function classFiles() {
  const { env } = await import("cloudflare:workers");
  return env.CLASS_FILES as unknown as R2Bucket | undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const value = await context(request, code);
  if (!value) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (!value.access.allowed)
    return NextResponse.json({ error: "Course access required" }, { status: value.user ? 403 : 401 });
  const [items, state] = await Promise.all([
    getDatabase().prepare(itemSelection).bind(value.room.id).run<PlaylistItem>(),
    getDatabase().prepare(`SELECT active,current_item_id AS currentItemId,
      started_at AS startedAt,offset_seconds AS offsetSeconds,updated_at AS updatedAt
      FROM class_playlist_state WHERE room_id=?`).bind(value.room.id).first(),
  ]);
  return NextResponse.json({
    items: items.results || [],
    state: state || { active: 0, currentItemId: null, startedAt: null, offsetSeconds: 0, updatedAt: 0 },
    manager: value.manager,
    streamActive: Boolean(value.room.streamActive),
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const managed = await managerContext(request, code);
  if (managed instanceof Response) return managed;
  const { room, user } = managed;
  const storage = await classFiles();
  if (!storage) return NextResponse.json({ error: "File storage is unavailable" }, { status: 503 });
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.startsWith("application/octet-stream")) {
      const key = request.headers.get("x-playlist-key") || "";
      const uploadId = request.headers.get("x-r2-upload-id") || "";
      const partNumber = Number(request.headers.get("x-part-number") || 0);
      if (!key.startsWith(`classes/${room.id}/playlist/`) || !uploadId
        || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 100)
        return NextResponse.json({ error: "Invalid upload part" }, { status: 400 });
      const upload = await getDatabase().prepare(`SELECT id,file_size_bytes AS fileSizeBytes,
        finalizing FROM class_playlist_uploads
        WHERE room_id=? AND user_id=? AND r2_key=? AND r2_upload_id=? LIMIT 1`)
        .bind(room.id, user.id, key, uploadId)
        .first<{ id: string; fileSizeBytes: number; finalizing: number }>();
      if (!upload || upload.finalizing)
        return NextResponse.json({ error: "Upload is not active" }, { status: 409 });
      const bytes = await boundedRequestBody(request, PART_MAX_BYTES);
      if (!bytes.byteLength) return NextResponse.json({ error: "Upload part is empty" }, { status: 400 });
      const prior = Number((await getDatabase().prepare(`SELECT COALESCE(SUM(size_bytes),0) AS size
        FROM class_playlist_upload_parts WHERE upload_id=? AND part_number<>?`)
        .bind(upload.id, partNumber).first<{ size: number }>())?.size || 0);
      if (prior + bytes.byteLength > upload.fileSizeBytes)
        return NextResponse.json({ error: "Upload exceeds its declared size" }, { status: 413 });
      const part = await storage.resumeMultipartUpload(key, uploadId)
        .uploadPart(partNumber, bytes);
      const touchedAt = Math.floor(Date.now() / 1_000);
      const persisted = await getDatabase().batch([
        getDatabase().prepare(`UPDATE class_playlist_uploads SET updated_at=?,cleanup_next_at=?
          WHERE id=? AND finalizing=0`).bind(touchedAt, touchedAt + 2 * 60 * 60, upload.id),
        getDatabase().prepare(`INSERT INTO class_playlist_upload_parts(
          upload_id,part_number,size_bytes,etag,updated_at
        ) SELECT ?,?,?,?,? WHERE EXISTS(
          SELECT 1 FROM class_playlist_uploads WHERE id=? AND finalizing=0
        ) ON CONFLICT(upload_id,part_number) DO UPDATE SET
          size_bytes=excluded.size_bytes,etag=excluded.etag,updated_at=excluded.updated_at`)
          .bind(upload.id, partNumber, bytes.byteLength, part.etag, touchedAt, upload.id),
      ]);
      if (Number(persisted[0]?.meta?.changes || 0) !== 1
        || Number(persisted[1]?.meta?.changes || 0) !== 1)
        return NextResponse.json({ error: "Upload is already finalizing" }, { status: 409 });
      return NextResponse.json(part);
    }

    const body = await boundedJsonBody<Record<string, unknown>>(request, 32 * 1024);
    const action = String(body.action || "");
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1_000);

    if (action === "init-upload") {
      if (!user.emailVerified)
        return NextResponse.json({ error: "Verify your email before uploading video", errorCode: "VERIFIED_MEMBER_REQUIRED" }, { status: 403 });
      const size = Number(body.size || 0);
      const fileName = safeFileName(body.fileName);
      const videoType = String(body.contentType || "video/mp4").slice(0, 100).toLowerCase();
      if (!videoType.startsWith("video/") || !Number.isSafeInteger(size)
        || size < 1 || size > PLAYLIST_FILE_MAX_BYTES)
        return NextResponse.json({ error: "Choose a video file up to 500 MB" }, { status: 413 });
      const itemCount = Number((await db.prepare(
        "SELECT COUNT(*) AS count FROM class_playlist_items WHERE room_id=?",
      ).bind(room.id).first<{ count: number }>())?.count || 0);
      if (itemCount >= 100)
        return NextResponse.json({ error: "This course playlist already has 100 items" }, { status: 409 });
      const itemId = createId();
      const key = `classes/${room.id}/playlist/${itemId}-${fileName}`;
      const reservation = await reserveMemberStorage({
        hostUserId: room.hostUserId,
        roomId: room.id,
        resourceKind: "playlist",
        resourceId: itemId,
        bytes: size,
        expiresInSeconds: 2 * 60 * 60,
      });
      let upload: { uploadId: string; key: string } | null = null;
      try {
        upload = await storage.createMultipartUpload(key, {
          httpMetadata: { contentType: videoType },
          customMetadata: { roomId: room.id, playlistItemId: itemId },
        });
        await db.prepare(`INSERT INTO class_playlist_uploads(
          id,room_id,user_id,r2_key,r2_upload_id,quota_reservation_id,
          file_name,content_type,file_size_bytes,finalizing,cleanup_next_at,
          created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?)`).bind(
          itemId, room.id, user.id, upload.key, upload.uploadId, reservation.id,
          fileName, videoType, size, now + 2 * 60 * 60, now, now,
        ).run();
        return NextResponse.json({ itemId, key: upload.key, uploadId: upload.uploadId });
      } catch (error) {
        if (upload) await abortR2MultipartUploadIdempotently(
          storage,
          upload.key,
          upload.uploadId,
        ).catch(() => undefined);
        await releaseMemberStorageReservation(reservation.id).catch(() => undefined);
        throw error;
      }
    }

    if (action === "complete-upload") {
      const itemId = String(body.itemId || "");
      const key = String(body.key || "");
      const uploadId = String(body.uploadId || "");
      const upload = await db.prepare(`SELECT file_name AS fileName,
        content_type AS contentType,file_size_bytes AS fileSizeBytes,
        quota_reservation_id AS quotaReservationId,finalizing
        FROM class_playlist_uploads
        WHERE id=? AND room_id=? AND user_id=? AND r2_key=? AND r2_upload_id=? LIMIT 1`)
        .bind(itemId, room.id, user.id, key, uploadId)
        .first<{ fileName: string; contentType: string; fileSizeBytes: number; quotaReservationId: string; finalizing: number }>();
      if (!upload || upload.finalizing)
        return NextResponse.json({ error: "Upload is not active" }, { status: 409 });
      const parts = (await db.prepare(`SELECT part_number AS partNumber,etag,size_bytes AS sizeBytes
        FROM class_playlist_upload_parts WHERE upload_id=? ORDER BY part_number`)
        .bind(itemId)
        .run<{ partNumber: number; etag: string; sizeBytes: number }>()).results || [];
      const total = parts.reduce((sum, part) => sum + Number(part.sizeBytes || 0), 0);
      if (!parts.length || total !== upload.fileSizeBytes
        || parts.some((part, index) => part.partNumber !== index + 1 || !part.etag))
        return NextResponse.json({ error: "Upload parts are incomplete" }, { status: 409 });
      const claim = await db.prepare(`UPDATE class_playlist_uploads SET
        finalizing=1,cleanup_next_at=?,updated_at=? WHERE id=? AND finalizing=0`)
        .bind(now + 30 * 60, now, itemId).run();
      if (Number(claim.meta?.changes || 0) !== 1)
        return NextResponse.json({ error: "Upload is already finalizing" }, { status: 409 });
      try {
        await storage.resumeMultipartUpload(key, uploadId).complete(
          parts.map(({ partNumber, etag }) => ({ partNumber, etag })),
        );
        await commitMemberStorageReservation(upload.quotaReservationId, upload.fileSizeBytes);
        const committed = await db.batch([
          db.prepare(`INSERT INTO class_playlist_items(
            id,room_id,title,source_type,r2_key,content_type,file_size_bytes,
            position,created_at,updated_at
          ) SELECT ?,?,?,'upload',?,?,?,
            COALESCE((SELECT MAX(position)+1 FROM class_playlist_items WHERE room_id=?),0),?,?
          WHERE (SELECT COUNT(*) FROM class_playlist_items WHERE room_id=?)<100`).bind(
            itemId, room.id, upload.fileName, key, upload.contentType,
            upload.fileSizeBytes, room.id, now, now, room.id,
          ),
          db.prepare(`DELETE FROM class_playlist_uploads WHERE id=?
            AND EXISTS(SELECT 1 FROM class_playlist_items WHERE id=?)`).bind(itemId, itemId),
        ]);
        if (Number(committed[0]?.meta?.changes || 0) !== 1)
          throw new Error("PLAYLIST_ITEM_LIMIT_REACHED");
        return NextResponse.json({ ok: true, itemId }, { status: 201 });
      } catch (error) {
        await db.prepare(`UPDATE class_playlist_uploads SET cleanup_next_at=?,
          cleanup_last_error=?,updated_at=? WHERE id=?`).bind(
          now + 60,
          error instanceof Error ? error.message.slice(0, 240) : "Upload finalization failed",
          now,
          itemId,
        ).run();
        throw error;
      }
    }

    if (action === "abort-upload") {
      const itemId = String(body.itemId || "");
      const upload = await db.prepare(`SELECT r2_key AS key,r2_upload_id AS uploadId,
        quota_reservation_id AS quotaReservationId FROM class_playlist_uploads
        WHERE id=? AND room_id=? AND user_id=? LIMIT 1`).bind(
          itemId, room.id, user.id,
        ).first<{ key: string; uploadId: string; quotaReservationId: string }>();
      if (upload) {
        await abortR2MultipartUploadIdempotently(storage, upload.key, upload.uploadId);
        await db.batch([
          db.prepare("DELETE FROM class_playlist_uploads WHERE id=?").bind(itemId),
          db.prepare(`UPDATE member_storage_quota_reservations SET state='released',
            reserved_bytes=0,reserved_objects=0,expires_at=NULL,updated_at=?
            WHERE id=?`).bind(now, upload.quotaReservationId),
        ]);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "start" || action === "select" || action === "enable") {
      const selected = String(body.itemId || "");
      const item = selected
        ? await db.prepare("SELECT id FROM class_playlist_items WHERE id=? AND room_id=?")
          .bind(selected, room.id).first<{ id: string }>()
        : await db.prepare(`SELECT id FROM class_playlist_items
          WHERE room_id=? ORDER BY position,created_at LIMIT 1`)
          .bind(room.id).first<{ id: string }>();
      if (!item) return NextResponse.json({ error: "Playlist is empty" }, { status: 409 });
      await db.prepare(`INSERT INTO class_playlist_state(
        room_id,active,current_item_id,started_at,offset_seconds,updated_by_user_id,updated_at
      ) VALUES(?,1,?,?,0,?,?) ON CONFLICT(room_id) DO UPDATE SET
        active=1,current_item_id=CASE WHEN ?='select' THEN excluded.current_item_id
          ELSE COALESCE(class_playlist_state.current_item_id,excluded.current_item_id) END,
        started_at=excluded.started_at,offset_seconds=0,
        updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`)
        .bind(room.id, item.id, now, user.id, now, action).run();
      return NextResponse.json({ ok: true });
    }

    if (action === "stop" || action === "disable") {
      await db.prepare(`INSERT INTO class_playlist_state(
        room_id,active,offset_seconds,updated_by_user_id,updated_at
      ) VALUES(?,0,0,?,?) ON CONFLICT(room_id) DO UPDATE SET
        active=0,offset_seconds=0,updated_by_user_id=excluded.updated_by_user_id,
        updated_at=excluded.updated_at`).bind(room.id, user.id, now).run();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid playlist action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    const code = error instanceof Error ? error.message : "PLAYLIST_UPDATE_FAILED";
    return NextResponse.json({
      error: code === "MEMBER_STORAGE_QUOTA_EXCEEDED"
        ? "Account storage quota exceeded"
        : code === "PLAYLIST_ITEM_LIMIT_REACHED"
          ? "This course playlist already has 100 items"
        : "Unable to update playlist",
      errorCode: code,
    }, { status: code === "MEMBER_STORAGE_QUOTA_EXCEEDED" ? 413
      : code === "PLAYLIST_ITEM_LIMIT_REACHED" ? 409 : 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const managed = await managerContext(request, code);
  if (managed instanceof Response) return managed;
  try {
    const body = await boundedJsonBody<{ items?: Array<{ id: string; title?: string }> }>(
      request,
      32 * 1024,
    );
    if (!Array.isArray(body.items) || body.items.length > 100)
      return NextResponse.json({ error: "Invalid playlist" }, { status: 400 });
    const now = Math.floor(Date.now() / 1_000);
    const statements = body.items.map((item, position) => getDatabase().prepare(
      "UPDATE class_playlist_items SET title=?,position=?,updated_at=? WHERE id=? AND room_id=?",
    ).bind(
      String(item.title || "Video").trim().slice(0, 120) || "Video",
      position,
      now,
      item.id,
      managed.room.id,
    ));
    if (statements.length) await getDatabase().batch(statements);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return error instanceof Response
      ? error
      : NextResponse.json({ error: "Unable to save playlist" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const managed = await managerContext(request, code);
  if (managed instanceof Response) return managed;
  const id = new URL(request.url).searchParams.get("id") || "";
  const item = await getDatabase().prepare(`SELECT r2_key AS r2Key
    FROM class_playlist_items WHERE id=? AND room_id=? LIMIT 1`)
    .bind(id, managed.room.id).first<{ r2Key: string | null }>();
  if (!item) return NextResponse.json({ error: "Playlist item not found" }, { status: 404 });
  const now = Math.floor(Date.now() / 1_000);
  if (item.r2Key && !item.r2Key.startsWith("demo:")) {
    await getDatabase().batch([
      getDatabase().prepare(`INSERT INTO class_file_tombstones(
        object_key,room_id,resource_kind,resource_id,attempts,next_attempt_at,requested_at,updated_at
      ) VALUES(?,?,'playlist',?,0,?,?,?) ON CONFLICT(object_key)
        DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),
          updated_at=excluded.updated_at`).bind(item.r2Key, managed.room.id, id, now, now, now),
      getDatabase().prepare("DELETE FROM class_playlist_items WHERE id=? AND room_id=?")
        .bind(id, managed.room.id),
    ]);
    try {
      const storage = await classFiles();
      if (!storage) throw new Error("STORAGE_UNAVAILABLE");
      await storage.delete(item.r2Key);
      await getDatabase().prepare("DELETE FROM class_file_tombstones WHERE object_key=?")
        .bind(item.r2Key).run();
      await releaseStorageResource("playlist", id);
    } catch {
      // The durable tombstone is retried by scheduled maintenance.
    }
  } else {
    await getDatabase().prepare("DELETE FROM class_playlist_items WHERE id=? AND room_id=?")
      .bind(id, managed.room.id).run();
  }
  return NextResponse.json({ ok: true });
}
