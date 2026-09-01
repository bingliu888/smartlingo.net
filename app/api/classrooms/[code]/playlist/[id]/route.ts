import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { boundedByteRange } from "@/lib/class-file-range";
import { cachedPrivateFileRange, cachedPrivateFileSize } from "@/lib/private-file-range-cache";

type R2Object = { body: ReadableStream<Uint8Array>; size: number };
type R2Bucket = {
  head(key: string): Promise<{ size: number } | null>;
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<R2Object | null>;
};

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
  const item = await getDatabase().prepare(`SELECT r2_key AS r2Key,
    content_type AS contentType,file_size_bytes AS size,updated_at AS updatedAt
    FROM class_playlist_items
    WHERE id=? AND room_id=? AND source_type='upload' LIMIT 1`)
    .bind(id, room.id)
    .first<{ r2Key: string; contentType: string; size: number; updatedAt: number }>();
  if (!item?.r2Key) return new Response("Not found", { status: 404 });
  const { env } = await import("cloudflare:workers");

  if (item.r2Key.startsWith("demo:")) {
    const assets = env.ASSETS as unknown as { fetch(request: Request): Promise<Response> } | undefined;
    if (!assets) return new Response("Storage unavailable", { status: 503 });
    const headers = new Headers();
    const requestedRange = request.headers.get("range");
    if (requestedRange) headers.set("range", requestedRange);
    const response = await assets.fetch(new Request(
      new URL(item.r2Key.slice(5), request.url),
      { headers },
    ));
    const output = new Headers(response.headers);
    output.set("cache-control", "private, no-store");
    output.set("x-content-type-options", "nosniff");
    return new Response(response.body, { status: response.status, headers: output });
  }

  const storage = env.CLASS_FILES as unknown as R2Bucket | undefined;
  if (!storage) return new Response("Storage unavailable", { status: 503 });
  const version = `${item.size}:${item.updatedAt}`;
  const size = await cachedPrivateFileSize({
    namespace: "class-playlist",
    objectKey: item.r2Key,
    version,
    load: async () => Number((await storage.head(item.r2Key))?.size || 0),
  });
  if (!size || size !== item.size)
    return new Response("Video is temporarily unavailable", { status: 503 });
  const range = boundedByteRange(request.headers.get("range"), size, 4 * 1024 * 1024, true);
  if (!range)
    return new Response("Invalid byte range", {
      status: 416,
      headers: { "content-range": `bytes */${size}`, "cache-control": "no-store" },
    });
  const response = await cachedPrivateFileRange({
    namespace: "class-playlist",
    objectKey: item.r2Key,
    version,
    offset: range.offset,
    length: range.length,
    load: () => storage.get(item.r2Key, {
      range: { offset: range.offset, length: range.length },
    }),
  });
  if (!response) return new Response("Not found", { status: 404 });
  const headers = new Headers(response.headers);
  headers.set("content-type", item.contentType || "video/mp4");
  headers.set("content-length", String(range.length));
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  if (range.contentRange) headers.set("content-range", range.contentRange);
  return new Response(response.body, { status: range.status, headers });
}
