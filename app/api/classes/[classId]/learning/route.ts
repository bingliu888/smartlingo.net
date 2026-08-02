import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import {
  buildDailyPracticeItem,
  createVocabularyReviewState,
  getVocabularyVisualCue,
  getVocabularySample,
  gradeDailyPracticeItem,
  scheduleVocabularyReview,
  selectNextVocabularyReviewMode,
  SMARTLINGO_LEARNING_LANGUAGE_CODES,
  SMARTLINGO_SKILLS,
  SMARTLINGO_VOCABULARY_REVIEW_MODES,
  type SmartLingoInterfaceLanguage,
  type SmartLingoLearningLanguage,
  type SmartLingoLevel,
  type VocabularyReviewGrade,
  type VocabularyReviewMode,
  type VocabularyReviewState,
} from "../../../../../lib/smartlingo-learning";
import {
  localDateKey,
  requireOfficialClassMembership,
  safeTimeZone,
  type LearningDatabase,
  type OfficialClassAccess,
} from "../../../../../lib/smartlingo-learning-access";
import { buildQuickCourse, isQuickCourseDays } from "../../../../../lib/smartlingo-quick-courses";

export const dynamic = "force-dynamic";

const VOCABULARY_GRADES = ["again", "hard", "good", "easy", "suspend"] as const;
const PRACTICE_SKILLS = ["reading", "writing", "listening", "dialogue"] as const;
const MAX_ANSWER_LENGTH = 1_200;

type CompletedPlacementRow = {
  id: string;
  status: "completed";
  entryMode: string;
  overallScore: number | null;
  recommendedLevel: SmartLingoLevel | null;
  vocabularyScore: number | null;
  readingScore: number | null;
  writingScore: number | null;
  listeningScore: number | null;
  dialogueScore: number | null;
  completedAt: number | null;
};

type VocabularyProgressRow = {
  id: string;
  status: "new" | "learning" | "review" | "mastered" | "suspended";
  modesSeen: string;
  reviewBox: number;
  intervalDays: number;
  reviewCount: number;
  correctCount: number;
  lapseCount: number;
  lastScore: number | null;
  dueAt: number | null;
  lastReviewedAt: number | null;
  updatedAt: number;
};

type PracticeEventRow = {
  sourceId: string;
  score: number | null;
};

type QuickEnrollmentRow = {
  offeringId: string;
  durationDays: number;
  currentDay: number;
  startedAt: number;
  status: string;
};

type LearningBody = {
  action?: unknown;
  date?: unknown;
  lang?: unknown;
  timeZone?: unknown;
  vocabularyMode?: unknown;
  sampleId?: unknown;
  mode?: unknown;
  grade?: unknown;
  taskId?: unknown;
  skill?: unknown;
  answer?: unknown;
  skipped?: unknown;
  channel?: unknown;
};

const SPEECH_LOCALES: Record<SmartLingoLearningLanguage, string> = {
  zh: "zh-CN",
  en: "en-US",
  es: "es-ES",
  ja: "ja-JP",
  ko: "ko-KR",
  fr: "fr-FR",
  de: "de-DE",
  ru: "ru-RU",
  it: "it-IT",
  pt: "pt-PT",
  ar: "ar-SA",
  hi: "hi-IN",
};

function isLearningLanguage(value: string): value is SmartLingoLearningLanguage {
  return SMARTLINGO_LEARNING_LANGUAGE_CODES.includes(value as SmartLingoLearningLanguage);
}

function isPracticeSkill(value: unknown): value is (typeof PRACTICE_SKILLS)[number] {
  return typeof value === "string" && PRACTICE_SKILLS.includes(value as (typeof PRACTICE_SKILLS)[number]);
}

function isVocabularyMode(value: unknown): value is VocabularyReviewMode {
  return typeof value === "string" && SMARTLINGO_VOCABULARY_REVIEW_MODES.includes(value as VocabularyReviewMode);
}

