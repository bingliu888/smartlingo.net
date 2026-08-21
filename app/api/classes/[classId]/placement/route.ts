import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import {
  evaluatePlacement,
  generateAdaptivePlacementQuestions,
  scorePlacementAnswer,
  SMARTLINGO_LEARNING_CONTENT_VERSION,
  SMARTLINGO_LEARNING_LANGUAGE_CODES,
  type AdaptivePlacementObservation,
  type PlacementAnswerScore,
  type PlacementQuestion,
  type SmartLingoInterfaceLanguage,
  type SmartLingoLearningLanguage,
  type SmartLingoLevel,
  type SmartLingoSkill,
} from "../../../../../lib/smartlingo-learning";
import {
  requireOfficialClassMembership,
  type LearningDatabase,
  type OfficialClassAccess,
} from "../../../../../lib/smartlingo-learning-access";
import { speechLocaleForLanguage } from "../../../../../lib/smartlingo-paths";

export const dynamic = "force-dynamic";

const TOTAL_PLACEMENT_ITEMS = 15;
const MAX_ANSWER_LENGTH = 800;
const MAX_ACTIVE_SECONDS = 14_400;
const ENTRY_MODES = ["beginner", "intermediate", "advanced", "adaptive"] as const;
type EntryMode = (typeof ENTRY_MODES)[number];

type AttemptStatus = "in_progress" | "paused" | "completed" | "abandoned";
type AttemptRow = {
  id: string;
  userId: string;
  classId: string;
  pathId: string;
  entryMode: EntryMode;
  status: AttemptStatus;
  currentDifficulty: number;
  activeSeconds: number;
  lastResumedAt: number | null;
  vocabularyScore: number | null;
  readingScore: number | null;
  writingScore: number | null;
  listeningScore: number | null;
  dialogueScore: number | null;
  overallScore: number | null;
  recommendedLevel: SmartLingoLevel | null;
  startedAt: number;
  pausedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
};

type ResponseRow = {
  itemKey: string;
  itemVersion: string;
  skill: SmartLingoSkill;
  difficulty: number;
  skipped: number;
  score: number | null;
  durationSeconds: number;
  answeredAt: number;
};

type PlacementBody = {
  action?: unknown;
  mode?: unknown;
  attemptId?: unknown;
  itemId?: unknown;
  answer?: unknown;
  lang?: unknown;
};

function isEntryMode(value: unknown): value is EntryMode {
  return typeof value === "string" && ENTRY_MODES.includes(value as EntryMode);
}

function isLearningLanguage(value: string): value is SmartLingoLearningLanguage {
  return SMARTLINGO_LEARNING_LANGUAGE_CODES.includes(value as SmartLingoLearningLanguage);
}

function safeIdentifier(value: unknown, maximum = 160) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function interfaceLanguage(request: Request, userLanguage: string, bodyLanguage?: unknown): SmartLingoInterfaceLanguage {
  if (bodyLanguage === "zh" || bodyLanguage === "en") return bodyLanguage;
  const queryLanguage = new URL(request.url).searchParams.get("lang");
  if (queryLanguage === "zh" || queryLanguage === "en") return queryLanguage;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const segment = new URL(referer).pathname.split("/").filter(Boolean)[0];
      if (segment === "zh" || segment === "en") return segment;
    } catch {
      // An invalid referrer is ignored and the verified user preference wins.
    }
  }
  return userLanguage === "en" ? "en" : "zh";
}

function levelDifficulty(level: SmartLingoLevel) {
  return level === "beginner" ? 1 : level === "advanced" ? 3 : 2;
}

function liveActiveSeconds(attempt: AttemptRow, now: number) {
  const currentInterval = attempt.status === "in_progress" && attempt.lastResumedAt
    ? Math.max(0, now - attempt.lastResumedAt)
    : 0;
  return Math.min(MAX_ACTIVE_SECONDS, Math.max(0, Number(attempt.activeSeconds || 0)) + currentInterval);
}

function roundFromItemKey(itemKey: string): 1 | 2 | 3 | null {
  const match = itemKey.match(/:r([123]):/);
  return match ? Number(match[1]) as 1 | 2 | 3 : null;
}

