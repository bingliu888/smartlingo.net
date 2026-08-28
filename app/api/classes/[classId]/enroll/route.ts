import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import { cleanText } from "../../../../../lib/smartlingo-classes";
import { ensureCourseLearningEnrollment } from "../../../../../lib/course-learning-enrollment";

type Course = {
  id: string; priceCents: number; trialDays: number; capacity: number; enrollmentCount: number;
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

  const existing = await database.prepare(`SELECT status,trial_ends_at AS trialEndsAt,current_period_ends_at AS currentPeriodEndsAt
    FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=? LIMIT 1`)
    .bind(classId, user.id).first<{ status: string; trialEndsAt: number;currentPeriodEndsAt:number|null }>();
  const now = Math.floor(Date.now() / 1000);
  if (course.priceCents === 0) {
    await database.prepare(`INSERT INTO smartlingo_language_class_members
      (id,class_id,user_id,role,status,joined_at,updated_at) VALUES(?,?,?,'student','active',?,?)
      ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`)
      .bind(createId(), classId, user.id, now, now).run();
    try {
      const learningEnrollmentId = await ensureCourseLearningEnrollment(database, course, user.id, now);
      return Response.json({ enrolled: true, charged: false, classId, subscriptionStatus: "open", learningEnrollmentId });
    } catch {
      return Response.json({ error: "The course learning plan is not available" }, { status: 409 });
    }
  }
  if ((existing?.status === "active"&&Number(existing.currentPeriodEndsAt||0)>now) || (existing?.status === "trialing" && existing.trialEndsAt > now)) {
    try {
      const learningEnrollmentId = await ensureCourseLearningEnrollment(database, course, user.id, now);
      return Response.json({ enrolled: true, charged: false, classId, subscriptionStatus: existing.status, trialEndsAt: existing.trialEndsAt, learningEnrollmentId, idempotent: true });
    } catch {
      return Response.json({ error: "The course learning plan is not available" }, { status: 409 });
    }
  }
  if (existing) {
    return Response.json({ error: "Subscription payment is required to continue", code: "PAYMENT_REQUIRED" }, { status: 402 });
  }
  if(course.classKind==="official_course"){
    return Response.json({error:"Choose a 3, 6, or 12 month course package",code:"PACKAGE_PAYMENT_REQUIRED"},{status:402});
  }

  const trialEndsAt = now + course.trialDays * 86_400;
  await database.batch([
    database.prepare(`INSERT INTO smartlingo_course_subscriptions
      (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,created_at,updated_at)
      VALUES(?,?,?,'trialing',?,?,?,?,?)`).bind(createId(), classId, user.id, course.priceCents, now, trialEndsAt, now, now),
    database.prepare(`INSERT INTO smartlingo_language_class_members
      (id,class_id,user_id,role,status,joined_at,updated_at) VALUES(?,?,?,'student','active',?,?)
      ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`)
      .bind(createId(), classId, user.id, now, now),
  ]);
  let learningEnrollmentId: string;
  try {
    learningEnrollmentId = await ensureCourseLearningEnrollment(database, course, user.id, now);
  } catch {
    return Response.json({ error: "The course subscription started, but its learning plan is not available" }, { status: 409 });
  }
  return Response.json({
    enrolled: true, charged: false, classId, subscriptionStatus: "trialing", trialEndsAt,
    trialPriceReferenceCents: course.priceCents, trialIncluded: true, learningEnrollmentId, idempotent: false,
  }, { status: 201 });
}
