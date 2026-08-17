import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import { cleanText } from "../../../../../lib/smartlingo-classes";

type Course = { id: string; priceCents: number; trialDays: number; capacity: number; enrollmentCount: number };

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const classId = cleanText((await params).classId, 100);
  const database = getDatabase();
  const course = await database.prepare(`SELECT c.id,c.price_cents AS priceCents,c.trial_days AS trialDays,c.capacity,
    COALESCE(SUM(CASE WHEN m.role='student' AND m.status='active' THEN 1 ELSE 0 END),0) AS enrollmentCount
    FROM smartlingo_language_classes c LEFT JOIN smartlingo_language_class_members m ON m.class_id=c.id
    WHERE c.id=? AND c.class_kind='official_course' AND c.status='open' AND c.visibility='public'
    GROUP BY c.id LIMIT 1`).bind(classId).first<Course>();
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
  if (Number(course.enrollmentCount) >= course.capacity) return Response.json({ error: "This course is full" }, { status: 409 });

  const existing = await database.prepare(`SELECT status,trial_ends_at AS trialEndsAt
    FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=? LIMIT 1`)
    .bind(classId, user.id).first<{ status: string; trialEndsAt: number }>();
  const now = Math.floor(Date.now() / 1000);
  if (existing?.status === "active" || (existing?.status === "trialing" && existing.trialEndsAt > now)) {
    return Response.json({ enrolled: true, charged: false, classId, subscriptionStatus: existing.status, trialEndsAt: existing.trialEndsAt, idempotent: true });
  }
  if (existing) {
    return Response.json({ error: "Subscription payment is required to continue", code: "PAYMENT_REQUIRED" }, { status: 402 });
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
  return Response.json({
    enrolled: true, charged: false, classId, subscriptionStatus: "trialing", trialEndsAt,
    monthlyPriceCents: course.priceCents, firstMonthFree: true, idempotent: false,
  }, { status: 201 });
}
