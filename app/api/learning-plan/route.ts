import { createId, getDatabase, getSessionUser } from "../../../lib/auth";
import {
  SMARTLINGO_PATH_CONTENT_VERSION,
  languageCatalogEntry,
  startingPointForOnboarding,
  validateLearningOnboarding,
} from "../../../lib/smartlingo-paths";

export const dynamic = "force-dynamic";

type LearningPlanRow = {
  id: string;
  pathId: string;
  targetLanguage: string;
  useCase: string;
  dailyMinutes: number;
  selfReportedLevel: string;
  entryMode: string;
  contentVersion: string;
  currentStageId: string | null;
  currentUnitId: string | null;
  isActive: number;
  createdAt: number;
  updatedAt: number;
};

const planSelect = `SELECT id, path_id AS pathId, target_language AS targetLanguage,
  use_case AS useCase, daily_minutes AS dailyMinutes,
  self_reported_level AS selfReportedLevel, entry_mode AS entryMode,
  content_version AS contentVersion, current_stage_id AS currentStageId,
  current_unit_id AS currentUnitId, is_active AS isActive,
  created_at AS createdAt, updated_at AS updatedAt
  FROM smartlingo_learning_plans`;

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const result = await getDatabase().prepare(`${planSelect}
    WHERE user_id = ? ORDER BY is_active DESC, updated_at DESC, id`)
    .bind(user.id).run<LearningPlanRow>();
  return Response.json({
    contentVersion: SMARTLINGO_PATH_CONTENT_VERSION,
    plans: (result.results || []).map(plan => ({ ...plan, isActive: Boolean(plan.isActive) })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "A valid JSON body is required" }, { status: 400 });
  }
  const validation = validateLearningOnboarding(body);
  if (!validation.ok) {
    return Response.json({
      error: "Choose a supported language, use case, daily duration, level, and entry mode.",
      code: "SMARTLINGO_INVALID_LEARNING_PLAN",
      fields: validation.issues,
    }, { status: 400 });
  }

  const input = validation.value;
  const catalog = languageCatalogEntry(input.targetLanguage)!;
  const start = startingPointForOnboarding(input);
  const database = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const planId = createId();

  try {
    await database.batch([
      database.prepare(`UPDATE smartlingo_learning_plans SET is_active = 0, updated_at = ?
        WHERE user_id = ? AND is_active = 1 AND path_id <> ?`).bind(now, user.id, catalog.pathId),
      database.prepare(`INSERT INTO smartlingo_learning_plans
        (id, user_id, path_id, target_language, use_case, daily_minutes,
         self_reported_level, entry_mode, content_version, current_stage_id,
         current_unit_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, path_id) DO UPDATE SET
          target_language = excluded.target_language,
          use_case = excluded.use_case,
          daily_minutes = excluded.daily_minutes,
          self_reported_level = excluded.self_reported_level,
          entry_mode = excluded.entry_mode,
          content_version = excluded.content_version,
          current_stage_id = COALESCE(smartlingo_learning_plans.current_stage_id, excluded.current_stage_id),
          current_unit_id = COALESCE(smartlingo_learning_plans.current_unit_id, excluded.current_unit_id),
          is_active = 1,
          updated_at = excluded.updated_at`)
        .bind(
          planId,
          user.id,
          catalog.pathId,
          catalog.code,
          input.useCase,
          input.dailyMinutes,
          input.selfReportedLevel,
          input.entryMode,
          SMARTLINGO_PATH_CONTENT_VERSION,
          start?.stageId ?? null,
          start?.unitId ?? null,
          now,
          now,
        ),
    ]);
  } catch {
    return Response.json({
      error: "The published learning path could not be saved safely.",
      code: "SMARTLINGO_LEARNING_PLAN_NOT_SAVED",
    }, { status: 409 });
  }

  const plan = await database.prepare(`${planSelect}
    WHERE user_id = ? AND path_id = ? LIMIT 1`)
    .bind(user.id, catalog.pathId).first<LearningPlanRow>();
  if (!plan) {
    return Response.json({ error: "The learning plan was not found after saving." }, { status: 409 });
  }
  return Response.json({
    plan: { ...plan, isActive: Boolean(plan.isActive) },
    path: {
      pathId: catalog.pathId,
      classId: catalog.classId,
      targetLanguage: catalog.code,
      contentStatus: catalog.contentStatus,
      contentVersion: catalog.contentVersion,
    },
    next: input.entryMode === "adaptive" ? "placement" : "learning",
    scoresCreated: false,
    assessmentNotice: "This starting point is practice guidance, not an official exam or credential.",
  }, { status: 201 });
}
