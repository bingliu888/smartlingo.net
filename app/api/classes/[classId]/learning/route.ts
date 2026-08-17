import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import {
  buildDailyTeachingPlan,
  buildDailyVocabularyQuiz,
  buildDailyPracticeItem,
  createVocabularyReviewState,
  getBeginnerSessionVocabularyDeck,
  getVocabularyVisualCue,
  getVocabularySample,
  getVocabularySampleById,
  gradeDailyPracticeItem,
  gradeDailyVocabularyQuiz,
  gradeDailyVocabularyQuizResponses,
  scheduleVocabularyReview,
  selectNextVocabularyReviewMode,
  scorePronunciationTranscript,
  SMARTLINGO_LEARNING_CONTENT_VERSION,
  SMARTLINGO_LEARNING_LANGUAGE_CODES,
  SMARTLINGO_SKILLS,
  SMARTLINGO_VOCABULARY_REVIEW_MODES,
  type SmartLingoInterfaceLanguage,
  type SmartLingoLearningLanguage,
  type SmartLingoLevel,
  type SmartLingoSessionMinutes,
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
import {
  buildQuickCourse,
  isCourseDuration,
  isCourseLevel,
  type SmartLingoCourseDays,
  type SmartLingoCourseLevel,
} from "../../../../../lib/smartlingo-quick-courses";
import { reviewSmartAiLearningContent, smartAiRequestCountry } from "../../../../../lib/smartlingo-ai-gateway";
import {
  calculateCourseDailyScore,
  calculateCourseOutcome,
} from "../../../../../lib/smartlingo-course-scoring";
import {
  buildDailyAnswerFeedback,
  calculateLearningStreak,
  calculateLearningXp,
  composeDailyLearningSession,
  mergeCheckpointDrafts,
  type DailyLearningSession,
  type SmartLingoDailySkill,
} from "../../../../../lib/smartlingo-daily-loop";

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
  isFocused: number;
  dueAt: number | null;
  lastReviewedAt: number | null;
  updatedAt: number;
};

type PracticeEventRow = {
  sourceId: string;
  score: number | null;
};

type QuickEnrollmentRow = {
  id: string;
  offeringId: string;
  durationDays: number;
  level: SmartLingoCourseLevel;
  startDay: number;
  currentDay: number;
  startedAt: number;
  status: string;
};

type CourseDailyScoreRow = {
  courseDay: number;
  localDate?: string;
  startedAt?: number;
  score: number;
  isComplete: number;
};

type CourseCertificateRow = {
  id: string;
  certificateNumber: string;
  finalScore: number;
  issuedAt: number;
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
  focused?: unknown;
  taskId?: unknown;
  skill?: unknown;
  answer?: unknown;
  skipped?: unknown;
  channel?: unknown;
  sessionMinutes?: unknown;
  remainingSeconds?: unknown;
  transcript?: unknown;
  answers?: unknown;
  clientOperationId?: unknown;
  baseRevision?: unknown;
  baseDraft?: unknown;
  draft?: unknown;
  activeStep?: unknown;
  checkpointId?: unknown;
  enrollmentId?: unknown;
  courseDay?: unknown;
  checkpointDate?: unknown;
  checkpointContentVersion?: unknown;
};

type DailyQuizRow = { attemptNumber: number; score: number; correctCount: number; questionCount: number; createdAt: number };

type LearningPlanRow = {
  useCase: string;
  dailyMinutes: number;
  currentStageId: string | null;
  currentUnitId: string | null;
};

type DailyCheckpointDraft = {
  answers?: Partial<Record<SmartLingoDailySkill, string>>;
  quizAnswers?: Record<string, string>;
  vocabularyMode?: VocabularyReviewMode;
  vocabularyIndex?: number;
};

type DailyCheckpointRow = {
  id: string;
  enrollmentId: string;
  userId: string;
  classId: string;
  courseDay: number;
  localDate: string;
  timeZone: string;
  contentVersion: string;
  planJson: string;
  draftJson: string;
  activeStep: string;
  revision: number;
  updatedAt: number;
};

type DailyCheckpointRevisionRow = {
  revision: number;
  draftJson: string;
  activeStep: string;
};

type DailyQuizReceiptRow = {
  id: string;
  checkpointId: string;
  userId: string;
  classId: string;
  taskId: string;
  skill: string;
  answerText: string;
  score: number;
  correct: number;
  skipped: number;
  explanationZh: string;
  explanationEn: string;
  hintZh: string;
  hintEn: string;
  contentVersion: string;
};

type DailyQuizReceiptEvidence = {
  attemptId: string;
  activityId: string;
  checkpointId: string;
  sessionDate: string;
  contentVersion: string;
  uiLanguage: SmartLingoInterfaceLanguage;
  vocabularyDay: number;
  targetLanguage: SmartLingoLearningLanguage;
  fingerprint: string;
};

type DailySyncReceiptRow = {
  id: string;
  checkpointId: string;
  userId: string;
  requestFingerprint: string | null;
};

type DailyFeedbackRow = {
  taskId: string;
  skill: string;
  answerText: string;
  score: number | null;
  correct: number;
  skipped: number;
  explanationZh: string;
  explanationEn: string;
  hintZh: string;
  hintEn: string;
  contentVersion: string;
  createdAt: number;
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

function quizAnswers(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 20 || entries.some(([key, answer]) => key.length > 120 || typeof answer !== "string" || answer.length > 80)) return null;
  return Object.fromEntries(entries) as Record<string, string>;
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

const CHECKPOINT_STEPS = ["vocabulary", "reading", "writing", "listening", "dialogue", "exam", "recap"] as const;
type CheckpointStep = (typeof CHECKPOINT_STEPS)[number];

function isCheckpointStep(value: unknown): value is CheckpointStep {
  return typeof value === "string" && CHECKPOINT_STEPS.includes(value as CheckpointStep);
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalJsonValue(child)]));
  }
  return value;
}

async function quizSubmissionFingerprint(input: {
  userId: string;
  classId: string;
  checkpointId: string;
  sessionDate: string;
  contentVersion: string;
  uiLanguage: SmartLingoInterfaceLanguage;
  vocabularyDay: number;
  targetLanguage: SmartLingoLearningLanguage;
  answers: Record<string, string>;
}) {
  return sha256Hex(JSON.stringify(canonicalJsonValue(input)));
}

async function checkpointOperationFingerprint(input: {
  userId: string;
  classId: string;
  actualCheckpointId: string;
  intendedCheckpointId: string | null;
  enrollmentId: string;
  courseDay: number;
  sessionDate: string;
  contentVersion: string;
  baseRevision: number;
  draft: DailyCheckpointDraft;
  activeStep: CheckpointStep;
}) {
  return sha256Hex(JSON.stringify(canonicalJsonValue(input)));
}

function quizReceiptEvidence(value: string): DailyQuizReceiptEvidence | null {
  const parsed = parseJsonRecord(value);
  const attemptId = safeIdentifier(parsed.attemptId, 100);
  const activityId = safeIdentifier(parsed.activityId, 100);
  const checkpointId = safeIdentifier(parsed.checkpointId, 100);
  const contentVersion = safeIdentifier(parsed.contentVersion, 48);
  const sessionDate = validDate(parsed.sessionDate) ? parsed.sessionDate : null;
  const uiLanguage = parsed.uiLanguage === "zh" || parsed.uiLanguage === "en" ? parsed.uiLanguage : null;
  const vocabularyDay = Number(parsed.vocabularyDay);
  const targetLanguage = typeof parsed.targetLanguage === "string" && isLearningLanguage(parsed.targetLanguage)
    ? parsed.targetLanguage
    : null;
  const fingerprint = typeof parsed.fingerprint === "string" && /^[a-f0-9]{64}$/.test(parsed.fingerprint)
    ? parsed.fingerprint
    : null;
  return attemptId && activityId && checkpointId && contentVersion && sessionDate && uiLanguage
    && Number.isInteger(vocabularyDay) && vocabularyDay >= 1 && vocabularyDay <= 365
    && targetLanguage && fingerprint
    ? {
        attemptId,
        activityId,
        checkpointId,
        sessionDate,
        contentVersion,
        uiLanguage,
        vocabularyDay,
        targetLanguage,
        fingerprint,
      }
    : null;
}

function persistedDailyFeedback(row: Pick<DailyQuizReceiptRow,
  "score" | "skipped" | "explanationZh" | "explanationEn" | "hintZh" | "hintEn" | "contentVersion">) {
  const score = Math.max(0, Math.min(100, Number(row.score)));
  const skipped = Boolean(row.skipped);
  const correctness = skipped
    ? "skipped"
    : score >= 80
      ? "correct"
      : score >= 40
        ? "partially_correct"
        : "incorrect";
  return {
    skill: "vocabulary" as const,
    correctness,
    isCorrect: skipped ? null : correctness === "correct",
    score: skipped ? 0 : score,
    explanation: { zh: row.explanationZh, en: row.explanationEn },
    hint: { zh: row.hintZh, en: row.hintEn },
    disclaimer: {
      zh: "这是人工智能生成的练习反馈，不是真人教师评价，也不是正式或官方考试结果。",
      en: "This artificial-intelligence practice feedback is not a human teacher evaluation or a formal or official exam result.",
    },
    contentVersion: row.contentVersion,
    scoringBasis: "server_score" as const,
  };
}

function checkpointDraft(value: unknown): DailyCheckpointDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const draft: DailyCheckpointDraft = {};
  if (input.answers !== undefined) {
    if (!input.answers || typeof input.answers !== "object" || Array.isArray(input.answers)) return null;
    const answers: Partial<Record<SmartLingoDailySkill, string>> = {};
    for (const [skill, answer] of Object.entries(input.answers as Record<string, unknown>)) {
      if (!SMARTLINGO_SKILLS.includes(skill as SmartLingoDailySkill) || typeof answer !== "string" || answer.length > MAX_ANSWER_LENGTH) return null;
      answers[skill as SmartLingoDailySkill] = answer;
    }
    draft.answers = answers;
  }
  if (input.quizAnswers !== undefined) {
    const parsed = quizAnswers(input.quizAnswers);
    if (!parsed) return null;
    draft.quizAnswers = parsed;
  }
  if (input.vocabularyMode !== undefined) {
    if (!isVocabularyMode(input.vocabularyMode)) return null;
    draft.vocabularyMode = input.vocabularyMode;
  }
  if (input.vocabularyIndex !== undefined) {
    if (!Number.isInteger(input.vocabularyIndex) || Number(input.vocabularyIndex) < 0 || Number(input.vocabularyIndex) > 50) return null;
    draft.vocabularyIndex = Number(input.vocabularyIndex);
  }
  return JSON.stringify(draft).length <= 12_000 ? draft : null;
}

