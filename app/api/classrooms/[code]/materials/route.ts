import { boundedRequestStream } from "@/lib/bounded-request-body";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";
import {
  MATERIAL_FILE_MAX_BYTES,
  commitMemberStorageReservation,
  releaseMemberStorageReservation,
  reserveMemberStorage,
} from "@/lib/member-storage-quota";

type R2Bucket = {
  put(key: string, value: ReadableStream<Uint8Array>, options: {
    httpMetadata: { contentType: string };
    customMetadata?: Record<string, string>;
  }): Promise<{ size?: number } | null>;
  delete(key: string): Promise<unknown>;
};

const ALLOWED_TYPES = new Set([
  "application/json",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain",
]);

function safeFileName(value: unknown) {
  let decoded = String(value || "file");
  try { decoded = decodeURIComponent(decoded); } catch { /* retain the safe raw value */ }
  return decoded
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "file";
}

async function bucket() {
  const { env } = await import("cloudflare:workers");
  return env.CLASS_FILES as unknown as R2Bucket | undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  const user = await getSessionUser(request);
  const access = await classAccess(room, user);
  if (!access.allowed)
    return Response.json({ error: "Course access required" }, { status: user ? 403 : 401 });
  const materials = (await getDatabase().prepare(`SELECT id,file_name AS fileName,
    content_type AS contentType,byte_size AS fileSizeBytes,created_at AS createdAt
    FROM live_class_materials WHERE room_id=? ORDER BY created_at DESC,id DESC LIMIT 100`)
    .bind(room.id)
    .run()).results || [];
  return Response.json({ materials }, { headers: { "cache-control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!await canManageClass(room, user))
    return Response.json({ error: "Manager access required" }, { status: 403 });
  if (!user.emailVerified)
    return Response.json({ error: "Verify your email before uploading files", errorCode: "VERIFIED_MEMBER_REQUIRED" }, { status: 403 });

  const declared = Number(request.headers.get("content-length") || request.headers.get("x-file-size") || 0);
  const contentType = String(request.headers.get("content-type") || "application/octet-stream")
    .split(";")[0].trim().toLowerCase();
  const fileName = safeFileName(request.headers.get("x-file-name"));
  if (!Number.isSafeInteger(declared) || declared < 1 || declared > MATERIAL_FILE_MAX_BYTES)
    return Response.json({ error: "Choose a file up to 15 MB" }, { status: 413 });
  if (!ALLOWED_TYPES.has(contentType))
    return Response.json({ error: "Unsupported attachment type" }, { status: 415 });
  const count = Number((await getDatabase().prepare(
    "SELECT COUNT(*) AS count FROM live_class_materials WHERE room_id=?",
  ).bind(room.id).first<{ count: number }>())?.count || 0);
  if (count >= 100)
    return Response.json({ error: "This course already has 100 attachments" }, { status: 409 });

  const storage = await bucket();
  if (!storage) return Response.json({ error: "File storage is unavailable" }, { status: 503 });
  const id = createId();
  const objectKey = `classes/${room.id}/materials/${id}-${fileName}`;
  let reservation: { id: string } | null = null;
  try {
    reservation = await reserveMemberStorage({
      hostUserId: room.hostUserId,
      roomId: room.id,
      resourceKind: "material",
      resourceId: id,
      bytes: declared,
      expiresInSeconds: 2 * 60 * 60,
    });
    const now = Math.floor(Date.now() / 1_000);
    await getDatabase().prepare(`INSERT INTO class_material_uploads(
      id,room_id,user_id,object_key,quota_reservation_id,file_name,content_type,file_size_bytes,
      finalizing,cleanup_next_at,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,1,?,?,?)`).bind(
      id, room.id, user.id, objectKey, reservation.id, fileName, contentType, declared,
      now + 30 * 60, now, now,
    ).run();
    const streamed = boundedRequestStream(request, MATERIAL_FILE_MAX_BYTES);
    const object = await storage.put(objectKey, streamed.body, {
      httpMetadata: { contentType },
      customMetadata: { roomId: room.id, materialId: id },
    });
    const received = streamed.receivedBytes();
    if (received !== declared || (object?.size && object.size !== declared)) {
      await storage.delete(objectKey).catch(() => undefined);
      throw new Error("UPLOAD_SIZE_MISMATCH");
    }
    await commitMemberStorageReservation(reservation.id, declared);
    const committed = await getDatabase().batch([
      getDatabase().prepare(`INSERT INTO live_class_materials(
        id,room_id,uploader_user_id,file_name,content_type,object_key,byte_size,created_at
      ) SELECT ?,?,?,?,?,?,?,? WHERE (
        SELECT COUNT(*) FROM live_class_materials WHERE room_id=?
      )<100`).bind(
        id, room.id, user.id, fileName, contentType, objectKey, declared, now,
        room.id,
      ),
      getDatabase().prepare(`DELETE FROM class_material_uploads WHERE id=?
        AND EXISTS(SELECT 1 FROM live_class_materials WHERE id=?)`).bind(id, id),
    ]);
    if (Number(committed[0]?.meta?.changes || 0) !== 1)
      throw new Error("MATERIAL_LIMIT_REACHED");
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (reservation) await releaseMemberStorageReservation(reservation.id).catch(() => undefined);
    await storage.delete(objectKey).catch(() => undefined);
    await getDatabase().prepare("DELETE FROM class_material_uploads WHERE id=?")
      .bind(id).run().catch(() => undefined);
    const code = error instanceof Error ? error.message : "MATERIAL_UPLOAD_FAILED";
    return Response.json({
      error: code === "MEMBER_STORAGE_QUOTA_EXCEEDED"
        ? "Account storage quota exceeded"
        : code === "MATERIAL_LIMIT_REACHED"
          ? "This course already has 100 attachments"
        : "Unable to upload attachment",
      errorCode: code,
    }, { status: code === "MEMBER_STORAGE_QUOTA_EXCEEDED" ? 413
      : code === "MATERIAL_LIMIT_REACHED" ? 409 : 500 });
  }
}
