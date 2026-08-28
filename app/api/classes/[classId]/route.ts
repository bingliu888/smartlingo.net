import { getDatabase, getSessionUser } from "../../../../lib/auth";
import { isAdminUser } from "../../../../lib/admin-access";
import { cleanMultiline, cleanText } from "../../../../lib/smartlingo-classes";
import { courseSupervisorIdentity } from "../../../../lib/course-supervisors";

export const dynamic = "force-dynamic";

type ClassDetail = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  pathId: string;
  pathTitleEn: string;
  pathTitleZh: string;
  classKind: "official_language" | "official_course" | "member_language" | "subject";
  ownerRole: "teacher" | "coordinator";
  title: string;
  summary: string;
  targetLanguage: string;
  level: string;
  schedule: string;
  status: string;
  visibility: string;
  priceCents: number;
  packageTier: "basic" | "intermediate" | "advanced" | null;
  billingInterval: "month";
  trialDays: number;
  currency: string;
  capacity: number;
  enrollmentCount: number;
};

function normalizePriceCents(value: unknown) {
  const cents = Math.floor(Number(value));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 10_000_000) {
    throw new Error("Price must be between 0 and 100,000 USD.");
  }
  return cents;
}

async function classDetail(classId: string) {
  return getDatabase().prepare(`SELECT c.id, c.owner_user_id AS ownerUserId,
    u.display_name AS ownerName, c.path_id AS pathId,
    p.title_en AS pathTitleEn, p.title_zh AS pathTitleZh,
    c.class_kind AS classKind, c.owner_role AS ownerRole, c.title, c.summary,
    c.target_language AS targetLanguage, c.level, c.schedule,
    c.status, c.visibility, c.price_cents AS priceCents, c.currency,
    c.package_tier AS packageTier,c.billing_interval AS billingInterval,c.trial_days AS trialDays,
    c.capacity,
    COALESCE(SUM(CASE WHEN members.role = 'student' AND members.status = 'active' THEN 1 ELSE 0 END), 0) AS enrollmentCount
    FROM smartlingo_language_classes c
    JOIN users u ON u.id = c.owner_user_id
    JOIN smartlingo_language_paths p ON p.id = c.path_id
    LEFT JOIN smartlingo_language_class_members members ON members.class_id = c.id
    WHERE c.id = ? GROUP BY c.id LIMIT 1`).bind(classId).first<ClassDetail>();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const classId = cleanText((await params).classId, 100);
  const detail = await classDetail(classId);
  if (!detail) return Response.json({ error: "Course not found" }, { status: 404 });

  const membership = await getDatabase().prepare(`SELECT member.role,member.status
    FROM smartlingo_language_class_members member
    LEFT JOIN smartlingo_course_subscriptions subscription
      ON subscription.class_id=member.class_id AND subscription.user_id=member.user_id
    WHERE member.class_id=? AND member.user_id=? AND member.status IN ('active','invited','paused')
      AND (? NOT IN ('official_course','subject') OR ?=0 OR (subscription.status='active' AND subscription.current_period_ends_at>unixepoch())
        OR (subscription.status='trialing' AND subscription.trial_ends_at>unixepoch())) LIMIT 1`)
    .bind(classId, user.id, detail.classKind, detail.priceCents).first<{ role: string; status: string }>();
  const isOwner = detail.ownerUserId === user.id;
  const room = await getDatabase().prepare(`SELECT room_id AS roomId FROM smartlingo_course_classrooms WHERE course_id=? LIMIT 1`)
    .bind(classId).first<{ roomId: string }>();
  const coAdmin = room ? await getDatabase().prepare(`SELECT 1 FROM live_class_cohosts WHERE room_id=? AND user_id=? LIMIT 1`)
    .bind(room.roomId, user.id).first() : null;
  const canManage = isOwner || await isAdminUser(user) || Boolean(coAdmin);
  const supervisor = await courseSupervisorIdentity(user.id, true);
  if (!isOwner && !membership && detail.visibility !== "public") {
    return Response.json({ error: "This private course is available by invitation only." }, { status: 403 });
  }

  const placement = ["official_language", "official_course"].includes(detail.classKind) && membership?.status === "active"
    ? await getDatabase().prepare(`SELECT id, status, entry_mode AS entryMode,
        overall_score AS overallScore, recommended_level AS recommendedLevel,
        updated_at AS updatedAt
        FROM smartlingo_placement_attempts
        WHERE class_id = ? AND user_id = ?
        ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'paused' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
          updated_at DESC, rowid DESC LIMIT 1`).bind(classId, user.id).first()
    : null;

  return Response.json({
    class: detail,
    currentUserId: user.id,
    isOwner,
    canManage,
    canSupervise: Boolean(supervisor),
    supervisorRefId: supervisor?.refId || null,
    membership,
    placement,
    paymentPolicy: { durationsMonths: [3,6,12], automaticRenewal: false, cryptoDurationMonths: 3 },
    paymentMode: "fixed_term_package",
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Invalid course update" }, { status: 400 });
  const classId = cleanText((await params).classId, 100);
  const current = await classDetail(classId);
  if (!current) return Response.json({ error: "Course not found" }, { status: 404 });
  const linkedRoom = await getDatabase().prepare(`SELECT cc.room_id AS roomId FROM smartlingo_course_classrooms cc WHERE cc.course_id=? LIMIT 1`)
    .bind(classId).first<{ roomId: string }>();
  const coAdmin = linkedRoom ? await getDatabase().prepare(`SELECT 1 FROM live_class_cohosts WHERE room_id=? AND user_id=? LIMIT 1`)
    .bind(linkedRoom.roomId, user.id).first() : null;
  if (current.ownerUserId !== user.id && !await isAdminUser(user) && !coAdmin) {
    return Response.json({ error: "Course administrator access required" }, { status: 403 });
  }
  const now = Math.floor(Date.now() / 1000);

  if (input.action === "request_public_directory") {
    if (current.status !== "open") {
      return Response.json({ error: "Only an open course can request directory review." }, { status: 409 });
    }
    if (current.visibility === "public" || current.visibility === "review") {
      return Response.json({ ok: true, visibility: current.visibility, idempotent: true });
    }
    await getDatabase().prepare(`UPDATE smartlingo_language_classes
      SET visibility = 'review', updated_at = ? WHERE id = ?`).bind(now, classId).run();
    return Response.json({ ok: true, visibility: "review", next: "Admin review" });
  }

  if (input.action === "update_private_details") {
    if (current.visibility !== "private") {
      return Response.json({ error: "Course details cannot change during or after directory review." }, { status: 409 });
    }
    const title = cleanText(input.title, 100) || current.title;
    const summary = cleanMultiline(input.summary, 800);
    const schedule = cleanText(input.schedule, 120) || current.schedule;
    let priceCents = current.priceCents;
    try {
      priceCents = normalizePriceCents(input.priceCents ?? current.priceCents);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid price" }, { status: 400 });
    }
    await getDatabase().prepare(`UPDATE smartlingo_language_classes
      SET title = ?, summary = ?, schedule = ?, price_cents = ?, updated_at = ? WHERE id = ?`)
      .bind(title, summary, schedule, priceCents, now, classId).run();
    return Response.json({ ok: true, title, summary, schedule, priceCents });
  }
  if (input.action === "update_official_course" && current.classKind === "official_course") {
    const title = cleanText(input.title, 100) || current.title;
    const summary = cleanMultiline(input.summary, 800) || current.summary;
    const schedule = cleanText(input.schedule, 120) || current.schedule;
    await getDatabase().prepare(`UPDATE smartlingo_language_classes
      SET title=?,summary=?,schedule=?,updated_at=? WHERE id=? AND class_kind='official_course'`)
      .bind(title, summary, schedule, now, classId).run();
    return Response.json({ ok: true, title, summary, schedule });
  }
  return Response.json({ error: "Unsupported course update" }, { status: 400 });
}