function publicCheckpoint(row: DailyCheckpointRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    courseDay: Number(row.courseDay),
    localDate: row.localDate,
    timeZone: row.timeZone,
    contentVersion: row.contentVersion,
    plan: parseJsonRecord(row.planJson),
    drafts: checkpointDraft(parseJsonRecord(row.draftJson)) ?? {},
    activeStep: isCheckpointStep(row.activeStep) ? row.activeStep : "vocabulary",
    revision: Number(row.revision),
    updatedAt: Number(row.updatedAt),
  };
}

function checkpointPlan(row: DailyCheckpointRow | null, fallback: DailyLearningSession): DailyLearningSession {
  const parsed = parseJsonRecord(row?.planJson);
  if (parsed.totalMinutes !== 60 || !Array.isArray(parsed.blocks)
    || typeof parsed.id !== "string" || typeof parsed.date !== "string"
    || typeof parsed.contentVersion !== "string") return fallback;
  return parsed as unknown as DailyLearningSession;
}

async function dailyCheckpoint(database: LearningDatabase, enrollmentId: string, courseDay: number) {
  return database.prepare(`SELECT id, enrollment_id AS enrollmentId, user_id AS userId,
    class_id AS classId, course_day AS courseDay,
    local_date AS localDate, time_zone AS timeZone, content_version AS contentVersion,
    plan_json AS planJson, draft_json AS draftJson, active_step AS activeStep,
    revision, updated_at AS updatedAt
    FROM smartlingo_daily_session_checkpoints
    WHERE enrollment_id = ? AND course_day = ? LIMIT 1`)
    .bind(enrollmentId, courseDay).first<DailyCheckpointRow>();
}

async function dailyCheckpointById(database: LearningDatabase, checkpointId: string) {
  return database.prepare(`SELECT id, enrollment_id AS enrollmentId, user_id AS userId,
    class_id AS classId, course_day AS courseDay,
    local_date AS localDate, time_zone AS timeZone, content_version AS contentVersion,
    plan_json AS planJson, draft_json AS draftJson, active_step AS activeStep,
    revision, updated_at AS updatedAt
    FROM smartlingo_daily_session_checkpoints WHERE id = ? LIMIT 1`)
    .bind(checkpointId).first<DailyCheckpointRow>();
}

async function dailySyncReceipt(database: LearningDatabase, clientOperationId: string) {
  return database.prepare(`SELECT id, checkpoint_id AS checkpointId, user_id AS userId,
    request_fingerprint AS requestFingerprint
    FROM smartlingo_daily_sync_operations WHERE id = ? LIMIT 1`)
    .bind(clientOperationId).first<DailySyncReceiptRow>();
}

async function checkpointRevision(
  database: LearningDatabase,
  checkpointId: string,
  revision: number,
) {
  return database.prepare(`SELECT revision, draft_json AS draftJson, active_step AS activeStep
    FROM smartlingo_daily_checkpoint_revisions
    WHERE checkpoint_id = ? AND revision = ? LIMIT 1`)
    .bind(checkpointId, revision).first<DailyCheckpointRevisionRow>();
}

function mergeCheckpointStep(base: CheckpointStep, server: CheckpointStep, client: CheckpointStep) {
  if (client === base) return { value: server, conflict: false } as const;
  if (server === base || client === server) return { value: client, conflict: false } as const;
  return { value: server, conflict: true } as const;
}

async function composeServerDailyPlan(
  database: LearningDatabase,
  userId: string,
  access: OfficialClassAccess,
  placement: CompletedPlacementRow,
  date: string,
): Promise<{ plan: DailyLearningSession; preferredDailyMinutes: number; currentStageId: string | null; currentUnitId: string | null }> {
  const planRow = await database.prepare(`SELECT use_case AS useCase, daily_minutes AS dailyMinutes,
    current_stage_id AS currentStageId, current_unit_id AS currentUnitId
    FROM smartlingo_learning_plans
    WHERE user_id = ? AND path_id = ? AND is_active = 1 LIMIT 1`)
    .bind(userId, access.pathId).first<LearningPlanRow>();
  const since = Math.floor(Date.now() / 1000) - 30 * 86_400;
  const recentResult = await database.prepare(`SELECT domain, ROUND(AVG(score)) AS score
    FROM smartlingo_learning_activity_events
    WHERE user_id = ? AND class_id = ? AND score IS NOT NULL AND created_at >= ?
      AND domain IN ('vocabulary','reading','writing','listening','dialogue')
    GROUP BY domain`).bind(userId, access.classId, since)
    .run<{ domain: SmartLingoDailySkill; score: number }>();
  const observedScores = new Map((recentResult.results || []).map(row => [row.domain, Number(row.score)]));
  const placementScores: Record<SmartLingoDailySkill, number | null> = {
    vocabulary: placement.vocabularyScore,
    reading: placement.readingScore,
    writing: placement.writingScore,
    listening: placement.listeningScore,
    dialogue: placement.dialogueScore,
  };
  const recentScores = Object.fromEntries(SMARTLINGO_SKILLS.map(skill => [
    skill,
    observedScores.get(skill) ?? placementScores[skill] ?? placement.overallScore ?? 50,
  ])) as Record<SmartLingoDailySkill, number>;
  const now = Math.floor(Date.now() / 1000);
  const due = await database.prepare(`SELECT COUNT(*) AS count
    FROM smartlingo_vocabulary_progress
    WHERE user_id = ? AND path_id = ? AND status IN ('learning','review')
      AND due_at IS NOT NULL AND due_at <= ?`).bind(userId, access.pathId, now).first<{ count: number }>();
  const preferredDailyMinutes = [5, 10, 15, 20].includes(Number(planRow?.dailyMinutes))
    ? Number(planRow?.dailyMinutes)
    : 15;
  return {
    plan: composeDailyLearningSession({
      minutes: 60,
      useCase: planRow?.useCase || "daily_life",
      stage: planRow?.currentStageId || placementLevel(placement.recommendedLevel),
      recentScores,
      dueVocabularyCount: Math.max(0, Number(due?.count || 0)),
      language: access.targetLanguage,
      date,
      contentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
    }),
    preferredDailyMinutes,
    currentStageId: planRow?.currentStageId ?? null,
    currentUnitId: planRow?.currentUnitId ?? null,
  };
}

async function ensureDailyCheckpoint(input: {
  database: LearningDatabase;
  userId: string;
  classId: string;
  enrollmentId: string;
  courseDay: number;
  date: string;
  timeZone: string;
  plan: DailyLearningSession;
}) {
  const now = Math.floor(Date.now() / 1000);
  await input.database.prepare(`INSERT OR IGNORE INTO smartlingo_daily_session_checkpoints
    (id, enrollment_id, user_id, class_id, course_day, local_date, time_zone,
     content_version, plan_json, draft_json, active_step, revision, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 'vocabulary', 1, ?, ?)`)
    .bind(createId(), input.enrollmentId, input.userId, input.classId, input.courseDay,
      input.date, input.timeZone, input.plan.contentVersion, JSON.stringify(input.plan), now, now).run();
  return dailyCheckpoint(input.database, input.enrollmentId, input.courseDay);
}

