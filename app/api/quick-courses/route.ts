import { createId, getDatabase, getSessionUser } from "../../../lib/auth";
import {
  SMARTLINGO_QUICK_COURSE_VERSION,
  isCourseDuration,
  isCourseLevel,
  previousCourseDuration,
  type SmartLingoCourseDays,
  type SmartLingoCourseLevel,
} from "../../../lib/smartlingo-quick-courses";
import { languageCatalogEntry } from "../../../lib/smartlingo-paths";

export const dynamic = "force-dynamic";

type OfferingRow = {
  id: string;
  targetLanguage: string;
  durationDays: number;
  level: SmartLingoCourseLevel;
  sequence: number;
  isFree: number;
  status: string;
  curriculumVersion: string;
};

const offeringSelect = `SELECT id, target_language AS targetLanguage,
  duration_days AS durationDays, level, sequence, is_free AS isFree, status,
  curriculum_version AS curriculumVersion
  FROM smartlingo_course_offerings_v3`;

export async function GET() {
  const result = await getDatabase().prepare(`${offeringSelect}
    WHERE status = 'published' ORDER BY target_language,
      CASE level WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 ELSE 3 END, sequence`).run<OfferingRow>();
  return Response.json({
    version: SMARTLINGO_QUICK_COURSE_VERSION,
    offerings: (result.results || []).map(item => ({ ...item, isFree: Boolean(item.isFree) })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  let body: { targetLanguage?: unknown; level?: unknown; durationDays?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "A valid JSON body is required" }, { status: 400 });
  }
  const language = typeof body.targetLanguage === "string" ? languageCatalogEntry(body.targetLanguage) : null;
  const level = body.level ?? "beginner";
  if (!language || !isCourseLevel(level) || !isCourseDuration(level, body.durationDays)) {
    return Response.json({ error: "Choose a supported language, level, and course duration." }, { status: 400 });
  }

  const database = getDatabase();
  const offering = await database.prepare(`${offeringSelect}
    WHERE target_language = ? AND level = ? AND duration_days = ? AND status = 'published' LIMIT 1`)
    .bind(language.code, level, Number(body.durationDays)).first<OfferingRow>();
  if (!offering) return Response.json({ error: "This course is not currently open." }, { status: 404 });

  const durationDays = Number(body.durationDays) as SmartLingoCourseDays;
  const priorDuration = previousCourseDuration(level, durationDays);
  let startDay = 1;
  if (priorDuration) {
    const prior = await database.prepare(`SELECT duration_days AS durationDays
      FROM smartlingo_course_certificates_v2
      WHERE user_id = ? AND target_language = ? AND level = ?
        AND duration_days IN (${level === "beginner" && durationDays === 30 ? "7,14" : String(priorDuration)})
      ORDER BY duration_days DESC LIMIT 1`)
      .bind(user.id, language.code, level).first<{ durationDays: number }>();
    if (prior) startDay = Number(prior.durationDays) + 1;
  }

  const now = Math.floor(Date.now() / 1000);
  const accessType = offering.isFree ? "free" : "payment_required";
  const status = offering.isFree ? "active" : "pending_payment";
  const enrollmentId = createId();
  await database.prepare(`INSERT INTO smartlingo_course_enrollments_v3
    (id, offering_id, user_id, class_id, access_type, status, start_day, current_day,
     daily_seconds, started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3600, ?, ?, ?)
    ON CONFLICT(user_id, offering_id) DO UPDATE SET
      class_id = excluded.class_id,
      access_type = excluded.access_type,
      status = CASE
        WHEN smartlingo_course_enrollments_v3.status = 'completed' THEN 'completed'
        ELSE excluded.status END,
      updated_at = excluded.updated_at`)
    .bind(enrollmentId, offering.id, user.id, language.classId, accessType, status, startDay, startDay, now, now, now).run();

  const enrollment = await database.prepare(`SELECT id, current_day AS currentDay, start_day AS startDay
    FROM smartlingo_course_enrollments_v3 WHERE user_id = ? AND offering_id = ? LIMIT 1`)
    .bind(user.id, offering.id).first<{ id: string; currentDay: number; startDay: number }>();
  if (enrollment) {
    await database.prepare(`INSERT INTO smartlingo_course_session_state
      (enrollment_id, course_day, duration_seconds, remaining_seconds, status, updated_at)
      VALUES (?, ?, 3600, 3600, 'ready', ?)
      ON CONFLICT(enrollment_id) DO NOTHING`)
      .bind(enrollment.id, enrollment.currentDay, now).run();
  }

  return Response.json({
    enrollment: {
      offeringId: offering.id,
      targetLanguage: offering.targetLanguage,
      level: offering.level,
      durationDays: offering.durationDays,
      accessType,
      status,
      startDay: enrollment?.startDay ?? startDay,
      currentDay: enrollment?.currentDay ?? startDay,
      dailyMinutes: 60,
    },
    checkoutEnabled: false,
    notice: offering.isFree
      ? "The free course is ready. Each course day has a resumable 60-minute learning session."
      : "Your course choice is saved. Live checkout is not enabled yet, so no charge was made.",
  }, { status: 201 });
}
