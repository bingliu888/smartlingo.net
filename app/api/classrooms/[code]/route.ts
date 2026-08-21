import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const room = await classByCode((await params).code);
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  const access = await classAccess(room, await getSessionUser(request));
  if (!access.allowed) return Response.json({ error: "Private course invitation required" }, { status: 403 });
  return Response.json({ room, access });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const room = await classByCode((await params).code);
  const user = await getSessionUser(request);
  if (!room || !user) return Response.json({ error: "Not found" }, { status: 404 });
  if (!await canManageClass(room, user)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const database = getDatabase();
  const courseRoom = await database.prepare("SELECT course_id AS courseId FROM smartlingo_course_classrooms WHERE room_id=? LIMIT 1")
    .bind(room.id).first<{ courseId: string }>();
  const practiceRoom = await database.prepare("SELECT course_id AS courseId FROM smartlingo_course_practice_rooms WHERE room_id=? LIMIT 1")
    .bind(room.id).first<{ courseId: string }>();
  const title = String(body.title || room.title).trim().slice(0, 120);
  const description = String(body.description ?? room.description).trim().slice(0, 2_000);
  const subject = String(body.subject ?? room.subject).trim().slice(0, 80);
  const classType = courseRoom || practiceRoom ? "private" : body.classType === "private" ? "private" : body.classType === "trial" ? "trial" : "public";
  const streamingMode = courseRoom ? "video" : practiceRoom ? "audio" : body.streamingMode === "audio" ? "audio" : "video";
  const realtimeMode = courseRoom ? "webinar" : practiceRoom ? "group_call" : body.realtimeMode === "webinar" ? "webinar" : body.realtimeMode === "livestream" ? "livestream" : "group_call";
  const startsAt = Math.floor(new Date(String(body.startsAt || new Date(room.startsAt * 1_000).toISOString())).getTime() / 1_000);
  const duration = Math.max(15, Math.min(480, Number(body.durationMinutes) || room.durationMinutes));
  const trial = classType === "trial" ? 7 * 24 * 60 : 0;
  const tuition = classType === "trial" ? Math.max(0, Math.min(10_000_000, Math.round(Number(body.tuition ?? room.tuitionCents / 100) * 100))) : 0;
  if (title.length < 3 || !Number.isFinite(startsAt)) return Response.json({ error: "Invalid course" }, { status: 400 });
  if (room.streamActive && (streamingMode !== room.streamingMode || realtimeMode !== room.realtimeMode)) {
    return Response.json({ error: "Media and interaction modes are locked while streaming is active" }, { status: 409 });
  }
  await database.prepare(`UPDATE live_class_rooms SET title=?,description=?,subject=?,class_type=?,streaming_mode=?,realtime_mode=?,
    starts_at=?,duration_minutes=?,trial_minutes=?,tuition_cents=?,mute_all=0,updated_at=? WHERE id=?`)
    .bind(title, description, subject, classType, streamingMode, realtimeMode, startsAt, duration, trial, tuition, Math.floor(Date.now() / 1_000), room.id).run();
  return Response.json({ ok: true, courseWebinarLocked: Boolean(courseRoom), coursePracticeRoomLocked: Boolean(practiceRoom) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const room = await classByCode((await params).code);
  const user = await getSessionUser(request);
  if (!room || !user) return Response.json({ error: "Not found" }, { status: 404 });
  if (!await canManageClass(room, user)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const database = getDatabase();
  if (await database.prepare(`SELECT room_id FROM smartlingo_course_classrooms WHERE room_id=?
    UNION ALL SELECT room_id FROM smartlingo_course_practice_rooms WHERE room_id=? LIMIT 1`).bind(room.id, room.id).first()) {
    return Response.json({ error: "Course teaching and practice rooms cannot be deleted" }, { status: 409 });
  }
  const objects = (await database.prepare("SELECT r2_key AS r2Key FROM class_playlist_items WHERE room_id=? AND r2_key IS NOT NULL").bind(room.id).run<{ r2Key: string }>()).results || [];
  if (objects.length) {
    const { env } = await import("cloudflare:workers");
    const bucket = env.CLASS_FILES as unknown as { delete(keys: string | string[]): Promise<unknown> } | undefined;
    if (bucket) await bucket.delete(objects.map(item => item.r2Key));
  }
  await database.prepare("DELETE FROM live_class_rooms WHERE id=?").bind(room.id).run();
  return Response.json({ ok: true });
}