function isVocabularyGrade(value: unknown): value is VocabularyReviewGrade {
  return typeof value === "string" && VOCABULARY_GRADES.includes(value as VocabularyReviewGrade);
}

function safeIdentifier(value: unknown, maximum = 160) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function interfaceLanguage(value: unknown, fallback: string): SmartLingoInterfaceLanguage {
  if (value === "zh" || value === "en") return value;
  return fallback === "en" ? "en" : "zh";
}

function placementLevel(value: SmartLingoLevel | null): SmartLingoLevel {
  return value === "advanced" || value === "intermediate" ? value : "beginner";
}

function parseModes(value: string) {
  try {
    const modes = JSON.parse(value) as unknown;
    return Array.isArray(modes)
      ? modes.filter(isVocabularyMode).slice(-3)
      : [];
  } catch {
    return [];
  }
}

function reviewState(sampleId: string, row: VocabularyProgressRow | null, nowMilliseconds: number): VocabularyReviewState {
  if (!row) return createVocabularyReviewState(sampleId, nowMilliseconds);
  return {
    sampleId,
    status: row.status === "new" ? "learning" : row.status,
    intervalDays: Math.max(0, Number(row.intervalDays || 0)),
    dueAt: row.dueAt === null ? null : Number(row.dueAt) * 1000,
    consecutiveCorrect: Math.max(0, Math.min(3, Number(row.reviewBox || 0))),
    recentCorrectModes: parseModes(row.modesSeen),
    lapseCount: Math.max(0, Number(row.lapseCount || 0)),
    lastGrade: null,
    lastReviewedAt: row.lastReviewedAt === null ? null : Number(row.lastReviewedAt) * 1000,
  };
}

function gradeScore(grade: VocabularyReviewGrade) {
  if (grade === "again") return 0;
  if (grade === "hard") return 60;
  if (grade === "good") return 85;
  if (grade === "easy") return 100;
  return null;
}

async function completedPlacement(database: LearningDatabase, userId: string, classId: string) {
  return database.prepare(`SELECT id, status, entry_mode AS entryMode,
    overall_score AS overallScore, recommended_level AS recommendedLevel,
    vocabulary_score AS vocabularyScore, reading_score AS readingScore,
    writing_score AS writingScore, listening_score AS listeningScore,
    dialogue_score AS dialogueScore, completed_at AS completedAt
    FROM smartlingo_placement_attempts
    WHERE user_id = ? AND class_id = ? AND status = 'completed'
    ORDER BY completed_at DESC, updated_at DESC LIMIT 1`)
    .bind(userId, classId).first<CompletedPlacementRow>();
}

async function vocabularyProgress(
  database: LearningDatabase,
  userId: string,
  pathId: string,
  sampleId: string,
  version: string,
) {
  return database.prepare(`SELECT id, status, modes_seen AS modesSeen,
    review_box AS reviewBox, interval_days AS intervalDays,
    review_count AS reviewCount, correct_count AS correctCount,
    lapse_count AS lapseCount, last_score AS lastScore,
    due_at AS dueAt, last_reviewed_at AS lastReviewedAt, updated_at AS updatedAt
    FROM smartlingo_vocabulary_progress
    WHERE user_id = ? AND path_id = ? AND word_key = ? AND word_version = ? LIMIT 1`)
    .bind(userId, pathId, sampleId, version).first<VocabularyProgressRow>();
}

function publicProgress(row: VocabularyProgressRow | null) {
  return row ? {
    status: row.status,
    reviewBox: Number(row.reviewBox || 0),
    intervalDays: Number(row.intervalDays || 0),
    reviewCount: Number(row.reviewCount || 0),
    correctCount: Number(row.correctCount || 0),
    lapseCount: Number(row.lapseCount || 0),
    lastScore: row.lastScore,
    dueAt: row.dueAt,
    lastReviewedAt: row.lastReviewedAt,
  } : {
    status: "new",
    reviewBox: 0,
    intervalDays: 0,
    reviewCount: 0,
    correctCount: 0,
    lapseCount: 0,
    lastScore: null,
    dueAt: null,
    lastReviewedAt: null,
  };
}