function observationsFromRows(rows: readonly ResponseRow[]): AdaptivePlacementObservation[] {
  return rows.flatMap(row => {
    const round = roundFromItemKey(row.itemKey);
    if (!round || round === 3) return [];
    return [{
      skill: row.skill,
      round,
      score: row.score ?? 0,
      skipped: Boolean(row.skipped),
    } satisfies AdaptivePlacementObservation];
  });
}

function clientQuestion(question: PlacementQuestion, uiLanguage: SmartLingoInterfaceLanguage) {
  return {
    id: question.id,
    skill: question.skill,
    difficulty: levelDifficulty(question.level),
    responseKind: question.options ? "choice" as const : "text" as const,
    prompt: question.prompt[uiLanguage],
    targetText: typeof question.context === "string" ? question.context : question.context?.[uiLanguage],
    audioText: question.audioText,
    options: question.options?.map(option => ({
      value: option.id,
      label: option.label[uiLanguage],
    })),
    speechLocale: speechLocaleForLanguage(question.language),
    direction: question.language === "ar" ? "rtl" as const : "ltr" as const,
  };
}

async function latestAttempt(database: LearningDatabase, userId: string, classId: string) {
  return database.prepare(`SELECT id, user_id AS userId, class_id AS classId, path_id AS pathId,
    entry_mode AS entryMode, status, current_difficulty AS currentDifficulty,
    active_seconds AS activeSeconds, last_resumed_at AS lastResumedAt,
    vocabulary_score AS vocabularyScore, reading_score AS readingScore,
    writing_score AS writingScore, listening_score AS listeningScore,
    dialogue_score AS dialogueScore, overall_score AS overallScore,
    recommended_level AS recommendedLevel, started_at AS startedAt,
    paused_at AS pausedAt, completed_at AS completedAt, updated_at AS updatedAt
    FROM smartlingo_placement_attempts
    WHERE user_id = ? AND class_id = ? AND status <> 'abandoned'
    ORDER BY updated_at DESC, created_at DESC, rowid DESC LIMIT 1`)
    .bind(userId, classId).first<AttemptRow>();
}

async function attemptForAction(
  database: LearningDatabase,
  userId: string,
  classId: string,
  attemptId: string,
) {
  return database.prepare(`SELECT id, user_id AS userId, class_id AS classId, path_id AS pathId,
    entry_mode AS entryMode, status, current_difficulty AS currentDifficulty,
    active_seconds AS activeSeconds, last_resumed_at AS lastResumedAt,
    vocabulary_score AS vocabularyScore, reading_score AS readingScore,
    writing_score AS writingScore, listening_score AS listeningScore,
    dialogue_score AS dialogueScore, overall_score AS overallScore,
    recommended_level AS recommendedLevel, started_at AS startedAt,
    paused_at AS pausedAt, completed_at AS completedAt, updated_at AS updatedAt
    FROM smartlingo_placement_attempts
    WHERE id = ? AND user_id = ? AND class_id = ? LIMIT 1`)
    .bind(attemptId, userId, classId).first<AttemptRow>();
}

async function responseRows(database: LearningDatabase, attemptId: string) {
  const result = await database.prepare(`SELECT item_key AS itemKey, item_version AS itemVersion,
    skill, difficulty, skipped, score, duration_seconds AS durationSeconds,
    answered_at AS answeredAt
    FROM smartlingo_placement_responses WHERE attempt_id = ?
    ORDER BY answered_at, created_at, id`).bind(attemptId).run<ResponseRow>();
  return result.results || [];
}

