import { createId, getDatabase, getSessionUser } from "@/lib/auth";

type Course = { id: string; title: string; priceCents: number; packageTier: string };

async function quote(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const body = request.method === "GET"
    ? { classId: new URL(request.url).searchParams.get("classId") || "" }
    : await request.json().catch(() => null) as { classId?: string } | null;
  const classId = String(body?.classId || ""); const database = getDatabase();
  const course = await database.prepare(`SELECT id,title,price_cents AS priceCents,package_tier AS packageTier
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' AND visibility='public' LIMIT 1`)
    .bind(classId).first<Course>();
  if (!course) return { error: Response.json({ error: "Course not found" }, { status: 404 }) } as const;
  const row = await database.prepare(`SELECT COALESCE(SUM(points),0) AS points FROM smartlingo_course_credit_ledger WHERE user_id=?`).bind(user.id).first<{ points: number }>();
  const balancePoints = Number(row?.points || 0);
  return { user, database, course, balancePoints } as const;
}

export async function GET(request: Request) {
  const value = await quote(request); if ("error" in value) return value.error;
  return Response.json({ balancePoints: value.balancePoints, requiredPoints: value.course.priceCents, eligibleForFullMonth: value.balancePoints >= value.course.priceCents, pointsPerUsd: 100 });
}

export async function POST(request: Request) {
  const value = await quote(request); if ("error" in value) return value.error;
  if (value.balancePoints < value.course.priceCents) return Response.json({ error: "Not enough course points for a full month", balancePoints: value.balancePoints, requiredPoints: value.course.priceCents }, { status: 409 });
  const now = Math.floor(Date.now() / 1000); const monthKey = new Date(now * 1000).toISOString().slice(0, 7);
  const sourceId = `course-month:${value.course.id}:${monthKey}`;
  const existing = await value.database.prepare(`SELECT id FROM smartlingo_course_credit_ledger WHERE user_id=? AND source_type='course_month' AND source_id=? LIMIT 1`)
    .bind(value.user.id, sourceId).first();
  if (existing) return Response.json({ error: "Course points were already used for this course month" }, { status: 409 });
  const current = await value.database.prepare(`SELECT current_period_ends_at AS currentPeriodEndsAt FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=? LIMIT 1`)
    .bind(value.course.id, value.user.id).first<{ currentPeriodEndsAt: number | null }>();
  const periodStart = Math.max(now, Number(current?.currentPeriodEndsAt || 0)); const periodEnds = periodStart + 30 * 24 * 60 * 60;
  const redemptionId = createId(); const ledgerId = createId(); const localDate = new Date(now * 1000).toISOString().slice(0, 10);
  try {
    await value.database.batch([
      value.database.prepare(`INSERT INTO smartlingo_course_credit_redemptions
        (id,user_id,class_id,points,discount_cents,course_price_cents,provider,provider_reference,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,'credit_only',?,'applied',?,?)`).bind(redemptionId, value.user.id, value.course.id, value.course.priceCents, value.course.priceCents, value.course.priceCents, sourceId, now, now),
      value.database.prepare(`INSERT INTO smartlingo_course_credit_ledger
        (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
        VALUES(?,?,?,'course_redeem','course_month',?,?,?,?)`).bind(ledgerId, value.user.id, -value.course.priceCents, sourceId, localDate, `Full monthly fee for ${value.course.title}`, now),
      value.database.prepare(`INSERT INTO smartlingo_course_subscriptions
        (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,provider_subscription_id,created_at,updated_at)
        VALUES(?,?,?,'active',?,?,?,?,?,?,?)
        ON CONFLICT(class_id,user_id) DO UPDATE SET status='active',monthly_price_cents=excluded.monthly_price_cents,
          current_period_ends_at=excluded.current_period_ends_at,provider_subscription_id=excluded.provider_subscription_id,updated_at=excluded.updated_at`)
        .bind(createId(), value.course.id, value.user.id, value.course.priceCents, now, now, periodEnds, `credit:${redemptionId}`, now, now),
      value.database.prepare(`INSERT INTO smartlingo_language_class_members(id,class_id,user_id,role,status,joined_at,updated_at)
        VALUES(?,?,?,'student','active',?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`)
        .bind(createId(), value.course.id, value.user.id, now, now),
    ]);
  } catch {
    return Response.json({ error: "Unable to apply course points safely" }, { status: 409 });
  }
  return Response.json({ redeemed: true, pointsUsed: value.course.priceCents, periodEnds, classId: value.course.id });
}
