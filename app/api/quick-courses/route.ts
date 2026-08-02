import { createId, getDatabase, getSessionUser } from "../../../lib/auth";
import { SMARTLINGO_QUICK_COURSE_VERSION, isQuickCourseDays } from "../../../lib/smartlingo-quick-courses";
import { languageCatalogEntry } from "../../../lib/smartlingo-paths";

export const dynamic = "force-dynamic";

type OfferingRow = {
  id: string;
  targetLanguage: string;
  durationDays: number;
  isFree: number;
  status: string;
  curriculumVersion: string;
};

const offeringSelect = `SELECT id, target_language AS targetLanguage,
  duration_days AS durationDays, is_free AS isFree, status,
  curriculum_version AS curriculumVersion
  FROM smartlingo_quick_course_offerings`;

export async function GET() {
  const result = await getDatabase().prepare(`${offeringSelect}
    WHERE status = 'published' ORDER BY target_language, duration_days`).run<OfferingRow>();
  return Response.json({
    version: SMARTLINGO_QUICK_COURSE_VERSION,
    offerings: (result.results || []).map(item => ({ ...item, isFree: Boolean(item.isFree) })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  let body: { targetLanguage?: unknown; durationDays?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "A valid JSON body is required" }, { status: 400 });
  }
  const language = typeof body.targetLanguage === "string" ? languageCatalogEntry(body.targetLanguage) : null;
  if (!language || !isQuickCourseDays(body.durationDays)) {
    return Response.json({ error: "Choose a supported language and 7, 14, or 30-day course." }, { status: 400 });
  }

  const database = getDatabase();
  const offering = await database.prepare(`${offeringSelect}
    WHERE target_language = ? AND duration_days = ? AND status = 'published' LIMIT 1`)
    .bind(language.code, Number(body.durationDays)).first<OfferingRow>();
  if (!offering) return Response.json({ error: "This course is not currently open." }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  const accessType = offering.isFree ? "free" : "payment_required";
  const status = offering.isFree ? "active" : "pending_payment";
  await database.prepare(`INSERT INTO smartlingo_quick_course_enrollments
    (id, offering_id, user_id, class_id, access_type, status, current_day,
     started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(user_id, offering_id) DO UPDATE SET
      class_id = excluded.class_id,
      access_type = excluded.access_type,
      status = CASE
        WHEN smartlingo_quick_course_enrollments.status = 'completed' THEN 'completed'
        ELSE excluded.status END,
      updated_at = excluded.updated_at`)
    .bind(createId(), offering.id, user.id, language.classId, accessType, status, now, now, now).run();

  return Response.json({
    enrollment: {
      offeringId: offering.id,
      targetLanguage: offering.targetLanguage,
      durationDays: offering.durationDays,
      accessType,
      status,
      currentDay: 1,
    },
    checkoutEnabled: false,
    notice: offering.isFree
      ? "The free beginner course is ready."
      : "Your course choice is saved. Live checkout is not enabled yet, so no charge was made.",
  }, { status: 201 });
}