async function ensureLearningStreakAuthority(
  database: LearningDatabase,
  userId: string,
  proposedTimeZone: string,
) {
  const now = Math.floor(Date.now() / 1000);
  await database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_streaks
    (user_id, time_zone, current_streak, longest_streak, last_qualified_date,
     repaired_date, repair_window_started_date, repair_credits, revision, updated_at)
    VALUES (?, ?, 0, 0, NULL, NULL, NULL, 1, 0, ?)`)
    .bind(userId, safeTimeZone(proposedTimeZone), now).run();
  const authority = await database.prepare(`SELECT time_zone AS timeZone
    FROM smartlingo_learning_streaks WHERE user_id = ? LIMIT 1`).bind(userId)
    .first<{ timeZone: string }>();
  return safeTimeZone(authority?.timeZone ?? proposedTimeZone);
}

async function readLearningMotivation(database: LearningDatabase, userId: string) {
  const authority = await database.prepare(`SELECT time_zone AS timeZone
    FROM smartlingo_learning_streaks WHERE user_id = ? LIMIT 1`).bind(userId)
    .first<{ timeZone: string }>();
  const timeZone = safeTimeZone(authority?.timeZone ?? "UTC");
  const today = localDateKey(Math.floor(Date.now() / 1000), timeZone);
  const [xp, datesResult] = await Promise.all([
    database.prepare(`SELECT COALESCE(SUM(xp), 0) AS totalXp,
      COALESCE(SUM(CASE WHEN local_date = ? THEN xp ELSE 0 END), 0) AS todayXp
      FROM smartlingo_learning_xp_ledger WHERE user_id = ?`)
      .bind(today, userId).first<{ totalXp: number; todayXp: number }>(),
    database.prepare(`SELECT DISTINCT local_date AS localDate
      FROM smartlingo_learning_xp_ledger WHERE user_id = ? ORDER BY local_date`)
      .bind(userId).run<{ localDate: string }>(),
  ]);
  const dates = (datesResult.results || []).map(row => row.localDate);
  const streak = calculateLearningStreak(dates, today);
  return {
    todayXp: Number(xp?.todayXp || 0),
    totalXp: Number(xp?.totalXp || 0),
    currentStreak: streak.current,
    longestStreak: streak.longest,
    repairedDate: streak.repairedDates.at(-1) ?? null,
    lastQualifiedDate: dates.at(-1) ?? null,
    timeZone: authority ? timeZone : null,
    notice: {
      zh: "学习经验值只用于显示练习进度，不具现金价值，也不是介绍人奖励积分。连续学习按保存活动时的学习者本地日期计算，每滚动 30 天最多自动修复一个单日空档。",
      en: "Learning XP only reflects practice progress; it has no cash value and is not introducer reward credit. Streaks use the learner-local date saved with each activity and repair at most one single-day gap per rolling 30 days.",
    },
  };
}

async function reconcileLearningStreak(database: LearningDatabase, userId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await database.prepare(`SELECT time_zone AS timeZone, revision,
      last_qualified_date AS lastQualifiedDate
      FROM smartlingo_learning_streaks WHERE user_id = ? LIMIT 1`).bind(userId)
      .first<{ timeZone: string; revision: number; lastQualifiedDate: string | null }>();
    if (!row) return false;
    const datesResult = await database.prepare(`SELECT DISTINCT local_date AS localDate
      FROM smartlingo_learning_xp_ledger WHERE user_id = ? ORDER BY local_date`)
      .bind(userId).run<{ localDate: string }>();
    const dates = (datesResult.results || []).map(item => item.localDate);
    const now = Math.floor(Date.now() / 1000);
    const currentLocalDate = localDateKey(now, safeTimeZone(row.timeZone));
    const maxLedgerDate = dates.at(-1) ?? currentLocalDate;
    const asOfDate = [currentLocalDate, maxLedgerDate, row.lastQualifiedDate ?? currentLocalDate]
      .sort().at(-1)!;
    const streak = calculateLearningStreak(dates, asOfDate);
    const repairedDate = streak.repairedDates.at(-1) ?? null;
    const repairInstant = repairedDate ? new Date(`${repairedDate}T00:00:00.000Z`) : null;
    const daysSinceRepair = repairInstant
      ? Math.floor((new Date(`${asOfDate}T00:00:00.000Z`).getTime() - repairInstant.getTime()) / 86_400_000)
      : null;
    if (repairInstant) repairInstant.setUTCDate(repairInstant.getUTCDate() - 29);
    const windowStarted = repairInstant?.toISOString().slice(0, 10) ?? null;
    const updated = await database.prepare(`UPDATE smartlingo_learning_streaks SET
      current_streak = ?, longest_streak = MAX(longest_streak, ?),
      last_qualified_date = ?, repaired_date = ?, repair_window_started_date = ?,
      repair_credits = ?, revision = revision + 1, updated_at = ?
      WHERE user_id = ? AND revision = ? AND time_zone = ? RETURNING revision`)
      .bind(streak.current, streak.longest, dates.at(-1) ?? null, repairedDate, windowStarted,
        daysSinceRepair !== null && daysSinceRepair < 30 ? 0 : 1, now,
        userId, row.revision, row.timeZone).first<{ revision: number }>();
    if (updated) return true;
  }
  throw new Error("SMARTLINGO_STREAK_RECONCILIATION_BUSY");
}

async function awardLearningXp(input: {
  database: LearningDatabase;
  userId: string;
  classId: string;
  activityEventId: string | null | undefined;
  skipped?: boolean;
  reason: "daily_practice" | "vocabulary_review" | "daily_quiz" | "pronunciation_review";
  timeZone: string;
}) {
  if (!input.activityEventId) return false;
  const activity = await input.database.prepare(`SELECT created_at AS createdAt, score
    FROM smartlingo_learning_activity_events
    WHERE id = ? AND user_id = ? AND class_id = ? LIMIT 1`)
    .bind(input.activityEventId, input.userId, input.classId).first<{ createdAt: number; score: number | null }>();
  if (!activity) return false;
  const award = calculateLearningXp({ serverScore: activity.score, skipped: input.skipped });
  if (!award.eligible || award.xp < 1) return false;
  const now = Math.floor(Date.now() / 1000);
  const authoritativeTimeZone = await ensureLearningStreakAuthority(
    input.database,
    input.userId,
    input.timeZone,
  );
  const authoritativeDate = localDateKey(Number(activity.createdAt), authoritativeTimeZone);
  const inserted = await input.database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_xp_ledger
    (id, user_id, class_id, activity_event_id, xp, reason, local_date, time_zone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(createId(), input.userId, input.classId, input.activityEventId, award.xp,
      input.reason, authoritativeDate, authoritativeTimeZone, now).first<{ id: string }>();
  await reconcileLearningStreak(input.database, input.userId);
  return Boolean(inserted);
}

async function existingLearningActivityId(
  database: LearningDatabase,
  userId: string,
  sourceType: string,
  sourceId: string,
) {
  return database.prepare(`SELECT id FROM smartlingo_learning_activity_events
    WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1`)
    .bind(userId, sourceType, sourceId).first<{ id: string }>();
}

function certificateIdentity() {
  const token = crypto.randomUUID().replaceAll("-", "").toUpperCase();
  const year = new Date().getUTCFullYear();
  return {
    id: crypto.randomUUID(),
    certificateNumber: `SL-${year}-${token.slice(0, 10)}`,
    verificationCode: token.slice(10, 26),
  };
}

async function readQuickCourseProgress(
  database: LearningDatabase,
  userId: string,
  access: OfficialClassAccess,
) {
  const enrollment = await database.prepare(`SELECT e.id, e.offering_id AS offeringId,
    offering.duration_days AS durationDays, offering.level, e.start_day AS startDay,
    e.current_day AS currentDay, e.started_at AS startedAt, e.status
    FROM smartlingo_course_enrollments_v3 e
    JOIN smartlingo_course_offerings_v3 offering ON offering.id = e.offering_id
    WHERE e.user_id = ? AND e.class_id = ? AND e.status IN ('active','completed')
    ORDER BY e.updated_at DESC LIMIT 1`).bind(userId, access.classId).first<QuickEnrollmentRow>();
  if (!enrollment || !isCourseLevel(enrollment.level)
    || !isCourseDuration(enrollment.level, enrollment.durationDays)
    || !isLearningLanguage(access.targetLanguage)) return null;
  const course = buildQuickCourse(access.targetLanguage, enrollment.durationDays as SmartLingoCourseDays, enrollment.level);
  const courseDay = Math.max(1, Math.min(course.days, Number(enrollment.currentDay || 1)));
  const day = await database.prepare(`SELECT course_day AS courseDay, last_activity_date AS localDate,
    score, is_complete AS isComplete, started_at AS startedAt
    FROM smartlingo_course_day_progress_v2
    WHERE enrollment_id = ? AND course_day = ? LIMIT 1`)
    .bind(enrollment.id, courseDay).first<CourseDailyScoreRow>();
  const completedRows = await database.prepare(`SELECT course_day AS courseDay,
    last_activity_date AS localDate, score, is_complete AS isComplete
    FROM smartlingo_course_day_progress_v2
    WHERE enrollment_id = ? AND is_complete = 1 ORDER BY course_day`)
    .bind(enrollment.id).run<CourseDailyScoreRow>();
  const outcome = calculateCourseOutcome({
    durationDays: course.days - enrollment.startDay + 1,
    completedDayScores: (completedRows.results || []).map(row => Number(row.score)),
  });
  const certificate = await database.prepare(`SELECT id, certificate_number AS certificateNumber,
    final_score AS finalScore, issued_at AS issuedAt
    FROM smartlingo_course_certificates_v2 WHERE enrollment_id = ? LIMIT 1`)
    .bind(enrollment.id).first<CourseCertificateRow>();
  return {
    enrollmentId: enrollment.id,
    courseDay,
    durationDays: course.days,
    dailyScore: day ? Number(day.score) : null,
    dailyComplete: Boolean(day?.isComplete),
    requiredSkills: SMARTLINGO_SKILLS,
    completedDays: outcome.completedDays,
    currentScore: outcome.currentScore,
    passScore: outcome.passScore,
    earlyMasteryScore: outcome.earlyMasteryScore,
    passed: outcome.passed,
    completionReason: outcome.completionReason,
    certificate,
  };
}

async function refreshQuickCourseProgress(
  database: LearningDatabase,
  userId: string,
  access: OfficialClassAccess,
  date: string,
) {
  const enrollment = await database.prepare(`SELECT e.id, e.offering_id AS offeringId,
    offering.duration_days AS durationDays, offering.level, e.start_day AS startDay,
    e.current_day AS currentDay,
    e.started_at AS startedAt, e.status
    FROM smartlingo_course_enrollments_v3 e
    JOIN smartlingo_course_offerings_v3 offering ON offering.id = e.offering_id
    WHERE e.user_id = ? AND e.class_id = ? AND e.status IN ('active','completed')
    ORDER BY e.updated_at DESC LIMIT 1`).bind(userId, access.classId).first<QuickEnrollmentRow>();
  if (!enrollment || !isCourseLevel(enrollment.level)
    || !isCourseDuration(enrollment.level, enrollment.durationDays)
    || !isLearningLanguage(access.targetLanguage)) return null;

  const course = buildQuickCourse(access.targetLanguage, enrollment.durationDays as SmartLingoCourseDays, enrollment.level);
  const existingDay = await database.prepare(`SELECT course_day AS courseDay,
    last_activity_date AS localDate, score, is_complete AS isComplete, started_at AS startedAt
    FROM smartlingo_course_day_progress_v2
    WHERE enrollment_id = ? AND course_day = ? LIMIT 1`)
    .bind(enrollment.id, enrollment.currentDay).first<CourseDailyScoreRow>();
  const courseDay = Math.max(1, Math.min(course.days, Number(existingDay?.courseDay || enrollment.currentDay || 1)));
  const now = Math.floor(Date.now() / 1000);
  const progressStartedAt = Number(existingDay?.startedAt || now);
  if (!existingDay) {
    await database.prepare(`INSERT INTO smartlingo_course_day_progress_v2
      (id, enrollment_id, user_id, class_id, course_day, started_date, last_activity_date,
       score, skill_scores, is_complete, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, '{}', 0, ?, ?)`)
      .bind(createId(), enrollment.id, userId, access.classId, courseDay, date, date, now, now).run();
  }
  const eventScores = await database.prepare(`SELECT domain, ROUND(AVG(score)) AS score
    FROM smartlingo_learning_activity_events
    WHERE user_id = ? AND class_id = ? AND score IS NOT NULL AND created_at >= ?
      AND source_type IN ('daily_practice','vocabulary_review','daily_quiz')
    GROUP BY domain`)
    .bind(userId, access.classId, progressStartedAt)
    .run<{ domain: SmartLingoLearningLanguage | (typeof SMARTLINGO_SKILLS)[number]; score: number }>();
  const skillScores = Object.fromEntries((eventScores.results || []).map(row => [row.domain, Number(row.score)]));
  const quiz = await database.prepare(`SELECT score FROM smartlingo_daily_quiz_attempts
    WHERE user_id = ? AND class_id = ? AND created_at >= ? ORDER BY score DESC, created_at DESC LIMIT 1`)
    .bind(userId, access.classId, progressStartedAt).first<{ score: number }>();
  const daily = calculateCourseDailyScore({
    requiredSkills: SMARTLINGO_SKILLS,
    skillScores,
    quizScore: quiz?.score,
  });
  const timer = await database.prepare(`SELECT remaining_seconds AS remainingSeconds, status,
    last_started_at AS lastStartedAt FROM smartlingo_course_session_state
    WHERE enrollment_id = ? LIMIT 1`).bind(enrollment.id)
    .first<{ remainingSeconds: number; status: string; lastStartedAt: number | null }>();
  const timerRemaining = timer?.status === "running" && timer.lastStartedAt
    ? Math.max(0, Number(timer.remainingSeconds) - Math.max(0, now - Number(timer.lastStartedAt)))
    : Number(timer?.remainingSeconds ?? 3600);
  const dailyComplete = daily.complete && (timer?.status === "completed" || timerRemaining === 0);
  if (daily.score !== null) {
    await database.prepare(`UPDATE smartlingo_course_day_progress_v2 SET
        score = ?, skill_scores = ?, quiz_score = ?, is_complete = ?,
        last_activity_date = ?,
        completed_at = CASE WHEN ? = 1 THEN ? ELSE completed_at END,
        updated_at = ?
      WHERE enrollment_id = ? AND course_day = ?`)
      .bind(
        daily.score, JSON.stringify(skillScores), quiz?.score ?? null, dailyComplete ? 1 : 0,
        date, dailyComplete ? 1 : 0, dailyComplete ? now : null, now, enrollment.id, courseDay,
      ).run();
  }

  const completedRows = await database.prepare(`SELECT course_day AS courseDay,
    last_activity_date AS localDate, score, is_complete AS isComplete
    FROM smartlingo_course_day_progress_v2
    WHERE enrollment_id = ? AND is_complete = 1 ORDER BY course_day`)
    .bind(enrollment.id).run<CourseDailyScoreRow>();
  const outcome = calculateCourseOutcome({
    durationDays: course.days - enrollment.startDay + 1,
    completedDayScores: (completedRows.results || []).map(row => Number(row.score)),
  });
  let certificate = await database.prepare(`SELECT id, certificate_number AS certificateNumber,
    final_score AS finalScore, issued_at AS issuedAt
    FROM smartlingo_course_certificates_v2 WHERE enrollment_id = ? LIMIT 1`)
    .bind(enrollment.id).first<CourseCertificateRow>();

  if (outcome.passed && !certificate) {
    const identity = certificateIdentity();
    const member = await database.prepare("SELECT display_name AS displayName FROM users WHERE id = ? LIMIT 1")
      .bind(userId).first<{ displayName: string }>();
    await database.prepare(`INSERT OR IGNORE INTO smartlingo_course_certificates_v2
      (id, certificate_number, verification_code, enrollment_id, offering_id,
       user_id, class_id, member_name, course_title_zh, course_title_en,
       target_language, level, duration_days, start_day, completed_days, final_score,
       pass_score, completion_reason, curriculum_version, issued_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 60, ?, ?, ?, ?)`)
      .bind(
        identity.id, identity.certificateNumber, identity.verificationCode,
        enrollment.id, enrollment.offeringId, userId, access.classId,
        member?.displayName || "SmartLingo Learner", course.title.zh, course.title.en,
        access.targetLanguage, course.level, course.days, enrollment.startDay, outcome.completedDays, outcome.currentScore,
        outcome.completionReason, course.curriculumVersion, now, now,
      ).run();
    await database.prepare(`UPDATE smartlingo_course_enrollments_v3
      SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ? AND status = 'active'`)
      .bind(now, now, enrollment.id).run();
    certificate = await database.prepare(`SELECT id, certificate_number AS certificateNumber,
      final_score AS finalScore, issued_at AS issuedAt
      FROM smartlingo_course_certificates_v2 WHERE enrollment_id = ? LIMIT 1`)
      .bind(enrollment.id).first<CourseCertificateRow>();
  } else if (dailyComplete && !existingDay?.isComplete && courseDay < course.days && enrollment.status === "active") {
    await database.prepare(`UPDATE smartlingo_course_enrollments_v3
      SET current_day = ?, updated_at = ? WHERE id = ? AND current_day = ? AND status = 'active'`)
      .bind(courseDay + 1, now, enrollment.id, courseDay).run();
    await database.prepare(`UPDATE smartlingo_course_session_state
      SET course_day = ?, remaining_seconds = 3600, status = 'ready', last_started_at = NULL, updated_at = ?
      WHERE enrollment_id = ?`).bind(courseDay + 1, now, enrollment.id).run();
  }

  return {
    enrollmentId: enrollment.id,
    courseDay,
    durationDays: course.days,
    dailyScore: daily.score,
    dailyComplete,
    requiredSkills: SMARTLINGO_SKILLS,
    completedDays: outcome.completedDays,
    currentScore: outcome.currentScore,
    passScore: outcome.passScore,
    earlyMasteryScore: outcome.earlyMasteryScore,
    passed: outcome.passed,
    completionReason: outcome.completionReason,
    certificate,
  };
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

function fixedCoursePlacement(access: OfficialClassAccess): CompletedPlacementRow {
  const recommendedLevel: SmartLingoLevel = access.packageTier === "advanced"
    ? "advanced"
    : access.packageTier === "intermediate"
      ? "intermediate"
      : "beginner";
  return {
    id: `fixed-level:${access.classId}`,
    status: "completed",
    entryMode: "fixed_course",
    overallScore: null,
    recommendedLevel,
    vocabularyScore: null,
    readingScore: null,
    writingScore: null,
    listeningScore: null,
    dialogueScore: null,
    completedAt: null,
  };
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
    lapse_count AS lapseCount, last_score AS lastScore, is_focused AS isFocused,
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
    isFocused: Boolean(row.isFocused),
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
    isFocused: false,
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
  refreshProgress = false,
) {
  const courseProgress = refreshProgress
    ? await refreshQuickCourseProgress(database, userId, access, date)
    : await readQuickCourseProgress(database, userId, access);
  const targetLanguage = access.targetLanguage as SmartLingoLearningLanguage;
  const level = placementLevel(placement.recommendedLevel);
  const quickEnrollment = await database.prepare(`SELECT e.id, e.offering_id AS offeringId,
    offering.duration_days AS durationDays, offering.level, e.start_day AS startDay,
    e.current_day AS currentDay,
    e.started_at AS startedAt, e.status
    FROM smartlingo_course_enrollments_v3 e
    JOIN smartlingo_course_offerings_v3 offering ON offering.id = e.offering_id
    WHERE e.user_id = ? AND e.class_id = ? AND e.status IN ('active','completed')
    ORDER BY e.updated_at DESC LIMIT 1`).bind(userId, access.classId).first<QuickEnrollmentRow>();
  const quickCourse = quickEnrollment && isCourseLevel(quickEnrollment.level)
    && isCourseDuration(quickEnrollment.level, quickEnrollment.durationDays)
    ? buildQuickCourse(targetLanguage, quickEnrollment.durationDays as SmartLingoCourseDays, quickEnrollment.level)
    : null;
  const courseDay = quickCourse
    ? quickCourse.schedule[Math.max(1, Math.min(
      quickCourse.days,
      courseProgress?.courseDay ?? quickEnrollment?.currentDay ?? 1,
    )) - 1]
    : null;
  const dailyLoop = await composeServerDailyPlan(database, userId, access, placement, date);
  const checkpointRow = quickEnrollment
    ? await dailyCheckpoint(database, quickEnrollment.id, courseDay?.day ?? quickEnrollment.currentDay)
    : null;
  const authoritativeDailyPlan = checkpointPlan(checkpointRow, dailyLoop.plan);
  const sessionDate = authoritativeDailyPlan.date;
  const feedbackResult = checkpointRow ? await database.prepare(`SELECT task_id AS taskId, skill,
    answer_text AS answerText, score, correct, skipped,
    explanation_zh AS explanationZh, explanation_en AS explanationEn,
    hint_zh AS hintZh, hint_en AS hintEn, content_version AS contentVersion,
    created_at AS createdAt
    FROM smartlingo_daily_answer_feedback WHERE checkpoint_id = ?
    ORDER BY created_at DESC`).bind(checkpointRow.id).run<DailyFeedbackRow>() : { results: [] as DailyFeedbackRow[] };
  const feedbackByTask = new Map((feedbackResult.results || []).map(row => [row.taskId, {
    skill: row.skill,
    correctness: row.skipped ? "skipped" : row.correct ? "correct" : Number(row.score) >= 40 ? "partially_correct" : "incorrect",
    score: row.score,
    explanation: { zh: row.explanationZh, en: row.explanationEn },
    hint: { zh: row.hintZh, en: row.hintEn },
    disclaimer: {
      zh: "这是人工智能生成的练习反馈，不是真人教师评价，也不是正式或官方考试结果。",
      en: "This artificial-intelligence practice feedback is not a human teacher evaluation or a formal or official exam result.",
    },
    contentVersion: row.contentVersion,
  }]));
  const vocabularyDay = courseDay
    ? ((courseDay.day - 1) % 7) + 1
    : ((Number(sessionDate.slice(-2)) - 1) % 7) + 1;
  const vocabularySamples = level === "beginner"
    ? getBeginnerSessionVocabularyDeck(targetLanguage, vocabularyDay)
    : [getVocabularySample(targetLanguage, level)];
  const vocabularyProgressRows = await Promise.all(vocabularySamples.map(sample =>
    vocabularyProgress(database, userId, access.pathId, sample.stableId, sample.version)));
  const focusResult = await database.prepare(`SELECT word_key AS wordKey, word_version AS wordVersion,
    is_focused AS isFocused, lapse_count AS lapseCount, last_score AS lastScore,
    status, due_at AS dueAt
    FROM smartlingo_vocabulary_progress
    WHERE user_id = ? AND path_id = ?
      AND (is_focused = 1 OR lapse_count > 0 OR (last_score IS NOT NULL AND last_score < 60))
      AND status != 'suspended'
    ORDER BY is_focused DESC, lapse_count DESC, updated_at DESC LIMIT 12`)
    .bind(userId, access.pathId).run<{
      wordKey: string; wordVersion: string; isFocused: number; lapseCount: number;
      lastScore: number | null; status: string; dueAt: number | null;
    }>();
  const vocabularyFocusPack = (focusResult.results || []).flatMap(row => {
    const focusSample = getVocabularySampleById(targetLanguage, row.wordKey);
    if (!focusSample || focusSample.version !== row.wordVersion) return [];
    return [{
      sampleId: focusSample.stableId,
      form: focusSample.form,
      pronunciation: focusSample.pronunciation,
      meaning: focusSample.meaning,
      topic: focusSample.topic,
      reason: row.isFocused ? "saved" as const : "repeated_error" as const,
      lapseCount: Number(row.lapseCount || 0),
      dueAt: row.dueAt,
    }];
  });
  const selectedIndex = vocabularyProgressRows.findIndex(row => row?.status !== "mastered" && row?.status !== "suspended");
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const sample = vocabularySamples[activeIndex];
  const progress = vocabularyProgressRows[activeIndex];
  const state = reviewState(sample.stableId, progress, Date.now());
  const nextMode = requestedMode ?? selectNextVocabularyReviewMode(state);
  const dailyTasks = SMARTLINGO_SKILLS.map(skill => ({
    ...buildDailyPracticeItem(targetLanguage, skill, sessionDate, uiLanguage, level),
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
      feedback: feedbackByTask.get(task.taskId) ?? null,
    };
  });
  const localizedMeaning = sample.meaning[uiLanguage];
  const localizedExampleTranslation = sample.exampleTranslation[uiLanguage];
  const vocabularyDeck = vocabularySamples.map((deckSample, index) => {
    const deckProgress = vocabularyProgressRows[index];
    const deckState = reviewState(deckSample.stableId, deckProgress, Date.now());
    return {
      taskId: deckSample.stableId,
      sampleId: deckSample.stableId,
      stableId: deckSample.stableId,
      word: deckSample.form,
      form: deckSample.form,
      pronunciation: deckSample.pronunciation,
      meaning: deckSample.meaning,
      visualCue: getVocabularyVisualCue(deckSample),
      example: deckSample.example,
      exampleTranslation: deckSample.exampleTranslation,
      level: deckSample.level,
      topic: deckSample.topic,
      sourceType: deckSample.sourceType,
      humanReviewStatus: deckSample.humanReviewStatus,
      audioText: deckSample.form,
      speechLocale: SPEECH_LOCALES[targetLanguage],
      direction: targetLanguage === "ar" ? "rtl" as const : "ltr" as const,
      mode: requestedMode ?? selectNextVocabularyReviewMode(deckState),
      status: deckProgress?.status ?? "new",
      progress: publicProgress(deckProgress),
    };
  });
  const sessionMinutes = 60 as SmartLingoSessionMinutes;
  const sessionRow = quickEnrollment ? await database.prepare(`SELECT course_day AS courseDay,
    duration_seconds AS durationSeconds, remaining_seconds AS remainingSeconds,
    status, last_started_at AS lastStartedAt, updated_at AS updatedAt
    FROM smartlingo_course_session_state WHERE enrollment_id = ? LIMIT 1`)
    .bind(quickEnrollment.id).first<{
      courseDay: number; durationSeconds: number; remainingSeconds: number;
      status: "ready" | "running" | "paused" | "completed"; lastStartedAt: number | null; updatedAt: number;
    }>() : null;
  const currentEpoch = Math.floor(Date.now() / 1000);
  const effectiveRemaining = sessionRow?.status === "running" && sessionRow.lastStartedAt
    ? Math.max(0, Number(sessionRow.remainingSeconds) - Math.max(0, currentEpoch - Number(sessionRow.lastStartedAt)))
    : Number(sessionRow?.remainingSeconds ?? 3600);
  const latestQuiz = await database.prepare(`SELECT attempt_number AS attemptNumber, score,
    correct_count AS correctCount, question_count AS questionCount, created_at AS createdAt
    FROM smartlingo_daily_quiz_attempts
    WHERE user_id = ? AND class_id = ? AND local_date = ?
    ORDER BY attempt_number DESC LIMIT 1`).bind(userId, access.classId, sessionDate).first<DailyQuizRow>();
  const motivation = await readLearningMotivation(database, userId);

  return {
    class: {
      id: access.classId,
      title: access.title,
      targetLanguage: access.targetLanguage,
      classKind: "official_language" as const,
    },
    date: sessionDate,
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
      level: quickCourse.level,
      startDay: quickEnrollment!.startDay,
      currentDay: courseDay.day,
      scene: courseDay.scene,
      skills: SMARTLINGO_SKILLS,
      focusSkills: courseDay.skills,
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
    vocabularyDeck,
    vocabularyFocusPack,
    vocabularyDeckMeta: {
      day: vocabularyDay,
      total: vocabularyDeck.length,
      activeIndex,
      scene: courseDay?.scene ?? null,
    },
    sessionPreference: { minutes: sessionMinutes },
    sessionState: quickEnrollment ? {
      enrollmentId: quickEnrollment.id,
      courseDay: sessionRow?.courseDay ?? quickEnrollment.currentDay,
      durationSeconds: 3600,
      remainingSeconds: effectiveRemaining,
      status: effectiveRemaining === 0 ? "completed" : sessionRow?.status ?? "ready",
    } : null,
    teachingPlan: buildDailyTeachingPlan(sessionMinutes),
    dailySessionPlan: authoritativeDailyPlan,
    preferredDailyMinutes: dailyLoop.preferredDailyMinutes,
    learningPlanPosition: {
      currentStageId: dailyLoop.currentStageId,
      currentUnitId: dailyLoop.currentUnitId,
    },
    checkpoint: publicCheckpoint(checkpointRow),
    motivation,
    dailyQuiz: {
      contentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
      questions: buildDailyVocabularyQuiz(targetLanguage, vocabularyDay, sessionDate, uiLanguage).map((question, index) => ({
        ...question,
        prompt: index === 0
          ? (uiLanguage === "zh" ? "看图后，用所学语言回答。" : "Study the image and answer in the language you are learning.")
          : question.prompt,
        pronunciation: index === 0 ? "" : question.pronunciation,
        imageUrl: index === 0
          ? `/api/classes/${encodeURIComponent(access.classId)}/learning/quiz-image?date=${encodeURIComponent(sessionDate)}&day=${vocabularyDay}&questionId=${encodeURIComponent(question.id)}&lang=${uiLanguage}`
          : undefined,
      })),
    },
    dailyQuizStatus: latestQuiz ? {
      attemptNumber: Number(latestQuiz.attemptNumber),
      score: Number(latestQuiz.score),
      correctCount: Number(latestQuiz.correctCount),
      questionCount: Number(latestQuiz.questionCount),
      createdAt: Number(latestQuiz.createdAt),
    } : null,
    courseProgress,
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
  const placement = access.classKind === "official_course"
    ? fixedCoursePlacement(access)
    : await completedPlacement(database, user.id, classId);
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
  const storedZone = await auth.database.prepare(`SELECT time_zone AS timeZone
    FROM smartlingo_learning_streaks WHERE user_id = ? LIMIT 1`).bind(auth.user.id)
    .first<{ timeZone: string }>();
  const timeZone = safeTimeZone(storedZone?.timeZone ?? url.searchParams.get("timeZone"));
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
  const storedZone = await auth.database.prepare(`SELECT time_zone AS timeZone
    FROM smartlingo_learning_streaks WHERE user_id = ? LIMIT 1`).bind(auth.user.id)
    .first<{ timeZone: string }>();
  const timeZone = safeTimeZone(storedZone?.timeZone ?? (typeof body.timeZone === "string" ? body.timeZone : null));
  const today = localDateKey(Math.floor(Date.now() / 1000), timeZone);
  const uiLanguage = interfaceLanguage(body.lang, auth.user.preferredLanguage);
  const rawAction = typeof body.action === "string" ? body.action : "";
  const action = rawAction === "review_vocabulary" ? "vocabulary_review"
    : rawAction === "complete_practice" ? (body.skipped ? "skip_task" : "submit_task")
      : rawAction;

  if (action === "set_session_minutes") {
    return Response.json({ error: "Course-day sessions are fixed at 60 minutes." }, { status: 409 });
  }

  if (action === "save_checkpoint") {
    const clientOperationId = safeIdentifier(body.clientOperationId, 160);
    const baseRevision = Number(body.baseRevision);
    const clientDraft = checkpointDraft(body.draft);
    const activeStep = isCheckpointStep(body.activeStep) ? body.activeStep : null;
    const checkpointIdProvided = body.checkpointId === null || typeof body.checkpointId === "string";
    const intendedCheckpointId = body.checkpointId === null ? null : safeIdentifier(body.checkpointId, 100);
    const intendedEnrollmentId = safeIdentifier(body.enrollmentId, 100);
    const intendedCourseDay = Number(body.courseDay);
    const intendedSessionDate = validDate(body.checkpointDate) ? body.checkpointDate : null;
    const intendedContentVersion = safeIdentifier(body.checkpointContentVersion, 48);
    const validInitialScope = intendedCheckpointId === null ? baseRevision === 0 : baseRevision >= 1;
    if (!clientOperationId || !Number.isInteger(baseRevision) || baseRevision < 0 || !clientDraft || !activeStep
      || !checkpointIdProvided || (body.checkpointId !== null && !intendedCheckpointId)
      || !intendedEnrollmentId || !Number.isInteger(intendedCourseDay)
      || intendedCourseDay < 1 || intendedCourseDay > 365
      || !intendedSessionDate || !intendedContentVersion || !validInitialScope) {
      return Response.json({ error: "A valid checkpoint operation, immutable scope, revision, and draft are required." }, { status: 400 });
    }

    const replayCheckpointReceipt = async (receipt: DailySyncReceiptRow) => {
      const receiptCheckpoint = await dailyCheckpointById(auth.database, receipt.checkpointId);
      const requestFingerprint = await checkpointOperationFingerprint({
        userId: auth.user.id,
        classId: auth.classId,
        actualCheckpointId: receipt.checkpointId,
        intendedCheckpointId,
        enrollmentId: intendedEnrollmentId,
        courseDay: intendedCourseDay,
        sessionDate: intendedSessionDate,
        contentVersion: intendedContentVersion,
        baseRevision,
        draft: clientDraft,
        activeStep,
      });
      if (receipt.userId === auth.user.id && receiptCheckpoint?.userId === auth.user.id
        && receiptCheckpoint.classId === auth.classId
        && receiptCheckpoint.enrollmentId === intendedEnrollmentId
        && receiptCheckpoint.courseDay === intendedCourseDay
        && receiptCheckpoint.localDate === intendedSessionDate
        && receiptCheckpoint.contentVersion === intendedContentVersion
        && (intendedCheckpointId === null || intendedCheckpointId === receiptCheckpoint.id)
        && receipt.requestFingerprint === requestFingerprint) {
        return Response.json({ checkpoint: publicCheckpoint(receiptCheckpoint), idempotent: true });
      }
      return Response.json({
        error: "This checkpoint operation identity was already used for different request evidence.",
        code: "SMARTLINGO_CHECKPOINT_OPERATION_REUSED",
      }, { status: 409 });
    };

    const existingReceipt = await dailySyncReceipt(auth.database, clientOperationId);
    if (existingReceipt) return replayCheckpointReceipt(existingReceipt);

    const state = await learningState(auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage);
    if (!state.sessionState || !state.dailySessionPlan) {
      return Response.json({ error: "An active course enrollment is required for checkpoint sync." }, { status: 409 });
    }
    const enrollmentScope = await auth.database.prepare(`SELECT current_day AS currentDay, status
      FROM smartlingo_course_enrollments_v3
      WHERE id = ? AND user_id = ? AND class_id = ? LIMIT 1`)
      .bind(intendedEnrollmentId, auth.user.id, auth.classId)
      .first<{ currentDay: number; status: string }>();
    const currentScopeMatches = enrollmentScope?.status === "active"
      && Number(enrollmentScope.currentDay) === intendedCourseDay
      && state.sessionState.enrollmentId === intendedEnrollmentId
      && state.sessionState.courseDay === intendedCourseDay
      && state.date === intendedSessionDate
      && state.dailySessionPlan.date === intendedSessionDate
      && state.dailySessionPlan.contentVersion === intendedContentVersion;
    if (!currentScopeMatches) {
      return Response.json({
        error: "This local draft belongs to an earlier course day and was not applied to the current day.",
        code: "SMARTLINGO_CHECKPOINT_SCOPE_STALE",
      }, { status: 409 });
    }
    let row = intendedCheckpointId
      ? await dailyCheckpointById(auth.database, intendedCheckpointId)
      : await ensureDailyCheckpoint({
          database: auth.database,
          userId: auth.user.id,
          classId: auth.classId,
          enrollmentId: intendedEnrollmentId,
          courseDay: intendedCourseDay,
          date: intendedSessionDate,
          timeZone,
          plan: state.dailySessionPlan,
        });
    if (row && (row.userId !== auth.user.id || row.classId !== auth.classId
      || row.enrollmentId !== intendedEnrollmentId || row.courseDay !== intendedCourseDay
      || row.localDate !== intendedSessionDate || row.contentVersion !== intendedContentVersion)) row = null;
    if (!row) return Response.json({ error: "The daily checkpoint could not be created." }, { status: 409 });
    const requestFingerprint = await checkpointOperationFingerprint({
      userId: auth.user.id,
      classId: auth.classId,
      actualCheckpointId: row.id,
      intendedCheckpointId,
      enrollmentId: intendedEnrollmentId,
      courseDay: intendedCourseDay,
      sessionDate: intendedSessionDate,
      contentVersion: intendedContentVersion,
      baseRevision,
      draft: clientDraft,
      activeStep,
    });
    const baseSnapshot = baseRevision === 0
      ? { revision: 0, draftJson: "{}", activeStep: "vocabulary" }
      : await checkpointRevision(auth.database, row.id, baseRevision);
    if (!baseSnapshot || baseRevision > row.revision || !isCheckpointStep(baseSnapshot.activeStep)) {
      return Response.json({
        error: "The server no longer has the requested checkpoint base revision.",
        code: "SMARTLINGO_CHECKPOINT_BASE_UNAVAILABLE",
        checkpoint: publicCheckpoint(row),
      }, { status: 409 });
    }
    const baseDraft = checkpointDraft(parseJsonRecord(baseSnapshot.draftJson)) ?? {};
    for (let casAttempt = 0; casAttempt < 4; casAttempt += 1) {
      const serverDraft = checkpointDraft(parseJsonRecord(row.draftJson)) ?? {};
      const merge = mergeCheckpointDrafts(baseDraft, serverDraft, clientDraft);
      const serverStep = isCheckpointStep(row.activeStep) ? row.activeStep : "vocabulary";
      const stepMerge = mergeCheckpointStep(baseSnapshot.activeStep, serverStep, activeStep);
      const conflicts = [
        ...merge.conflicts,
        ...(stepMerge.conflict ? [{
          field: "activeStep",
          base: baseSnapshot.activeStep,
          server: serverStep,
          client: activeStep,
          basePresent: true,
          serverPresent: true,
          clientPresent: true,
          resolution: "manual_required" as const,
        }] : []),
      ];
      if (conflicts.length) {
        return Response.json({
          error: "This draft changed on another device. Local work was preserved for review.",
          code: "SMARTLINGO_CHECKPOINT_CONFLICT",
          checkpoint: publicCheckpoint(row),
          conflicts,
        }, { status: 409 });
      }
      const mergedDraft = checkpointDraft(merge.merged);
      if (!mergedDraft) return Response.json({ error: "The merged checkpoint draft is invalid." }, { status: 409 });
      const now = Math.floor(Date.now() / 1000);
      const attemptedCheckpointId = row.id;
      try {
        const updated = await auth.database.prepare(`UPDATE smartlingo_daily_session_checkpoints
          SET draft_json = ?, active_step = ?, last_operation_id = ?, last_operation_fingerprint = ?,
            revision = revision + 1, updated_at = ?
          WHERE id = ? AND user_id = ? AND revision = ? RETURNING id`)
          .bind(JSON.stringify(mergedDraft), stepMerge.value, clientOperationId, requestFingerprint,
            now, attemptedCheckpointId, auth.user.id, row.revision).first<{ id: string }>();
        if (updated) {
          row = await dailyCheckpointById(auth.database, attemptedCheckpointId);
          return Response.json({ checkpoint: publicCheckpoint(row), idempotent: false });
        }
      } catch {
        const racedReceipt = await dailySyncReceipt(auth.database, clientOperationId);
        if (racedReceipt) return replayCheckpointReceipt(racedReceipt);
        return Response.json({
          error: "The checkpoint update could not be committed; retry the same operation identity.",
          code: "SMARTLINGO_CHECKPOINT_TRANSACTION_RETRY",
        }, { status: 503 });
      }
      row = await dailyCheckpointById(auth.database, attemptedCheckpointId);
      if (!row) break;
      const racedReceipt = await dailySyncReceipt(auth.database, clientOperationId);
      if (racedReceipt) return replayCheckpointReceipt(racedReceipt);
    }
    return Response.json({
      error: "The checkpoint kept changing while it was being saved; local work remains available.",
      code: "SMARTLINGO_CHECKPOINT_CONFLICT",
      checkpoint: publicCheckpoint(row),
    }, { status: 409 });
  }

  if (["start_session", "resume_session", "pause_session", "checkpoint_session", "complete_session"].includes(action)) {
    const enrollment = await auth.database.prepare(`SELECT e.id, e.current_day AS currentDay
      FROM smartlingo_course_enrollments_v3 e
      WHERE e.user_id = ? AND e.class_id = ? AND e.status = 'active'
      ORDER BY e.updated_at DESC LIMIT 1`).bind(auth.user.id, auth.classId)
      .first<{ id: string; currentDay: number }>();
    if (!enrollment) return Response.json({ error: "An active course is required." }, { status: 409 });
    const now = Math.floor(Date.now() / 1000);
    const row = await auth.database.prepare(`SELECT remaining_seconds AS remainingSeconds,
      status, last_started_at AS lastStartedAt, course_day AS courseDay
      FROM smartlingo_course_session_state WHERE enrollment_id = ? LIMIT 1`)
      .bind(enrollment.id).first<{ remainingSeconds: number; status: string; lastStartedAt: number | null; courseDay: number }>();
    const calculated = row?.status === "running" && row.lastStartedAt
      ? Math.max(0, Number(row.remainingSeconds) - Math.max(0, now - Number(row.lastStartedAt)))
      : Number(row?.remainingSeconds ?? 3600);
    if (action === "complete_session" && calculated > 0) {
      return Response.json({
        error: "The server timer has not reached zero; the course day remains unfinished.",
        code: "SMARTLINGO_SESSION_TIME_REMAINS",
        remainingSeconds: calculated,
      }, { status: 409 });
    }
    const remaining = calculated;
    const nextStatus = remaining === 0 || row?.status === "completed"
      ? "completed"
      : action === "pause_session"
        ? "paused"
        : "running";
    await auth.database.prepare(`INSERT INTO smartlingo_course_session_state
      (enrollment_id, course_day, duration_seconds, remaining_seconds, status, last_started_at, updated_at)
      VALUES (?, ?, 3600, ?, ?, ?, ?)
      ON CONFLICT(enrollment_id) DO UPDATE SET course_day = excluded.course_day,
        remaining_seconds = excluded.remaining_seconds, status = excluded.status,
        last_started_at = excluded.last_started_at, updated_at = excluded.updated_at`)
      .bind(enrollment.id, enrollment.currentDay, nextStatus === "completed" ? 0 : remaining,
        nextStatus, nextStatus === "running" ? now : null, now).run();
    return Response.json(await learningState(auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage));
  }

  if (action === "pronunciation_review") {
    const sampleId = safeIdentifier(body.sampleId, 160);
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!sampleId || !transcript || transcript.length > 240) {
      return Response.json({ error: "A current vocabulary item and short device transcript are required" }, { status: 400 });
    }
    const currentState = await learningState(auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage);
    const assigned = currentState.vocabularyDeck.find(item => item.sampleId === sampleId);
    if (!assigned) return Response.json({ error: "This is not today's server-assigned vocabulary item" }, { status: 409 });
    const baseFeedback = scorePronunciationTranscript(assigned.form, transcript);
    const aiReview = await reviewSmartAiLearningContent({
      feature: "speaking_feedback",
      subject: `user:${auth.user.id}`,
      language: uiLanguage,
      instructions: "The audio was transcribed by the learner's device. Explain the transcript match score in one or two short sentences, give one concrete retry cue, and do not claim direct acoustic analysis.",
      content: JSON.stringify({
        targetLanguage: auth.access.targetLanguage,
        target: assigned.form,
        deviceTranscript: transcript,
        transcriptMatchScore: baseFeedback.score,
      }),
      deps: {
        providerPreference: auth.user.aiProviderPreference,
        country: smartAiRequestCountry(request),
      },
    }).catch(() => null);
    const feedback = aiReview && !aiReview.fallback ? {
      ...baseFeedback,
      feedback: { ...baseFeedback.feedback, [uiLanguage]: aiReview.value },
    } : baseFeedback;
    const sourceId = `${auth.classId}:${today}:${sampleId}:pronunciation`;
    const now = Math.floor(Date.now() / 1000);
    const inserted = await auth.database.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
      (id, user_id, class_id, domain, activity_type, duration_seconds, units, score,
       source_type, source_id, created_at)
      VALUES (?, ?, ?, 'dialogue', 'practice', 45, 1, ?, 'pronunciation_review', ?, ?) RETURNING id`)
      .bind(createId(), auth.user.id, auth.classId, feedback.score, sourceId, now).first<{ id: string }>();
    const activity = inserted ?? await existingLearningActivityId(
      auth.database,
      auth.user.id,
      "pronunciation_review",
      sourceId,
    );
    await awardLearningXp({
      database: auth.database,
      userId: auth.user.id,
      classId: auth.classId,
      activityEventId: activity?.id,
      reason: "pronunciation_review",
      timeZone,
    });
    return Response.json({
      ...await learningState(auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage, undefined, Boolean(inserted)),
      pronunciationFeedback: feedback,
      idempotent: !inserted,
    });
  }

  if (action === "submit_daily_quiz") {
    const answers = quizAnswers(body.answers);
    if (!answers) return Response.json({ error: "Valid daily quiz answers are required" }, { status: 400 });
    const clientOperationId = safeIdentifier(body.clientOperationId, 160);
    if (!clientOperationId) {
      return Response.json({ error: "A stable client operation identity is required for quiz retries." }, { status: 400 });
    }

    const readReceipt = () => auth.database.prepare(`SELECT id, checkpoint_id AS checkpointId,
      user_id AS userId, class_id AS classId, task_id AS taskId, skill,
      answer_text AS answerText, score, correct, skipped,
      explanation_zh AS explanationZh, explanation_en AS explanationEn,
      hint_zh AS hintZh, hint_en AS hintEn, content_version AS contentVersion
      FROM smartlingo_daily_answer_feedback WHERE client_operation_id = ? LIMIT 1`)
      .bind(clientOperationId).first<DailyQuizReceiptRow>();

    const replayReceipt = async (receipt: DailyQuizReceiptRow, idempotent: boolean) => {
      const evidence = quizReceiptEvidence(receipt.answerText);
      const checkpoint = evidence
        ? await dailyCheckpointById(auth.database, evidence.checkpointId)
        : null;
      const fingerprint = evidence
        ? await quizSubmissionFingerprint({
            userId: auth.user.id,
            classId: auth.classId,
            checkpointId: evidence.checkpointId,
            sessionDate: evidence.sessionDate,
            contentVersion: evidence.contentVersion,
            uiLanguage,
            vocabularyDay: evidence.vocabularyDay,
            targetLanguage: auth.access.targetLanguage,
            answers,
          })
        : null;
      if (receipt.skill !== "quiz" || receipt.userId !== auth.user.id || receipt.classId !== auth.classId
        || !evidence || receipt.checkpointId !== evidence.checkpointId
        || checkpoint?.userId !== auth.user.id || checkpoint.classId !== auth.classId
        || checkpoint.localDate !== evidence.sessionDate || checkpoint.contentVersion !== evidence.contentVersion
        || receipt.taskId !== `daily-quiz:${evidence.sessionDate}`
        || receipt.contentVersion !== evidence.contentVersion
        || evidence.uiLanguage !== uiLanguage || evidence.targetLanguage !== auth.access.targetLanguage
        || evidence.fingerprint !== fingerprint) {
        return Response.json({
          error: "This quiz operation identity was already used for different evidence.",
          code: "SMARTLINGO_QUIZ_OPERATION_REUSED",
        }, { status: 409 });
      }

      const [attempt, activity, xp] = await Promise.all([
        auth.database.prepare(`SELECT attempt_number AS attemptNumber, score,
          correct_count AS correctCount, question_count AS questionCount,
          local_date AS localDate, target_language AS targetLanguage,
          content_version AS contentVersion
          FROM smartlingo_daily_quiz_attempts
          WHERE id = ? AND user_id = ? AND class_id = ? LIMIT 1`)
          .bind(evidence.attemptId, auth.user.id, auth.classId)
          .first<{
            attemptNumber: number;
            score: number;
            correctCount: number;
            questionCount: number;
            localDate: string;
            targetLanguage: string;
            contentVersion: string;
          }>(),
        auth.database.prepare(`SELECT id FROM smartlingo_learning_activity_events
          WHERE id = ? AND user_id = ? AND class_id = ?
            AND source_type = 'daily_quiz' AND source_id = ? LIMIT 1`)
          .bind(evidence.activityId, auth.user.id, auth.classId, evidence.attemptId).first<{ id: string }>(),
        auth.database.prepare(`SELECT id FROM smartlingo_learning_xp_ledger
          WHERE activity_event_id = ? AND user_id = ? AND class_id = ? LIMIT 1`)
          .bind(evidence.activityId, auth.user.id, auth.classId).first<{ id: string }>(),
      ]);
      if (!attempt || attempt.localDate !== evidence.sessionDate
        || attempt.targetLanguage !== evidence.targetLanguage
        || attempt.contentVersion !== evidence.contentVersion
        || Number(attempt.score) !== Number(receipt.score)
        || !Number.isInteger(Number(attempt.questionCount))
        || Number(attempt.questionCount) < 1 || Number(attempt.questionCount) > 20) {
        return Response.json({
          error: "The quiz receipt is incomplete and cannot be reported as successful.",
          code: "SMARTLINGO_QUIZ_INCOMPLETE_RECEIPT",
        }, { status: 409 });
      }

      const questionReceipts = await Promise.all(Array.from(
        { length: Number(attempt.questionCount) },
        (_, index) => auth.database.prepare(`SELECT id, checkpoint_id AS checkpointId,
          user_id AS userId, class_id AS classId, task_id AS taskId, skill,
          answer_text AS answerText, score, correct, skipped,
          explanation_zh AS explanationZh, explanation_en AS explanationEn,
          hint_zh AS hintZh, hint_en AS hintEn, content_version AS contentVersion
          FROM smartlingo_daily_answer_feedback
          WHERE client_operation_id = ? AND checkpoint_id = ? AND user_id = ? AND class_id = ? LIMIT 1`)
          .bind(`${clientOperationId}:q${index + 1}`, evidence.checkpointId, auth.user.id, auth.classId)
          .first<DailyQuizReceiptRow>(),
      ));
      const completeQuestions = questionReceipts.every(item => item && item.skill === "quiz"
        && item.contentVersion === evidence.contentVersion);
      const xpAward = calculateLearningXp({ serverScore: Number(attempt.score) });
      const expectsXp = xpAward.eligible && xpAward.xp >= 1;
      if (!activity || (expectsXp && !xp) || !completeQuestions) {
        return Response.json({
          error: "The quiz receipt is incomplete and cannot be reported as successful.",
          code: "SMARTLINGO_QUIZ_INCOMPLETE_RECEIPT",
        }, { status: 409 });
      }
      if (expectsXp) await reconcileLearningStreak(auth.database, auth.user.id);
      return Response.json({
        ...await learningState(auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage, undefined, true),
        dailyQuizResult: {
          score: Number(attempt.score),
          correctCount: Number(attempt.correctCount),
          questionCount: Number(attempt.questionCount),
          attemptNumber: Number(attempt.attemptNumber),
          feedback: persistedDailyFeedback(receipt),
          responses: questionReceipts.map(item => ({
            questionId: item!.taskId,
            ...persistedDailyFeedback(item!),
          })),
        },
        idempotent,
      });
    };

    const existingReceipt = await readReceipt();
    if (existingReceipt) return replayReceipt(existingReceipt, true);

    const state = await learningState(auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage);
    const sessionDate = state.date;
    const day = Number(state.vocabularyDeckMeta.day);
    const assignedIds = new Set(state.dailyQuiz.questions.map(question => question.id));
    if (Object.keys(answers).some(questionId => !assignedIds.has(questionId))) {
      return Response.json({ error: "The quiz version is no longer current" }, { status: 409 });
    }
    const result = gradeDailyVocabularyQuiz(auth.access.targetLanguage, day, sessionDate, uiLanguage, answers);
    const responseFeedback = gradeDailyVocabularyQuizResponses(
      auth.access.targetLanguage,
      day,
      sessionDate,
      uiLanguage,
      answers,
    ).map(item => ({
      questionId: item.questionId,
      ...buildDailyAnswerFeedback({
        skill: "vocabulary",
        score: item.score,
        skipped: false,
        targetForm: item.targetForm,
        meaning: item.meaning,
        contentVersion: item.contentVersion,
      }),
    }));
    if (!state.sessionState || !state.dailySessionPlan) {
      return Response.json({ error: "An active course is required for the daily quiz." }, { status: 409 });
    }
    const checkpoint = await ensureDailyCheckpoint({
      database: auth.database,
      userId: auth.user.id,
      classId: auth.classId,
      enrollmentId: state.sessionState.enrollmentId,
      courseDay: state.sessionState.courseDay,
      date: sessionDate,
      timeZone,
      plan: state.dailySessionPlan,
    });
    if (!checkpoint) return Response.json({ error: "The daily checkpoint could not be created." }, { status: 409 });
    const quizFeedback = buildDailyAnswerFeedback({
      skill: "vocabulary",
      score: result.score,
      skipped: false,
      targetForm: uiLanguage === "zh" ? "今日词汇测验" : "today's vocabulary quiz",
      meaning: { zh: "用主动回忆巩固今日原创词汇", en: "active recall of today's original vocabulary" },
      contentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
    });
    const fingerprint = await quizSubmissionFingerprint({
      userId: auth.user.id,
      classId: auth.classId,
      checkpointId: checkpoint.id,
      sessionDate,
      contentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
      uiLanguage,
      vocabularyDay: day,
      targetLanguage: auth.access.targetLanguage,
      answers,
    });
    const xpAward = calculateLearningXp({ serverScore: result.score });
    const taskId = `daily-quiz:${sessionDate}`;

    const now = Math.floor(Date.now() / 1000);
    const authoritativeTimeZone = await ensureLearningStreakAuthority(
      auth.database,
      auth.user.id,
      timeZone,
    );
    const authoritativeDate = localDateKey(now, authoritativeTimeZone);
    const receiptId = createId();
    const attemptId = createId();
    const activityId = createId();
    const receiptEvidence = JSON.stringify({
      attemptId,
      activityId,
      checkpointId: checkpoint.id,
      sessionDate,
      contentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
      uiLanguage,
      vocabularyDay: day,
      targetLanguage: auth.access.targetLanguage,
      fingerprint,
    });
    const statements = [
      auth.database.prepare(`INSERT INTO smartlingo_daily_answer_feedback
        (id, checkpoint_id, user_id, class_id, task_id, skill, client_operation_id,
         answer_text, score, correct, skipped, explanation_zh, explanation_en,
         hint_zh, hint_en, content_version, created_at)
        VALUES (?, ?, ?, ?, ?, 'quiz', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`)
        .bind(receiptId, checkpoint.id, auth.user.id, auth.classId, taskId,
          clientOperationId, receiptEvidence, result.score, quizFeedback.isCorrect ? 1 : 0,
          quizFeedback.explanation.zh, quizFeedback.explanation.en, quizFeedback.hint.zh,
          quizFeedback.hint.en, quizFeedback.contentVersion, now),
      auth.database.prepare(`INSERT INTO smartlingo_daily_quiz_attempts
        (id, user_id, class_id, local_date, target_language, content_version, attempt_number,
         score, correct_count, question_count, created_at)
        SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(attempt_number), 0) + 1, ?, ?, ?, ?
        FROM smartlingo_daily_quiz_attempts
        WHERE user_id = ? AND class_id = ? AND local_date = ?`)
        .bind(attemptId, auth.user.id, auth.classId, sessionDate, auth.access.targetLanguage,
          SMARTLINGO_LEARNING_CONTENT_VERSION, result.score, result.correctCount, result.questionCount,
          now, auth.user.id, auth.classId, sessionDate),
      ...responseFeedback.map((item, index) => auth.database.prepare(`INSERT INTO smartlingo_daily_answer_feedback
        (id, checkpoint_id, user_id, class_id, task_id, skill, client_operation_id,
         answer_text, score, correct, skipped, explanation_zh, explanation_en,
         hint_zh, hint_en, content_version, created_at)
        VALUES (?, ?, ?, ?, ?, 'quiz', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`)
        .bind(createId(), checkpoint.id, auth.user.id, auth.classId, item.questionId,
          `${clientOperationId}:q${index + 1}`, answers[item.questionId] || "", item.score,
          item.isCorrect ? 1 : 0, item.explanation.zh, item.explanation.en,
          item.hint.zh, item.hint.en, item.contentVersion, now)),
      auth.database.prepare(`INSERT INTO smartlingo_learning_activity_events
      (id, user_id, class_id, domain, activity_type, duration_seconds, units, score,
       source_type, source_id, created_at)
       VALUES (?, ?, ?, 'vocabulary', 'practice', 180, ?, ?, 'daily_quiz', ?, ?)`)
        .bind(activityId, auth.user.id, auth.classId, result.questionCount, result.score, attemptId, now),
      ...(xpAward.eligible && xpAward.xp >= 1 ? [auth.database.prepare(`INSERT INTO smartlingo_learning_xp_ledger
        (id, user_id, class_id, activity_event_id, xp, reason, local_date, time_zone, created_at)
        VALUES (?, ?, ?, ?, ?, 'daily_quiz', ?, ?, ?)`)
        .bind(createId(), auth.user.id, auth.classId, activityId, xpAward.xp,
          authoritativeDate, authoritativeTimeZone, now)] : []),
    ];

    let committed = false;
    for (let transactionAttempt = 0; transactionAttempt < 2 && !committed; transactionAttempt += 1) {
      try {
        await auth.database.batch(statements);
        committed = true;
      } catch {
        const racedReceipt = await readReceipt();
        if (racedReceipt) return replayReceipt(racedReceipt, true);
        const latest = await auth.database.prepare(`SELECT COALESCE(MAX(attempt_number), 0) AS attemptNumber
          FROM smartlingo_daily_quiz_attempts WHERE user_id = ? AND class_id = ? AND local_date = ?`)
          .bind(auth.user.id, auth.classId, sessionDate).first<{ attemptNumber: number }>();
        if (Number(latest?.attemptNumber || 0) >= 20) {
          return Response.json({ error: "Daily quiz retry limit reached" }, { status: 409 });
        }
        if (transactionAttempt === 1) {
          return Response.json({
            error: "The quiz transaction could not be committed; retry with the same operation identity.",
            code: "SMARTLINGO_QUIZ_TRANSACTION_RETRY",
          }, { status: 503 });
        }
      }
    }
    const committedReceipt = await readReceipt();
    if (!committedReceipt) {
      return Response.json({ error: "The quiz transaction produced no durable receipt." }, { status: 503 });
    }
    return replayReceipt(committedReceipt, false);
  }

  if (action === "vocabulary_review") {
    const sampleId = safeIdentifier(body.sampleId || body.taskId, 160);
    if (!sampleId || !isVocabularyMode(body.mode) || !isVocabularyGrade(body.grade)) {
      return Response.json({ error: "A valid vocabulary sample, mode, and grade are required" }, { status: 400 });
    }
    const currentState = await learningState(
      auth.database,
      auth.user.id,
      auth.access,
      auth.placement,
      today,
      uiLanguage,
      body.mode,
    );
    const assignedSampleIds = new Set(currentState.vocabularyDeck.map(item => item.sampleId));
    const sample = getVocabularySampleById(auth.access.targetLanguage, sampleId);
    if (!sample || !assignedSampleIds.has(sampleId)) {
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
    const activity = inserted ?? await existingLearningActivityId(
      auth.database,
      auth.user.id,
      "vocabulary_review",
      sourceId,
    );
    await awardLearningXp({
      database: auth.database,
      userId: auth.user.id,
      classId: auth.classId,
      activityEventId: activity?.id,
      skipped: body.grade === "suspend",
      reason: "vocabulary_review",
      timeZone,
    });
    return Response.json({
      ...await learningState(
        auth.database,
        auth.user.id,
        auth.access,
        auth.placement,
        today,
        uiLanguage,
        undefined,
        Boolean(inserted),
      ),
      idempotent: !inserted,
    });
  }

  if (action === "set_vocabulary_focus") {
    const sampleId = safeIdentifier(body.sampleId || body.taskId, 160);
    if (!sampleId || typeof body.focused !== "boolean") {
      return Response.json({ error: "A valid vocabulary sample and focus state are required" }, { status: 400 });
    }
    const currentState = await learningState(
      auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage,
    );
    if (!currentState.vocabularyDeck.some(item => item.sampleId === sampleId)) {
      return Response.json({ error: "This vocabulary sample is not in the current server-assigned deck" }, { status: 409 });
    }
    const sample = getVocabularySampleById(auth.access.targetLanguage, sampleId);
    if (!sample) return Response.json({ error: "Vocabulary sample not found" }, { status: 404 });
    const now = Math.floor(Date.now() / 1000);
    await auth.database.prepare(`INSERT INTO smartlingo_vocabulary_progress
      (id, user_id, path_id, class_id, word_key, word_version, status, modes_seen,
       review_box, interval_days, review_count, correct_count, lapse_count,
       last_score, is_focused, due_at, last_reviewed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'new', '[]', 0, 0, 0, 0, 0, NULL, ?, NULL, NULL, ?, ?)
      ON CONFLICT(user_id, path_id, word_key, word_version) DO UPDATE SET
        is_focused = excluded.is_focused, class_id = excluded.class_id, updated_at = excluded.updated_at`)
      .bind(createId(), auth.user.id, auth.access.pathId, auth.classId, sample.stableId,
        sample.version, body.focused ? 1 : 0, now, now).run();
    return Response.json(await learningState(
      auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage,
    ));
  }

  if (action === "submit_task" || action === "skip_task") {
    const taskId = safeIdentifier(body.taskId, 240);
    if (!taskId || !isPracticeSkill(body.skill)) {
      return Response.json({ error: "A valid daily task and skill are required" }, { status: 400 });
    }
    const state = await learningState(auth.database, auth.user.id, auth.access, auth.placement, today, uiLanguage);
    const parts = taskId.split(":");
    const taskDate = parts.length === 5 && parts[0] === "daily" ? parts[1] : "";
    const taskLanguage = parts.length === 5 ? parts[2] : "";
    const taskSkill = parts.length === 5 ? parts[3] : "";
    if (!validDate(taskDate) || taskDate !== state.date || taskLanguage !== auth.access.targetLanguage || taskSkill !== body.skill) {
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
    if (!state.sessionState || !state.dailySessionPlan) {
      return Response.json({ error: "An active course is required for daily practice." }, { status: 409 });
    }
    const checkpoint = await ensureDailyCheckpoint({
      database: auth.database,
      userId: auth.user.id,
      classId: auth.classId,
      enrollmentId: state.sessionState.enrollmentId,
      courseDay: state.sessionState.courseDay,
      date: state.date,
      timeZone,
      plan: state.dailySessionPlan,
    });
    if (!checkpoint) return Response.json({ error: "The daily checkpoint could not be created." }, { status: 409 });
    const feedback = buildDailyAnswerFeedback({
      skill: body.skill,
      score: score ?? 0,
      skipped,
      targetForm: assigned.prompt,
      meaning: {
        zh: assigned.context ? `根据“${assigned.context}”完成今日${body.skill}练习` : `完成今日${body.skill}练习`,
        en: assigned.context ? `complete today's ${body.skill} practice from “${assigned.context}”` : `complete today's ${body.skill} practice`,
      },
      contentVersion: assigned.contentVersion,
    });
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
    const activity = inserted ?? await existingLearningActivityId(
      auth.database,
      auth.user.id,
      "daily_practice",
      sourceId,
    );
    await awardLearningXp({
      database: auth.database,
      userId: auth.user.id,
      classId: auth.classId,
      activityEventId: activity?.id,
      skipped,
      reason: "daily_practice",
      timeZone,
    });
    const operationIdentity = `answer:${auth.user.id}:${sourceId}`;
    await auth.database.prepare(`INSERT OR IGNORE INTO smartlingo_daily_answer_feedback
      (id, checkpoint_id, user_id, class_id, task_id, skill, client_operation_id,
       answer_text, score, correct, skipped, explanation_zh, explanation_en,
       hint_zh, hint_en, content_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(createId(), checkpoint.id, auth.user.id, auth.classId, taskId, body.skill,
        operationIdentity, typeof body.answer === "string" ? body.answer.trim() : "", score,
        feedback.isCorrect ? 1 : 0, skipped ? 1 : 0, feedback.explanation.zh,
        feedback.explanation.en, feedback.hint.zh, feedback.hint.en,
        feedback.contentVersion, now).run();
    return Response.json({
      ...await learningState(
        auth.database,
        auth.user.id,
        auth.access,
        auth.placement,
        today,
        uiLanguage,
        undefined,
        Boolean(inserted),
      ),
      answerFeedback: feedback,
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
