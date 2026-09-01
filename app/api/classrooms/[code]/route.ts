import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { requestClassDeletion } from "@/lib/class-deletion";
import { hashClassPassword } from "@/lib/class-password";
import { safeClassTimeZone } from "@/lib/class-time-zone";

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
  let body: Record<string, unknown>;
  try { body = await boundedJsonBody<Record<string, unknown>>(request, 16 * 1024); }
  catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Invalid request" }, { status: 400 });
  }
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
  const timeZone = safeClassTimeZone(body.timeZone, room.timeZone);
  const suppliedPassword = Object.hasOwn(body, "password") ? String(body.password || "").trim() : null;
  const clearPassword = body.clearPassword === true || body.clearPassword === "true";
  if (title.length < 3 || !Number.isFinite(startsAt)) return Response.json({ error: "Invalid course" }, { status: 400 });
  if (suppliedPassword && (suppliedPassword.length < 4 || suppliedPassword.length > 72))
    return Response.json({ error: "Course passwords must be 4–72 characters" }, { status: 400 });
  if (room.streamActive && (streamingMode !== room.streamingMode || realtimeMode !== room.realtimeMode)) {
    return Response.json({ error: "Media and interaction modes are locked while streaming is active" }, { status: 409 });
  }
  const passwordHash = clearPassword ? null
    : suppliedPassword ? await hashClassPassword(suppliedPassword) : undefined;
  await database.prepare(`UPDATE live_class_rooms SET title=?,description=?,subject=?,class_type=?,streaming_mode=?,realtime_mode=?,
    starts_at=?,duration_minutes=?,trial_minutes=?,tuition_cents=?,time_zone=?,
    password_hash=CASE WHEN ?=1 THEN NULL WHEN ? IS NOT NULL THEN ? ELSE password_hash END,
    mute_all=0,updated_at=? WHERE id=?`)
    .bind(title, description, subject, classType, streamingMode, realtimeMode, startsAt, duration, trial, tuition,
      timeZone, clearPassword ? 1 : 0, passwordHash ?? null, passwordHash ?? null,
      Math.floor(Date.now() / 1_000), room.id).run();
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
    return Response.json({ error: "Course rooms cannot be deleted" }, { status: 409 });
  }
  await requestClassDeletion({
    roomId: room.id,
    roomCode: room.code,
    hostUserId: room.hostUserId,
    providerMeetingId: room.providerMeetingId,
    providerGeneration: room.providerGeneration,
  });
  return Response.json({ ok: true, queued: true }, { status: 202 });
}
