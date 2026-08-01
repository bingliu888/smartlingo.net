import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import { cleanText } from "../../../../../lib/smartlingo-classes";

type JoinableClass = {
  id: string;
  classKind: "official_language" | "member_language" | "subject";
  status: string;
  visibility: string;
  priceCents: number;
  capacity: number;
  enrollmentCount: number;
};

type Membership = {
  id: string;
  role: "owner" | "teacher" | "coordinator" | "student";
  status: "invited" | "active" | "paused" | "left" | "removed";
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const classId = cleanText((await params).classId, 100);
  const database = getDatabase();
  const languageClass = await database.prepare(`SELECT c.id,
    c.class_kind AS classKind, c.status, c.visibility,
    c.price_cents AS priceCents, c.capacity,
    COALESCE(SUM(CASE WHEN members.role = 'student' AND members.status = 'active' THEN 1 ELSE 0 END), 0) AS enrollmentCount
    FROM smartlingo_language_classes c
    LEFT JOIN smartlingo_language_class_members members ON members.class_id = c.id
    WHERE c.id = ? GROUP BY c.id LIMIT 1`)
    .bind(classId).first<JoinableClass>();
  if (!languageClass) return Response.json({ error: "Class not found" }, { status: 404 });

  const existing = await database.prepare(`SELECT id, role, status
    FROM smartlingo_language_class_members
    WHERE class_id = ? AND user_id = ? LIMIT 1`)
    .bind(classId, user.id).first<Membership>();
  if (existing?.role === "owner" || existing?.status === "active") {
    return Response.json({
      enrolled: true,
      charged: false,
      classId,
      classKind: languageClass.classKind,
      membership: existing,
      idempotent: true,
    });
  }
  if (existing?.status === "removed") {
    return Response.json({ error: "Class access was removed. Contact the class coordinator." }, { status: 403 });
  }
  if (existing && ["invited", "paused"].includes(existing.status)) {
    const now = Math.floor(Date.now() / 1000);
    await database.prepare(`UPDATE smartlingo_language_class_members
      SET status = 'active', updated_at = ?
      WHERE class_id = ? AND user_id = ? AND status IN ('invited', 'paused')`)
      .bind(now, classId, user.id).run();
    await database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
      (id, user_id, class_id, domain, activity_type, duration_seconds, units,
       source_type, source_id, created_at)
      VALUES (?, ?, ?, 'community', 'class_join', 0, 1, 'class_membership', ?, ?)`)
      .bind(createId(), user.id, classId, existing.id, now).run();
    return Response.json({
      enrolled: true,
      charged: false,
      classId,
      classKind: languageClass.classKind,
      membership: { ...existing, status: "active" },
      enrollmentSource: "existing_class_membership",
      idempotent: false,
    }, { status: 201 });
  }
  if (languageClass.status !== "open" || languageClass.visibility !== "public") {
    return Response.json({ error: "This class is not open for public enrollment." }, { status: 403 });
  }
  if (languageClass.priceCents > 0) {
    return Response.json({
      enrolled: false,
      charged: false,
      error: "Verified class checkout is not enabled yet.",
      code: "SMARTLINGO_CLASS_PAYMENT_NOT_ENABLED",
    }, { status: 409 });
  }
  if (Number(languageClass.enrollmentCount || 0) >= languageClass.capacity) {
    return Response.json({ error: "This class is full." }, { status: 409 });
  }

  const now = Math.floor(Date.now() / 1000);
  await database.prepare(`INSERT INTO smartlingo_language_class_members
    (id, class_id, user_id, role, status, joined_at, updated_at)
    SELECT ?, c.id, ?, 'student', 'active', ?, ?
    FROM smartlingo_language_classes c
    WHERE c.id = ? AND c.status = 'open' AND c.visibility = 'public' AND c.price_cents = 0
      AND (SELECT COUNT(*) FROM smartlingo_language_class_members active_members
        WHERE active_members.class_id = c.id
          AND active_members.role = 'student'
          AND active_members.status = 'active') < c.capacity
    ON CONFLICT(class_id, user_id) DO UPDATE SET
      role = 'student', status = 'active', updated_at = excluded.updated_at
    WHERE smartlingo_language_class_members.status IN ('invited', 'paused', 'left')`)
    .bind(createId(), user.id, now, now, classId).run();

  const membership = await database.prepare(`SELECT id, role, status
    FROM smartlingo_language_class_members
    WHERE class_id = ? AND user_id = ? LIMIT 1`)
    .bind(classId, user.id).first<Membership>();
  if (!membership || membership.status !== "active") {
    return Response.json({ error: "This class became full before enrollment completed." }, { status: 409 });
  }

  await database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
    (id, user_id, class_id, domain, activity_type, duration_seconds, units,
     source_type, source_id, created_at)
    VALUES (?, ?, ?, 'community', 'class_join', 0, 1, 'class_membership', ?, ?)`)
    .bind(createId(), user.id, classId, membership.id, now).run();

  return Response.json({
    enrolled: true,
    charged: false,
    classId,
    classKind: languageClass.classKind,
    membership,
    idempotent: false,
  }, { status: 201 });
}
