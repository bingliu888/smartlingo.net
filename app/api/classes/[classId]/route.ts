import { getDatabase, getSessionUser } from "../../../../lib/auth";
import { cleanMultiline, cleanText } from "../../../../lib/smartlingo-classes";

export const dynamic = "force-dynamic";

type ClassDetail = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  pathId: string;
  pathTitleEn: string;
  pathTitleZh: string;
  ownerRole: "teacher" | "coordinator";
  title: string;
  summary: string;
  targetLanguage: string;
  level: string;
  schedule: string;
  status: string;
  visibility: string;
  priceCents: number;
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
    c.owner_role AS ownerRole, c.title, c.summary,
    c.target_language AS targetLanguage, c.level, c.schedule,
    c.status, c.visibility, c.price_cents AS priceCents, c.currency,
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
  if (!detail) return Response.json({ error: "Class not found" }, { status: 404 });

  const membership = await getDatabase().prepare(`SELECT role, status
    FROM smartlingo_language_class_members
    WHERE class_id = ? AND user_id = ? AND status IN ('active', 'invited', 'paused') LIMIT 1`)
    .bind(classId, user.id).first<{ role: string; status: string }>();
  const isOwner = detail.ownerUserId === user.id;
  if (!isOwner && !membership && detail.visibility !== "public") {
    return Response.json({ error: "This private class is available by invitation only." }, { status: 403 });
  }

  return Response.json({
    class: detail,
    currentUserId: user.id,
    isOwner,
    membership,
    paymentPolicy: {
      firstPaymentDiscountPercent: 15,
      ownerSharePercent: 70,
      platformSharePercent: 30,
      classPaymentsCreateIntroducerRewards: false,
    },
    paymentMode: "stripe_connect_not_enabled",
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Invalid class update" }, { status: 400 });
  const classId = cleanText((await params).classId, 100);
  const current = await classDetail(classId);
  if (!current) return Response.json({ error: "Class not found" }, { status: 404 });
  if (current.ownerUserId !== user.id) return Response.json({ error: "Class owner access required" }, { status: 403 });
  const now = Math.floor(Date.now() / 1000);

  if (input.action === "request_public_directory") {
    if (current.status !== "open") {
      return Response.json({ error: "Only an open class can request directory review." }, { status: 409 });
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
      return Response.json({ error: "Class details cannot change during or after directory review." }, { status: 409 });
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
  return Response.json({ error: "Unsupported class update" }, { status: 400 });
}
