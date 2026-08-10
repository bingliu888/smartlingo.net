import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin-access";
import { createId, getDatabase, getSessionUser, type SessionUser } from "@/lib/auth";
import { classAccess, classByCode, type ClassRoom } from "@/lib/live-classrooms";

type MultipartPart = { partNumber: number; etag: string };
type MultipartUpload = {
  uploadPart(partNumber: number, value: ArrayBuffer): Promise<MultipartPart>;
  complete(parts: MultipartPart[]): Promise<unknown>;
  abort(): Promise<void>;
};
type R2Bucket = {
  createMultipartUpload(key: string, options: { httpMetadata: { contentType: string } }): Promise<{ uploadId: string; key: string }>;
  resumeMultipartUpload(key: string, uploadId: string): MultipartUpload;
  delete(key: string): Promise<unknown>;
};
type PlaylistItem = { id: string; title: string; sourceType: "upload"; sourceUrl: null; contentType: string; fileSizeBytes: number; position: number; createdAt: number };

export const dynamic = "force-dynamic";
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const itemSelection = `SELECT id,title,source_type AS sourceType,source_url AS sourceUrl,content_type AS contentType,file_size_bytes AS fileSizeBytes,position,created_at AS createdAt FROM class_playlist_items WHERE room_id=? ORDER BY position,created_at`;

