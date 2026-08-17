import { createId, getDatabase, getSessionUser, type SessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-access";
import { cleanText } from "@/lib/smartlingo-classes";

type Course = {
  id: string;
  ownerUserId: string;
  priceCents: number;
  roomId: string | null;
};

type CourseStudent = {
  userId: string;
  email: string;
  displayName: string;
  status: "trialing" | "active";
  trialEndsAt: number;
  currentPeriodEndsAt: number | null;
  providerSubscriptionId: string | null;
};

async function managerContext(request: Request, classIdValue: string) {
  const user = await getSessionUser(request);
  if (!user) return { response: Response.json({ error: "Authentication required" }, { status: 401 }) };
  const classId = cleanText(classIdValue, 100);
  const database = getDatabase();
  const course = await database.prepare(`SELECT c.id,c.owner_user_id AS ownerUserId,c.price_cents AS priceCents,
    classroom.room_id AS roomId
    FROM smartlingo_language_classes c
    LEFT JOIN smartlingo_course_classrooms classroom ON classroom.course_id=c.id
    WHERE c.id=? AND c.class_kind='official_course' LIMIT 1`).bind(classId).first<Course>();
  if (!course) return { response: Response.json({ error: "Course not found" }, { status: 404 }) };
  const coHost = course.roomId ? await database.prepare(`SELECT 1 FROM live_class_cohosts
    WHERE room_id=? AND user_id=? LIMIT 1`).bind(course.roomId, user.id).first() : null;
  if (course.ownerUserId !== user.id && !await isAdminUser(user) && !coHost) {
    return { response: Response.json({ error: "Course administrator access required" }, { status: 403 }) };
  }
  return { user, course, database };
}

function subscriptionRows(classId: string) {
  return getDatabase().prepare(`SELECT subscription.user_id AS userId,u.email,u.display_name AS displayName,
    subscription.status,subscription.trial_ends_at AS trialEndsAt,
    subscription.current_period_ends_at AS currentPeriodEndsAt,
    subscription.provider_subscription_id AS providerSubscriptionId
    FROM smartlingo_course_subscriptions subscription
    JOIN users u ON u.id=subscription.user_id
    WHERE subscription.class_id=? AND subscription.status IN ('trialing','active')
    ORDER BY CASE subscription.status WHEN 'trialing' THEN 0 ELSE 1 END,
      subscription.updated_at DESC,u.display_name COLLATE NOCASE`)
    .bind(classId).run<CourseStudent>();
}

async function enableSubscription(
  course: Course,
  actor: SessionUser,
  target: { id: string },
  previousStatus: string | null,
  action: "manual_add" | "manual_enable",
) {
  const database = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const periodEndsAt = now + 30 * 86_400;
  const manualProviderId = `manual:${course.id}:${target.id}:${now}`;
  await database.batch([
    database.prepare(`INSERT INTO smartlingo_course_subscriptions
      (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,provider_subscription_id,created_at,updated_at)
      VALUES(?,?,?,'active',?,?,?,?,?,?,?)
      ON CONFLICT(class_id,user_id) DO UPDATE SET status='active',monthly_price_cents=excluded.monthly_price_cents,
        current_period_ends_at=excluded.current_period_ends_at,
        provider_subscription_id=COALESCE(smartlingo_course_subscriptions.provider_subscription_id,excluded.provider_subscription_id),
        updated_at=excluded.updated_at`)
      .bind(createId(), course.id, target.id, course.priceCents, now, now, periodEndsAt, manualProviderId, now, now),
    database.prepare(`INSERT INTO smartlingo_language_class_members
      (id,class_id,user_id,role,status,joined_at,updated_at) VALUES(?,?,?,'student','active',?,?)
      ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`)
      .bind(createId(), course.id, target.id, now, now),
    database.prepare(`INSERT INTO platform_admin_audit(id,admin_user_id,target_user_id,action,created_at)
      VALUES(?,?,?,?,?)`).bind(createId(), actor.id, target.id, `course_subscription.${action}:${course.id}:${previousStatus ?? "none"}->active`, now),
  ]);
  return periodEndsAt;
}

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const value = await managerContext(request, (await params).classId);
  if ("response" in value) return value.response;
  const result = await subscriptionRows(value.course.id);
  const rows = result.results ?? [];
  return Response.json({
    trial: rows.filter(row => row.status === "trialing"),
    subscribers: rows.filter(row => row.status === "active"),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const value = await managerContext(request, (await params).classId);
  if ("response" in value) return value.response;
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = cleanText(body?.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Valid registered member email required" }, { status: 400 });
  }
  const target = await value.database.prepare(`SELECT id,email FROM users WHERE lower(email)=? LIMIT 1`)
    .bind(email).first<{ id: string; email: string }>();
  if (!target) return Response.json({ error: "Registered member not found" }, { status: 404 });
  const existing = await value.database.prepare(`SELECT status FROM smartlingo_course_subscriptions
    WHERE class_id=? AND user_id=? LIMIT 1`).bind(value.course.id, target.id).first<{ status: string }>();
  if (existing?.status === "active") {
    return Response.json({ ok: true, userId: target.id, status: "active", idempotent: true });
  }
  const currentPeriodEndsAt = await enableSubscription(value.course, value.user, target, existing?.status ?? null, "manual_add");
  return Response.json({ ok: true, userId: target.id, status: "active", currentPeriodEndsAt }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const value = await managerContext(request, (await params).classId);
  if ("response" in value) return value.response;
  const body = await request.json().catch(() => null) as { userId?: unknown; action?: unknown } | null;
  const userId = cleanText(body?.userId, 160);
  const action = body?.action;
  if (!userId || (action !== "enable" && action !== "disable")) {
    return Response.json({ error: "A course student and explicit subscription action are required" }, { status: 400 });
  }
  const existing = await value.database.prepare(`SELECT status FROM smartlingo_course_subscriptions
    WHERE class_id=? AND user_id=? LIMIT 1`).bind(value.course.id, userId).first<{ status: string }>();
  if (!existing) return Response.json({ error: "Course student subscription not found" }, { status: 404 });
  if (action === "enable") {
    if (existing.status === "active") return Response.json({ ok: true, status: "active", idempotent: true });
    const currentPeriodEndsAt = await enableSubscription(value.course, value.user, { id: userId }, existing.status, "manual_enable");
    return Response.json({ ok: true, status: "active", currentPeriodEndsAt });
  }
  if (existing.status === "cancelled") return Response.json({ ok: true, status: "cancelled", idempotent: true });
  const now = Math.floor(Date.now() / 1000);
  await value.database.batch([
    value.database.prepare(`UPDATE smartlingo_course_subscriptions
      SET status='cancelled',current_period_ends_at=?,updated_at=? WHERE class_id=? AND user_id=?`)
      .bind(now, now, value.course.id, userId),
    value.database.prepare(`UPDATE smartlingo_language_class_members
      SET status='paused',updated_at=? WHERE class_id=? AND user_id=? AND role='student'`)
      .bind(now, value.course.id, userId),
    value.database.prepare(`INSERT INTO platform_admin_audit(id,admin_user_id,target_user_id,action,created_at)
      VALUES(?,?,?,?,?)`).bind(createId(), value.user.id, userId, `course_subscription.manual_disable:${value.course.id}:${existing.status}->cancelled`, now),
  ]);
  return Response.json({ ok: true, status: "cancelled" });
}