async function learningState(
  database: LearningDatabase,
  userId: string,
  access: OfficialClassAccess,
  placement: CompletedPlacementRow,
  date: string,
  uiLanguage: SmartLingoInterfaceLanguage,
  requestedMode?: VocabularyReviewMode,
) {
  const targetLanguage = access.targetLanguage as SmartLingoLearningLanguage;
  const level = placementLevel(placement.recommendedLevel);
  const sample = getVocabularySample(targetLanguage, level);
  const progress = await vocabularyProgress(database, userId, access.pathId, sample.stableId, sample.version);
  const state = reviewState(sample.stableId, progress, Date.now());
  const nextMode = requestedMode ?? selectNextVocabularyReviewMode(state);
  const quickEnrollment = await database.prepare(`SELECT e.offering_id AS offeringId,
    offering.duration_days AS durationDays, e.current_day AS currentDay,
    e.started_at AS startedAt, e.status
    FROM smartlingo_quick_course_enrollments_v2 e
    JOIN smartlingo_quick_course_offerings_v2 offering ON offering.id = e.offering_id
    WHERE e.user_id = ? AND e.class_id = ? AND e.status IN ('active','completed')
    ORDER BY e.updated_at DESC LIMIT 1`).bind(userId, access.classId).first<QuickEnrollmentRow>();
  const quickCourse = quickEnrollment && isQuickCourseDays(quickEnrollment.durationDays)
    ? buildQuickCourse(targetLanguage, quickEnrollment.durationDays)
    : null;
  const elapsedDay = quickEnrollment
    ? Math.max(1, Math.floor((Math.floor(Date.now() / 1000) - quickEnrollment.startedAt) / 86400) + 1)
    : 1;
  const courseDay = quickCourse
    ? quickCourse.schedule[Math.min(quickCourse.days, elapsedDay) - 1]
    : null;
  const assignedSkills = courseDay?.skills ?? SMARTLINGO_SKILLS;
  const dailyTasks = SMARTLINGO_SKILLS.map(skill => ({
    ...buildDailyPracticeItem(targetLanguage, skill, date, uiLanguage, level),
    speechLocale: SPEECH_LOCALES[targetLanguage],
  }));
  const sourceIds = dailyTasks.map(task => `${access.classId}:${task.taskId}`);
  const eventResult = await database.prepare(`SELECT source_id AS sourceId, score
    FROM smartlingo_learning_activity_events
    WHERE user_id = ? AND class_id = ? AND source_type = 'daily_practice'
      AND source_id IN (?, ?, ?, ?, ?)`)
    .bind(userId, access.classId, ...sourceIds).run<PracticeEventRow>();
  const events = new Map((eventResult.results || []).map(event => [event.sourceId, event]));
  const tasks = dailyTasks.map(task => {
    const event = events.get(`${access.classId}:${task.taskId}`);
    return {
      ...task,
      status: event ? event.score === null ? "skipped" as const : "completed" as const : "available" as const,
      score: event?.score ?? null,
    };
  }).filter(task => assignedSkills.includes(task.skill));
  const localizedMeaning = sample.meaning[uiLanguage];
  const localizedExampleTranslation = sample.exampleTranslation[uiLanguage];

  return {
    class: {
      id: access.classId,
      title: access.title,
      targetLanguage: access.targetLanguage,
      classKind: "official_language" as const,
    },
    date,
    placement: {
      id: placement.id,
      status: placement.status,
      entryMode: placement.entryMode,
      overallScore: placement.overallScore,
      recommendedLevel: placement.recommendedLevel,
      skillScores: {
        vocabulary: placement.vocabularyScore,
        reading: placement.readingScore,
        writing: placement.writingScore,
        listening: placement.listeningScore,
        dialogue: placement.dialogueScore,
      },
    },
    quickCourse: quickCourse && courseDay ? {
      offeringId: quickEnrollment!.offeringId,
      title: quickCourse.title,
      durationDays: quickCourse.days,
      currentDay: courseDay.day,
      scene: courseDay.scene,
      skills: courseDay.skills,
      estimatedMinutes: courseDay.estimatedMinutes,
      curriculumVersion: quickCourse.curriculumVersion,
    } : null,
    vocabulary: {
      taskId: sample.stableId,
      sampleId: sample.stableId,
      stableId: sample.stableId,
      word: sample.form,
      form: sample.form,
      pronunciation: sample.pronunciation,
      meaning: sample.meaning,
      visualCue: getVocabularyVisualCue(sample),
      example: sample.example,
      exampleTranslation: sample.exampleTranslation,
      audioText: sample.form,
      speechLocale: SPEECH_LOCALES[targetLanguage],
      direction: targetLanguage === "ar" ? "rtl" as const : "ltr" as const,
      mode: nextMode,
      status: progress?.status ?? "new",
      sample: {
        id: sample.stableId,
        version: sample.version,
        form: sample.form,
        pronunciation: sample.pronunciation,
        meaning: localizedMeaning,
        example: sample.example,
        exampleTranslation: localizedExampleTranslation,
      },
      progress: publicProgress(progress),
      nextMode,
    },
    tasks,
    dailyTasks: tasks,
  };
}

