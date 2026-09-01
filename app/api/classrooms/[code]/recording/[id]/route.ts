import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";
import { boundedByteRange } from "@/lib/class-file-range";
import { cachedPrivateFileRange, cachedPrivateFileSize } from "@/lib/private-file-range-cache";
import { deleteClassRecordingArtifact } from "@/lib/class-recording";

type R2Object = { body: ReadableStream<Uint8Array>; size: number };
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
  const artifact = await getDatabase().prepare(`SELECT audio_r2_key AS objectKey,
    audio_size_bytes AS size,updated_at AS updatedAt FROM class_recording_artifacts
    WHERE id=? AND room_id=? AND status='ready' LIMIT 1`)
    .bind(id, room.id)
    .first<{ objectKey: string; size: number; updatedAt: number }>();
  if (!artifact?.objectKey || !artifact.size) return new Response("Not found", { status: 404 });
  const storage = await bucket();
  if (!storage) return new Response("Storage unavailable", { status: 503 });
  const version = `${artifact.size}:${artifact.updatedAt}`;
  const size = await cachedPrivateFileSize({
    namespace: "class-recording",
    objectKey: artifact.objectKey,
    version,
    load: async () => Number((await storage.head(artifact.objectKey))?.size || 0),
  });
  if (!size || size !== artifact.size)
    return new Response("Recording is temporarily unavailable", { status: 503 });
  const range = boundedByteRange(request.headers.get("range"), size, 4 * 1024 * 1024, true);
  if (!range)
    return new Response("Invalid byte range", {
      status: 416,
      headers: { "content-range": `bytes */${size}`, "cache-control": "no-store" },
    });
  const response = await cachedPrivateFileRange({
    namespace: "class-recording",
    objectKey: artifact.objectKey,
    version,
    offset: range.offset,
    length: range.length,
    load: () => storage.get(artifact.objectKey, {
      range: { offset: range.offset, length: range.length },
    }),
  });
  if (!response) return new Response("Not found", { status: 404 });
  const headers = new Headers(response.headers);
  headers.set("content-type", "audio/mp4");
  headers.set("content-length", String(range.length));
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
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
  if (!await deleteClassRecordingArtifact(room.id, id))
    return Response.json({ error: "Recording not found" }, { status: 404 });
  return Response.json({ ok: true });
}
