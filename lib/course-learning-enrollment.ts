import { createId, type getDatabase } from "./auth";
import type { SmartLingoPackageTier } from "./smartlingo-course-packages";

export async function ensureCourseLearningEnrollment(database: ReturnType<typeof getDatabase>, course: {
  id: string; targetLanguage: string; packageTier: SmartLingoPackageTier;
}, userId: string, now = Math.floor(Date.now() / 1000)) {
  const level = course.packageTier === "basic" ? "beginner" : course.packageTier;
  const offering = await database.prepare(`SELECT id FROM smartlingo_course_offerings_v3
    WHERE target_language=? AND level=? AND status='published'
    ORDER BY duration_days DESC LIMIT 1`).bind(course.targetLanguage, level).first<{ id: string }>();
  if (!offering) throw new Error("LEARNING_OFFERING_NOT_FOUND");
  await database.prepare(`INSERT INTO smartlingo_course_enrollments_v3
    (id,offering_id,user_id,class_id,access_type,status,start_day,current_day,daily_seconds,started_at,created_at,updated_at)
    VALUES(?,?,?,?,'entitled','active',1,1,3600,?,?,?)
    ON CONFLICT(user_id,offering_id) DO UPDATE SET class_id=excluded.class_id,access_type='entitled',
      status=CASE WHEN smartlingo_course_enrollments_v3.status='completed' THEN 'completed' ELSE 'active' END,
      updated_at=excluded.updated_at`)
    .bind(createId(), offering.id, userId, course.id, now, now, now).run();
  const enrollment = await database.prepare(`SELECT id,current_day AS currentDay
    FROM smartlingo_course_enrollments_v3 WHERE user_id=? AND offering_id=? LIMIT 1`)
    .bind(userId, offering.id).first<{ id: string; currentDay: number }>();
  if (!enrollment) throw new Error("LEARNING_ENROLLMENT_NOT_FOUND");
  await database.prepare(`INSERT INTO smartlingo_course_session_state
    (enrollment_id,course_day,duration_seconds,remaining_seconds,status,updated_at)
    VALUES(?,?,3600,3600,'ready',?) ON CONFLICT(enrollment_id) DO NOTHING`)
    .bind(enrollment.id, enrollment.currentDay, now).run();
  return enrollment.id;
}