async function authorize(request: Request, classIdValue: unknown) {
  const user = await getSessionUser(request);
  if (!user) return { response: Response.json({ error: "Authentication required" }, { status: 401 }) } as const;
  const classId = safeIdentifier(classIdValue, 100);
  if (!classId) return { response: Response.json({ error: "A valid class ID is required" }, { status: 400 }) } as const;
  const database = getDatabase();
  const access = await requireOfficialClassMembership(database, user, classId);
  if (!access) {
    return { response: Response.json({ error: "Active membership in this official language class is required" }, { status: 403 }) } as const;
  }
  if (!isLearningLanguage(access.targetLanguage)) {
    return { response: Response.json({ error: "This class language is not supported for learning" }, { status: 409 }) } as const;
  }
  const placement = await completedPlacement(database, user.id, classId);
  if (!placement) {
    return {
      response: Response.json({
        error: "Complete placement before starting daily learning",
        code: "SMARTLINGO_PLACEMENT_REQUIRED",
        placementRequired: true,
      }, { status: 409 }),
    } as const;
  }
  return {
    user,
    classId,
    database,
    access: { ...access, targetLanguage: access.targetLanguage },
    placement,
  } as const;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const auth = await authorize(request, (await params).classId);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const timeZone = safeTimeZone(url.searchParams.get("timeZone"));
  const dateValue = url.searchParams.get("date") || localDateKey(Math.floor(Date.now() / 1000), timeZone);
  if (!validDate(dateValue)) return Response.json({ error: "A valid YYYY-MM-DD date is required" }, { status: 400 });
  const uiLanguage = interfaceLanguage(url.searchParams.get("lang"), auth.user.preferredLanguage);
  const modeValue = url.searchParams.get("vocabularyMode");
  if (modeValue && !isVocabularyMode(modeValue)) {
    return Response.json({ error: "A valid vocabulary review mode is required" }, { status: 400 });
  }
  const requestedMode = isVocabularyMode(modeValue) ? modeValue : undefined;
  return Response.json(await learningState(
    auth.database,
    auth.user.id,
    auth.access,
    auth.placement,
    dateValue,
    uiLanguage,
    requestedMode,
  ));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const auth = await authorize(request, (await params).classId);
  if ("response" in auth) return auth.response;
  let body: LearningBody;
  try {
    body = await request.json() as LearningBody;
  } catch {
    return Response.json({ error: "A valid JSON body is required" }, { status: 400 });
  }
  const timeZone = safeTimeZone(typeof body.timeZone === "string" ? body.timeZone : null);
  const today = localDateKey(Math.floor(Date.now() / 1000), timeZone);
  const uiLanguage = interfaceLanguage(body.lang, auth.user.preferredLanguage);
  const rawAction = typeof body.action === "string" ? body.action : "";
  const action = rawAction === "review_vocabulary" ? "vocabulary_review"
    : rawAction === "complete_practice" ? (body.skipped ? "skip_task" : "submit_task")
      : rawAction;

  if (action === "vocabulary_review") {
    const sampleId = safeIdentifier(body.sampleId || body.taskId, 160);
    if (!sampleId || !isVocabularyMode(body.mode) || !isVocabularyGrade(body.grade)) {
      return Response.json({ error: "A valid vocabulary sample, mode, and grade are required" }, { status: 400 });
    }
    const sample = getVocabularySample(auth.access.targetLanguage, placementLevel(auth.placement.recommendedLevel));
    if (sampleId !== sample.stableId) {
      return Response.json({ error: "This vocabulary sample is not the current server-assigned item" }, { status: 409 });
    }
    const sourceId = `${auth.classId}:${today}:${sample.stableId}:${body.mode}`;
    if (sourceId.length > 160) return Response.json({ error: "Vocabulary activity identity is too long" }, { status: 409 });
    const now = Math.floor(Date.now() / 1000);
    const score = gradeScore(body.grade);
    const inserted = await auth.database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
      (id, user_id, class_id, domain, activity_type, duration_seconds, units, score,
       source_type, source_id, created_at)
      VALUES (?, ?, ?, 'vocabulary', 'flashcard', 60, 1, ?, 'vocabulary_review', ?, ?)
      RETURNING id`).bind(createId(), auth.user.id, auth.classId, score, sourceId, now).first<{ id: string }>();

    if (inserted) {
      const current = await vocabularyProgress(
        auth.database,
        auth.user.id,
        auth.access.pathId,
        sample.stableId,
        sample.version,
      );
      const scheduled = scheduleVocabularyReview(reviewState(sample.stableId, current, now * 1000), {
        grade: body.grade,
        mode: body.mode,
        reviewedAt: now * 1000,
      });
      const correctIncrement = body.grade === "hard" || body.grade === "good" || body.grade === "easy" ? 1 : 0;
      const lapseIncrement = body.grade === "again" ? 1 : 0;
      await auth.database.prepare(`INSERT INTO smartlingo_vocabulary_progress
        (id, user_id, path_id, class_id, word_key, word_version, status, modes_seen,
         review_box, interval_days, review_count, correct_count, lapse_count,
         last_score, due_at, last_reviewed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, path_id, word_key, word_version) DO UPDATE SET
          class_id = excluded.class_id, status = excluded.status, modes_seen = excluded.modes_seen,
          review_box = excluded.review_box, interval_days = excluded.interval_days,
          review_count = smartlingo_vocabulary_progress.review_count + 1,
          correct_count = smartlingo_vocabulary_progress.correct_count + ?,
          lapse_count = smartlingo_vocabulary_progress.lapse_count + ?,
          last_score = excluded.last_score, due_at = excluded.due_at,
          last_reviewed_at = excluded.last_reviewed_at, updated_at = excluded.updated_at`)
        .bind(
          createId(),
          auth.user.id,
          auth.access.pathId,
          auth.classId,
          sample.stableId,
          sample.version,
          scheduled.status,
          JSON.stringify(scheduled.recentCorrectModes),
          scheduled.consecutiveCorrect,
          scheduled.intervalDays,
          correctIncrement,
          lapseIncrement,
          score,
          scheduled.dueAt === null ? null : Math.floor(scheduled.dueAt / 1000),
          now,
          now,
          now,
          correctIncrement,
          lapseIncrement,
        ).run();
    }
    return Response.json({
      ...await learningState(
        auth.database,
        auth.user.id,
        auth.access,
        auth.placement,
        today,
        uiLanguage,
      ),
      idempotent: !inserted,
    });
  }

  if (action === "submit_task" || action === "skip_task") {
    const taskId = safeIdentifier(body.taskId, 240);
    if (!taskId || !isPracticeSkill(body.skill)) {
      return Response.json({ error: "A valid daily task and skill are required" }, { status: 400 });
    }
    const parts = taskId.split(":");
    const taskDate = parts.length === 5 && parts[0] === "daily" ? parts[1] : "";
    const taskLanguage = parts.length === 5 ? parts[2] : "";
    const taskSkill = parts.length === 5 ? parts[3] : "";
    if (!validDate(taskDate) || taskDate !== today || taskLanguage !== auth.access.targetLanguage || taskSkill !== body.skill) {
      return Response.json({ error: "This is not today's server-assigned task" }, { status: 409 });
    }
    const assignedLevel = placementLevel(auth.placement.recommendedLevel);
    const assigned = buildDailyPracticeItem(
      auth.access.targetLanguage,
      body.skill,
      taskDate,
      uiLanguage,
      assignedLevel,
    );
    if (assigned.taskId !== taskId) {
      return Response.json({ error: "The task version is no longer current" }, { status: 409 });
    }
    const skipped = action === "skip_task";
    if (!skipped && (typeof body.answer !== "string" || !body.answer.trim())) {
      return Response.json({ error: "An answer is required" }, { status: 400 });
    }
    if (typeof body.answer === "string" && body.answer.length > MAX_ANSWER_LENGTH) {
      return Response.json({ error: `Answers must be ${MAX_ANSWER_LENGTH} characters or fewer` }, { status: 400 });
    }
    const score = skipped ? null : gradeDailyPracticeItem(
      auth.access.targetLanguage,
      body.skill,
      taskDate,
      body.answer as string,
      false,
      assignedLevel,
    ).score;
    const sourceId = `${auth.classId}:${taskId}`;
    if (sourceId.length > 160) return Response.json({ error: "Daily task identity is too long" }, { status: 409 });
    const now = Math.floor(Date.now() / 1000);
    const inserted = await auth.database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
      (id, user_id, class_id, domain, activity_type, duration_seconds, units, score,
       source_type, source_id, created_at)
      VALUES (?, ?, ?, ?, 'practice', ?, 1, ?, 'daily_practice', ?, ?)
      RETURNING id`).bind(
        createId(),
        auth.user.id,
        auth.classId,
        body.skill,
        assigned.estimatedMinutes * 60,
        score,
        sourceId,
        now,
      ).first<{ id: string }>();
    return Response.json({
      ...await learningState(
        auth.database,
        auth.user.id,
        auth.access,
        auth.placement,
        taskDate,
        uiLanguage,
      ),
      idempotent: !inserted,
    });
  }

  if (action === "open_community") {
    const channel = body.channel === "live_chat" ? "live_chat" : body.channel === "community" || body.channel === undefined
      ? "community"
      : null;
    if (!channel) return Response.json({ error: "A valid community channel is required" }, { status: 400 });
    const activityType = channel === "live_chat" ? "live_chat" : "group_chat";
    const sourceType = channel === "live_chat" ? "live_chat_entry" : "community_entry";
    const sourceId = `${auth.classId}:${today}`;
    const now = Math.floor(Date.now() / 1000);
    const inserted = await auth.database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
      (id, user_id, class_id, domain, activity_type, duration_seconds, units,
       source_type, source_id, created_at)
      VALUES (?, ?, ?, 'community', ?, 0, 1, ?, ?, ?) RETURNING id`)
      .bind(createId(), auth.user.id, auth.classId, activityType, sourceType, sourceId, now).first<{ id: string }>();
    return Response.json({
      ok: true,
      idempotent: !inserted,
      href: channel === "live_chat" ? `/${uiLanguage}/messages` : `/${uiLanguage}/community`,
    });
  }

  return Response.json({ error: "Unsupported learning action" }, { status: 400 });
}