async function placementState(
  database: LearningDatabase,
  userId: string,
  access: OfficialClassAccess,
  uiLanguage: SmartLingoInterfaceLanguage,
) {
  const attempt = await latestAttempt(database, userId, access.classId);
  const base = {
    class: {
      id: access.classId,
      title: access.title,
      targetLanguage: access.targetLanguage,
    },
    attempt: null,
    question: null,
  };
  if (!attempt) return base;
  const rows = attempt.entryMode === "adaptive" ? await responseRows(database, attempt.id) : [];
  const language = isLearningLanguage(access.targetLanguage) ? access.targetLanguage : null;
  const questions = language && attempt.entryMode === "adaptive"
    ? generateAdaptivePlacementQuestions(language, observationsFromRows(rows), attempt.id)
    : [];
  const question = attempt.status === "in_progress" ? questions[rows.length] ?? null : null;
  const currentIndex = attempt.entryMode === "adaptive"
    ? Math.min(TOTAL_PLACEMENT_ITEMS, rows.length)
    : attempt.status === "completed" ? TOTAL_PLACEMENT_ITEMS : 0;
  return {
    ...base,
    attempt: {
      id: attempt.id,
      status: attempt.status,
      entryMode: attempt.entryMode,
      currentIndex,
      totalItems: TOTAL_PLACEMENT_ITEMS,
      activeSeconds: liveActiveSeconds(attempt, Math.floor(Date.now() / 1000)),
      answeredCount: rows.filter(row => !row.skipped).length,
      skippedCount: rows.filter(row => Boolean(row.skipped)).length,
      overallScore: attempt.overallScore,
      recommendedLevel: attempt.recommendedLevel,
      selfSelected: attempt.entryMode !== "adaptive",
      skillScores: {
        vocabulary: attempt.vocabularyScore,
        reading: attempt.readingScore,
        writing: attempt.writingScore,
        listening: attempt.listeningScore,
        dialogue: attempt.dialogueScore,
      },
    },
    question: question ? clientQuestion(question, uiLanguage) : null,
  };
}

async function authorize(request: Request, classIdValue: unknown) {
  const user = await getSessionUser(request);
  if (!user) return { response: Response.json({ error: "Authentication required" }, { status: 401 }) } as const;
  const classId = safeIdentifier(classIdValue, 100);
  if (!classId) return { response: Response.json({ error: "A valid course ID is required" }, { status: 400 }) } as const;
  const database = getDatabase();
  const access = await requireOfficialClassMembership(database, user, classId);
  if (!access) {
    return { response: Response.json({ error: "Active membership in this official language course is required" }, { status: 403 }) } as const;
  }
  if (!isLearningLanguage(access.targetLanguage)) {
    return { response: Response.json({ error: "This course language is not supported for placement" }, { status: 409 }) } as const;
  }
  return { user, classId, database, access } as const;
}

