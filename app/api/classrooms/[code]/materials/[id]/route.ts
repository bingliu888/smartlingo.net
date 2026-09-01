import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";
import { boundedByteRange } from "@/lib/class-file-range";
import { cachedPrivateFileRange, cachedPrivateFileSize } from "@/lib/private-file-range-cache";
import { releaseStorageResource } from "@/lib/member-storage-quota";

type R2Object = {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpMetadata?: { contentType?: string };
};
type R2Bucket = {
  head(key: string): Promise<{ size: number } | null>;
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<R2Object | null>;
  delete(key: string): Promise<unknown>;
};

async function bucket() {
  const { env } = await import("cloudflare:workers");
  return env.CLASS_FILES as unknown as R2Bucket | undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await params;
  const room = await classByCode(code);
  if (!room) return new Response("Not found", { status: 404 });
  const user = await getSessionUser(request);
  const access = await classAccess(room, user);
  if (!access.allowed)
    return new Response("Course access required", { status: user ? 403 : 401 });
  const material = await getDatabase().prepare(`SELECT object_key AS objectKey,
    content_type AS contentType,byte_size AS byteSize,created_at AS createdAt
    FROM live_class_materials WHERE id=? AND room_id=? LIMIT 1`)
    .bind(id, room.id)
    .first<{ objectKey: string; contentType: string; byteSize: number; createdAt: number }>();
  if (!material) return new Response("Not found", { status: 404 });
  const storage = await bucket();
  if (!storage) return new Response("Storage unavailable", { status: 503 });

  const version = `${material.byteSize}:${material.createdAt}`;
  const size = await cachedPrivateFileSize({
    namespace: "class-material",
    objectKey: material.objectKey,
    version,
    load: async () => Number((await storage.head(material.objectKey))?.size || 0),
  });
  if (!size || size !== material.byteSize)
    return new Response("Attachment is temporarily unavailable", { status: 503 });
  const range = boundedByteRange(request.headers.get("range"), size, 4 * 1024 * 1024, size > 4 * 1024 * 1024);
  if (!range)
    return new Response("Invalid byte range", {
      status: 416,
      headers: { "content-range": `bytes */${size}`, "cache-control": "no-store" },
    });
  const response = await cachedPrivateFileRange({
    namespace: "class-material",
    objectKey: material.objectKey,
    version,
    offset: range.offset,
    length: range.length,
    load: () => storage.get(material.objectKey, {
      range: { offset: range.offset, length: range.length },
    }),
  });
  if (!response) return new Response("Not found", { status: 404 });
  const headers = new Headers(response.headers);
  headers.set("content-type", material.contentType || "application/octet-stream");
  headers.set("content-length", String(range.length));
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-disposition", "inline");
  if (range.contentRange) headers.set("content-range", range.contentRange);
  return new Response(response.body, { status: range.status, headers });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  const user = await getSessionUser(request);
  if (!user || !await canManageClass(room, user))
    return Response.json({ error: "Manager access required" }, { status: 403 });
  const material = await getDatabase().prepare(
    "SELECT object_key AS objectKey FROM live_class_materials WHERE id=? AND room_id=? LIMIT 1",
  ).bind(id, room.id).first<{ objectKey: string }>();
  if (!material) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const now = Math.floor(Date.now() / 1_000);
  await getDatabase().batch([
    getDatabase().prepare(`INSERT INTO class_file_tombstones(
      object_key,room_id,resource_kind,resource_id,attempts,next_attempt_at,requested_at,updated_at
    ) VALUES(?,?, 'material',?,0,?,?,?) ON CONFLICT(object_key)
      DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
      .bind(material.objectKey, room.id, id, now, now, now),
    getDatabase().prepare("DELETE FROM live_class_materials WHERE id=? AND room_id=?").bind(id, room.id),
  ]);
  const storage = await bucket();
  try {
    if (!storage) throw new Error("STORAGE_UNAVAILABLE");
    await storage.delete(material.objectKey);
    await getDatabase().prepare("DELETE FROM class_file_tombstones WHERE object_key=?")
      .bind(material.objectKey).run();
    await releaseStorageResource("material", id);
  } catch {
    // The scheduled cleanup worker owns this durable tombstone.
  }
  return Response.json({ ok: true });
}
