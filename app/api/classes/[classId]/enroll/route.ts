import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import { cleanText } from "../../../../../lib/smartlingo-classes";
import { ensureCourseLearningEnrollment } from "../../../../../lib/course-learning-enrollment";
import { hasCourseTierAccess } from "../../../../../lib/platform-entitlements";

type Course = {
  id: string; capacity: number; enrollmentCount: number;
  targetLanguage: string; packageTier: "basic" | "intermediate" | "advanced"; classKind: "official_course" | "subject";
};

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const classId = cleanText((await params).classId, 100);
  const database = getDatabase();
  const course = await database.prepare(`SELECT c.id,c.price_cents AS priceCents,c.trial_days AS trialDays,c.capacity,
    c.target_language AS targetLanguage,c.package_tier AS packageTier,c.class_kind AS classKind,
    COALESCE(SUM(CASE WHEN m.role='student' AND m.status='active' THEN 1 ELSE 0 END),0) AS enrollmentCount
    FROM smartlingo_language_classes c LEFT JOIN smartlingo_language_class_members m ON m.class_id=c.id
    WHERE c.id=? AND c.class_kind IN ('official_course','subject') AND c.status='open' AND c.visibility='public'
    GROUP BY c.id LIMIT 1`).bind(classId).first<Course>();
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
  if (Number(course.enrollmentCount) >= course.capacity) return Response.json({ error: "This course is full" }, { status: 409 });

  const now = Math.floor(Date.now() / 1000);
  const tierAccess = await hasCourseTierAccess(user, course.packageTier, { startMaxTrial: course.packageTier !== "basic" });
  if (!tierAccess.allowed) {
    return Response.json({ error: "Your Max trial has ended. Activate Max to continue this level.", code: "MAX_REQUIRED" }, { status: 402 });
  }
  const existingMember = await database.prepare("SELECT status FROM smartlingo_language_class_members WHERE class_id=? AND user_id=? LIMIT 1")
    .bind(classId, user.id).first<{ status: string }>();
  await database.prepare(`INSERT INTO smartlingo_language_class_members
    (id,class_id,user_id,role,status,joined_at,updated_at) VALUES(?,?,?,'student','active',?,?)
    ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`)
    .bind(createId(), classId, user.id, now, now).run();
  let learningEnrollmentId: string;
  try {
    learningEnrollmentId = await ensureCourseLearningEnrollment(database, course, user.id, now);
  } catch {
    return Response.json({ error: "The course learning plan is not available" }, { status: 409 });
  }
  return Response.json({
    enrolled: true, charged: false, classId,
    subscriptionStatus: course.packageTier === "basic" ? "free" : tierAccess.trialStarted ? "max_trial" : "max",
    trialEndsAt: tierAccess.trialEndsAt,
    learningEnrollmentId,
    idempotent: existingMember?.status === "active",
  }, { status: existingMember?.status === "active" ? 200 : 201 });
}