async function insertAttempt(
  database: LearningDatabase,
  userId: string,
  access: OfficialClassAccess,
  mode: EntryMode,
) {
  const now = Math.floor(Date.now() / 1000);
  const adaptive = mode === "adaptive";
  const attemptId = createId();
  await database.prepare(`INSERT INTO smartlingo_placement_attempts
    (id, user_id, class_id, path_id, entry_mode, status, current_difficulty,
     active_seconds, last_resumed_at, recommended_level, started_at, paused_at,
     completed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?, ?)`)
    .bind(
      attemptId,
      userId,
      access.classId,
      access.pathId,
      mode,
      adaptive ? "in_progress" : "completed",
      adaptive ? 2 : levelDifficulty(mode),
      adaptive ? now : null,
      adaptive ? null : mode,
      now,
      adaptive ? null : now,
      now,
      now,
    ).run();
  return attemptId;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const auth = await authorize(request, (await params).classId);
  if ("response" in auth) return auth.response;
  return Response.json(await placementState(
    auth.database,
    auth.user.id,
    auth.access,
    interfaceLanguage(request, auth.user.preferredLanguage),
  ));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const auth = await authorize(request, (await params).classId);
  if ("response" in auth) return auth.response;
  let body: PlacementBody;
  try {
    body = await request.json() as PlacementBody;
  } catch {
    return Response.json({ error: "A valid JSON body is required" }, { status: 400 });
  }
  const uiLanguage = interfaceLanguage(request, auth.user.preferredLanguage, body.lang);
  const targetLanguage = auth.access.targetLanguage as SmartLingoLearningLanguage;
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "skip_placement") {
    if (!isEntryMode(body.mode) || body.mode === "adaptive") {
      return Response.json({ error: "Choose beginner, intermediate, or advanced when skipping placement" }, { status: 400 });
    }
    const now = Math.floor(Date.now() / 1000);
    const attemptId = createId();
    await auth.database.batch([
      auth.database.prepare(`UPDATE smartlingo_placement_attempts
        SET status = 'abandoned', last_resumed_at = NULL, updated_at = ?
        WHERE user_id = ? AND class_id = ? AND status IN ('in_progress', 'paused')`)
        .bind(now, auth.user.id, auth.classId),
      auth.database.prepare(`INSERT INTO smartlingo_placement_attempts
        (id, user_id, class_id, path_id, entry_mode, status, current_difficulty,
         active_seconds, last_resumed_at, recommended_level, started_at, paused_at,
         completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'completed', ?, 0, NULL, ?, ?, NULL, ?, ?, ?)`)
        .bind(
          attemptId,
          auth.user.id,
          auth.classId,
          auth.access.pathId,
          body.mode,
          levelDifficulty(body.mode),
          body.mode,
          now,
          now,
          now,
          now,
        ),
    ]);
    return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage), { status: 201 });
  }

  if (action === "start" || action === "restart") {
    if (!isEntryMode(body.mode)) return Response.json({ error: "A valid placement mode is required" }, { status: 400 });
    const existing = await latestAttempt(auth.database, auth.user.id, auth.classId);
    if (action === "start" && existing) {
      return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage));
    }
    if (action === "restart") {
      if (existing && (existing.status === "in_progress" || existing.status === "paused")) {
        return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage));
      }
    }
    await insertAttempt(auth.database, auth.user.id, auth.access, body.mode);
    return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage), { status: 201 });
  }

  const attemptId = safeIdentifier(body.attemptId);
  if (!attemptId) return Response.json({ error: "A valid attempt ID is required" }, { status: 400 });
  const attempt = await attemptForAction(auth.database, auth.user.id, auth.classId, attemptId);
  if (!attempt || attempt.entryMode !== "adaptive") {
    return Response.json({ error: "Adaptive placement attempt not found" }, { status: 404 });
  }
  const now = Math.floor(Date.now() / 1000);

  if (action === "pause") {
    if (attempt.status === "in_progress") {
      await auth.database.prepare(`UPDATE smartlingo_placement_attempts SET status = 'paused',
        active_seconds = ?, last_resumed_at = NULL, paused_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND status = 'in_progress'`)
        .bind(liveActiveSeconds(attempt, now), now, now, attempt.id, auth.user.id).run();
    } else if (attempt.status !== "paused") {
      return Response.json({ error: "Only an active placement can be paused" }, { status: 409 });
    }
    return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage));
  }

  if (action === "resume") {
    if (attempt.status === "paused") {
      await auth.database.prepare(`UPDATE smartlingo_placement_attempts SET status = 'in_progress',
        last_resumed_at = ?, paused_at = NULL, updated_at = ?
        WHERE id = ? AND user_id = ? AND status = 'paused'`)
        .bind(now, now, attempt.id, auth.user.id).run();
    } else if (attempt.status !== "in_progress") {
      return Response.json({ error: "Only a paused placement can be resumed" }, { status: 409 });
    }
    return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage));
  }

  if (action !== "answer" && action !== "skip") {
    return Response.json({ error: "Unsupported placement action" }, { status: 400 });
  }
  const itemId = safeIdentifier(body.itemId, 240);
  if (!itemId) return Response.json({ error: "A valid item ID is required" }, { status: 400 });
  if (action === "answer" && (typeof body.answer !== "string" || !body.answer.trim())) {
    return Response.json({ error: "An answer is required" }, { status: 400 });
  }
  if (typeof body.answer === "string" && body.answer.length > MAX_ANSWER_LENGTH) {
    return Response.json({ error: `Answers must be ${MAX_ANSWER_LENGTH} characters or fewer` }, { status: 400 });
  }

  const duplicate = await auth.database.prepare(`SELECT id FROM smartlingo_placement_responses
    WHERE attempt_id = ? AND item_key = ? AND item_version = ? LIMIT 1`)
    .bind(attempt.id, itemId, SMARTLINGO_LEARNING_CONTENT_VERSION).first<{ id: string }>();
  if (duplicate) {
    return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage));
  }
  if (attempt.status !== "in_progress") {
    return Response.json({ error: "Resume the placement before answering" }, { status: 409 });
  }
  const rowsBefore = await responseRows(auth.database, attempt.id);
  const questions = generateAdaptivePlacementQuestions(
    targetLanguage,
    observationsFromRows(rowsBefore),
    attempt.id,
  );
  const expectedQuestion = questions[rowsBefore.length];
  if (!expectedQuestion || expectedQuestion.id !== itemId) {
    return Response.json({ error: "This item is not the current placement question" }, { status: 409 });
  }

  const skipped = action === "skip";
  const scored = scorePlacementAnswer(expectedQuestion, typeof body.answer === "string" ? body.answer : "", skipped);
  const durationSeconds = Math.min(3600, Math.max(0, attempt.lastResumedAt ? now - attempt.lastResumedAt : 0));
  await auth.database.prepare(`INSERT OR IGNORE INTO smartlingo_placement_responses
    (id, attempt_id, item_key, item_version, skill, difficulty, answer_text,
     skipped, score, ai_feedback, duration_seconds, answered_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`)
    .bind(
      createId(),
      attempt.id,
      expectedQuestion.id,
      expectedQuestion.contentVersion,
      expectedQuestion.skill,
      levelDifficulty(expectedQuestion.level),
      skipped ? "" : (body.answer as string).trim(),
      skipped ? 1 : 0,
      skipped ? null : scored.score,
      durationSeconds,
      now,
      now,
      now,
    ).run();

  const rowsAfter = await responseRows(auth.database, attempt.id);
  const activeSeconds = Math.min(MAX_ACTIVE_SECONDS, Number(attempt.activeSeconds || 0) + durationSeconds);
  if (rowsAfter.length >= TOTAL_PLACEMENT_ITEMS) {
    const finalQuestions = generateAdaptivePlacementQuestions(
      targetLanguage,
      observationsFromRows(rowsAfter),
      attempt.id,
    );
    const questionById = new Map(finalQuestions.map(question => [question.id, question]));
    const scoreRows = rowsAfter.flatMap(row => {
      const question = questionById.get(row.itemKey);
      if (!question) return [];
      return [{
        questionId: question.id,
        skill: question.skill,
        round: question.round,
        level: question.level,
        score: row.score ?? 0,
        skipped: Boolean(row.skipped),
      } satisfies PlacementAnswerScore];
    });
    const evaluation = evaluatePlacement(scoreRows);
    if (!evaluation.isComplete) {
      return Response.json({ error: "Placement responses could not be evaluated safely" }, { status: 409 });
    }
    const scores = Object.fromEntries(evaluation.skills.map(skill => [skill.skill, skill.score])) as Record<SmartLingoSkill, number>;
    await auth.database.prepare(`UPDATE smartlingo_placement_attempts SET status = 'completed',
      active_seconds = ?, last_resumed_at = NULL, vocabulary_score = ?, reading_score = ?,
      writing_score = ?, listening_score = ?, dialogue_score = ?, overall_score = ?,
      recommended_level = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'in_progress'`)
      .bind(
        activeSeconds,
        scores.vocabulary,
        scores.reading,
        scores.writing,
        scores.listening,
        scores.dialogue,
        evaluation.overallScore,
        evaluation.recommendedLevel,
        now,
        now,
        attempt.id,
        auth.user.id,
      ).run();
    for (const skill of evaluation.skills) {
      await auth.database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
        (id, user_id, class_id, attempt_id, domain, activity_type, duration_seconds,
         units, score, source_type, source_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'placement', ?, 3, ?, 'placement_skill', ?, ?)`)
        .bind(
          createId(),
          auth.user.id,
          auth.classId,
          attempt.id,
          skill.skill,
          Math.round(activeSeconds / 5),
          skill.score,
          `${attempt.id}:${skill.skill}`,
          now,
        ).run();
    }
  } else {
    const nextQuestion = generateAdaptivePlacementQuestions(
      targetLanguage,
      observationsFromRows(rowsAfter),
      attempt.id,
    )[rowsAfter.length];
    await auth.database.prepare(`UPDATE smartlingo_placement_attempts SET
      current_difficulty = ?, active_seconds = ?, last_resumed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'in_progress'`)
      .bind(nextQuestion ? levelDifficulty(nextQuestion.level) : 2, activeSeconds, now, now, attempt.id, auth.user.id).run();
  }

  return Response.json(await placementState(auth.database, auth.user.id, auth.access, uiLanguage));
}