function safeFileName(value: unknown) {
  return String(value || "video").replace(/[^\w.()\- ]+/g, "_").slice(0, 120) || "video";
}
async function context(request: Request, code: string) {
  const room = await classByCode(code);
  if (!room) return null;
  const user = await getSessionUser(request);
  const access = await classAccess(room, user);
  return { room, user, access, manager: Boolean(user && (user.id === room.hostUserId || await isAdminUser(user))) };
}
async function managerContext(request: Request, code: string): Promise<{ room: ClassRoom; user: SessionUser } | Response> {
  const value = await context(request, code);
  if (!value) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (!value.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!value.manager) return NextResponse.json({ error: "Teacher permission required" }, { status: 403 });
  return { room: value.room, user: value.user };
}
async function classFiles() {
  const { env } = await import("cloudflare:workers");
  return env.CLASS_FILES as unknown as R2Bucket | undefined;
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params, value = await context(request, code);
  if (!value) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (!value.access.allowed) return NextResponse.json({ error: "Class access required" }, { status: value.user ? 403 : 401 });
  const db = getDatabase();
  const [items, state] = await Promise.all([
    db.prepare(itemSelection).bind(value.room.id).run<PlaylistItem>(),
    db.prepare("SELECT active,current_item_id AS currentItemId,started_at AS startedAt,offset_seconds AS offsetSeconds,updated_at AS updatedAt FROM class_playlist_state WHERE room_id=?").bind(value.room.id).first(),
  ]);
  return NextResponse.json({ items: items.results || [], state: state || { active: 0, currentItemId: null, startedAt: null, offsetSeconds: 0, updatedAt: 0 }, manager: value.manager, streamActive: Boolean(value.room.streamActive) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params, managed = await managerContext(request, code);
    if (managed instanceof Response) return managed;
    const { room, user } = managed, contentType = request.headers.get("content-type") || "";
    if (contentType === "application/octet-stream") {
      const key = request.headers.get("x-playlist-key") || "", uploadId = request.headers.get("x-r2-upload-id") || "", partNumber = Number(request.headers.get("x-part-number") || 0);
      if (!key.startsWith(`classes/${room.id}/playlist/`) || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 100) return NextResponse.json({ error: "Invalid upload part" }, { status: 400 });
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength < 1 || bytes.byteLength > 8 * 1024 * 1024) return NextResponse.json({ error: "Invalid upload chunk" }, { status: 413 });
      const bucket = await classFiles();
      if (!bucket) return NextResponse.json({ error: "File storage is unavailable" }, { status: 503 });
      return NextResponse.json(await bucket.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, bytes));
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>, action = String(body.action || ""), db = getDatabase(), now = Math.floor(Date.now() / 1000);
    if (action === "init-upload") {
      const size = Number(body.size || 0), fileName = safeFileName(body.fileName), videoType = String(body.contentType || "video/mp4").slice(0, 100);
      if (!videoType.startsWith("video/") || size < 1 || size > MAX_VIDEO_SIZE) return NextResponse.json({ error: "Choose a video file up to 500 MB" }, { status: 413 });
      const itemId = createId(), key = `classes/${room.id}/playlist/${itemId}-${fileName}`, bucket = await classFiles();
      if (!bucket) return NextResponse.json({ error: "File storage is unavailable" }, { status: 503 });
      const upload = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: videoType } });
      return NextResponse.json({ itemId, key: upload.key, uploadId: upload.uploadId });
    }
    if (action === "complete-upload") {
      const itemId = String(body.itemId || ""), key = String(body.key || ""), uploadId = String(body.uploadId || ""), parts = Array.isArray(body.parts) ? body.parts as MultipartPart[] : [], size = Number(body.size || 0), videoType = String(body.contentType || "video/mp4").slice(0, 100), title = String(body.title || body.fileName || "Video").trim().slice(0, 120) || "Video";
      if (!/^[\w-]{8,}$/.test(itemId) || !key.startsWith(`classes/${room.id}/playlist/${itemId}-`) || !uploadId || !parts.length || parts.some(part => !Number.isInteger(part.partNumber) || !part.etag) || size < 1 || size > MAX_VIDEO_SIZE) return NextResponse.json({ error: "Invalid completed upload" }, { status: 400 });
      const bucket = await classFiles();
      if (!bucket) return NextResponse.json({ error: "File storage is unavailable" }, { status: 503 });
      await bucket.resumeMultipartUpload(key, uploadId).complete(parts);
      const next = await db.prepare("SELECT COALESCE(MAX(position),-1)+1 AS position FROM class_playlist_items WHERE room_id=?").bind(room.id).first<{ position: number }>();
      await db.prepare("INSERT INTO class_playlist_items(id,room_id,title,source_type,r2_key,content_type,file_size_bytes,position,created_at,updated_at) VALUES(?,?,?,'upload',?,?,?,?,?,?)").bind(itemId, room.id, title, key, videoType, size, Number(next?.position || 0), now, now).run();
      return NextResponse.json({ ok: true, itemId }, { status: 201 });
    }
    if (action === "abort-upload") {
      const key = String(body.key || ""), uploadId = String(body.uploadId || "");
      if (key.startsWith(`classes/${room.id}/playlist/`) && uploadId) await (await classFiles())?.resumeMultipartUpload(key, uploadId).abort().catch(() => undefined);
      return NextResponse.json({ ok: true });
    }
    if (action === "start" || action === "select" || action === "enable") {
      const selected = String(body.itemId || "");
      const item = selected ? await db.prepare("SELECT id FROM class_playlist_items WHERE id=? AND room_id=?").bind(selected, room.id).first<{ id: string }>() : await db.prepare("SELECT id FROM class_playlist_items WHERE room_id=? ORDER BY position,created_at LIMIT 1").bind(room.id).first<{ id: string }>();
      if (!item) return NextResponse.json({ error: "Playlist is empty" }, { status: 409 });
      await db.prepare("INSERT INTO class_playlist_state(room_id,active,current_item_id,started_at,offset_seconds,updated_by_user_id,updated_at) VALUES(?,1,?,?,0,?,?) ON CONFLICT(room_id) DO UPDATE SET active=1,current_item_id=CASE WHEN ?='select' THEN excluded.current_item_id ELSE COALESCE(class_playlist_state.current_item_id,excluded.current_item_id) END,started_at=excluded.started_at,offset_seconds=0,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at").bind(room.id, item.id, now, user.id, now, action).run();
      return NextResponse.json({ ok: true });
    }
    if (action === "stop" || action === "disable") {
      await db.prepare("INSERT INTO class_playlist_state(room_id,active,offset_seconds,updated_by_user_id,updated_at) VALUES(?,0,0,?,?) ON CONFLICT(room_id) DO UPDATE SET active=0,offset_seconds=0,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at").bind(room.id, user.id, now).run();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid playlist action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update playlist" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params, managed = await managerContext(request, code);
    if (managed instanceof Response) return managed;
    const body = await request.json().catch(() => ({})) as { items?: Array<{ id: string; title?: string }> };
    if (!Array.isArray(body.items) || body.items.length > 100) return NextResponse.json({ error: "Invalid playlist" }, { status: 400 });
    const now = Math.floor(Date.now() / 1000), statements = body.items.map((item, position) => getDatabase().prepare("UPDATE class_playlist_items SET title=?,position=?,updated_at=? WHERE id=? AND room_id=?").bind(String(item.title || "Video").trim().slice(0, 120) || "Video", position, now, item.id, managed.room.id));
    if (statements.length) await getDatabase().batch(statements);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to save playlist" }, { status: 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params, managed = await managerContext(request, code);
    if (managed instanceof Response) return managed;
    const id = new URL(request.url).searchParams.get("id") || "", item = await getDatabase().prepare("SELECT r2_key AS r2Key FROM class_playlist_items WHERE id=? AND room_id=?").bind(id, managed.room.id).first<{ r2Key: string | null }>();
    if (!item) return NextResponse.json({ error: "Playlist item not found" }, { status: 404 });
    if (item.r2Key) await (await classFiles())?.delete(item.r2Key);
    await getDatabase().prepare("DELETE FROM class_playlist_items WHERE id=? AND room_id=?").bind(id, managed.room.id).run();
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete playlist item" }, { status: 500 }); }
}
