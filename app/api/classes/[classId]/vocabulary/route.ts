import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import {
  createVocabularyReviewState,
  scheduleVocabularyReview,
  scorePronunciationTranscript,
  selectNextVocabularyReviewMode,
  SMARTLINGO_VOCABULARY_MEMORY_DAYS,
  type VocabularyReviewMode,
  type VocabularyReviewState,
} from "@/lib/smartlingo-learning";
import { localDateKey, requireOfficialClassMembership, safeTimeZone } from "@/lib/smartlingo-learning-access";
import { buildCourseSentenceBank, tokenizeSentence } from "@/lib/smartlingo-sentence-exercises";
import type { SmartLingoLearningLanguage, SmartLingoLevel } from "@/lib/smartlingo-learning";
import { adaptiveSentenceRounds } from "@/lib/smartlingo-adaptive-sentences";
import type { SmartLingoSentenceExercise } from "@/lib/smartlingo-sentence-exercises";

export const dynamic = "force-dynamic";

type CatalogRow = {
  id: string; stableKey: string; version: string; targetLanguage: string; level: string;
  difficulty: number; frequencyDegree: number; sceneKey: string; sequence: number; form: string; pronunciation: string;
  targetPhonetic: string; pronunciationEn: string; pronunciationZh: string;
  pronunciationGuides: string;
  meaningEn: string; meaningZh: string;
};
type ProgressRow = {
  wordKey: string; wordVersion: string; status: string; modesSeen: string; reviewBox: number;
  intervalDays: number; reviewCount: number; correctCount: number; lapseCount: number;
  lastScore: number | null; dueAt: number | null; lastReviewedAt: number | null;
  successfulDates: string; firstLearnedAt: number | null; masteredAt: number | null;
};

const MODES = ["recognition", "recall", "listening", "spelling", "cloze"] as const;
const LEVEL_RANK: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };

function parseStringArray(value: string, allowed?: readonly string[]) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && (!allowed || allowed.includes(item))).slice(-24);
  } catch { return []; }
}

function progressKey(item: CatalogRow) {
  if (item.level !== "beginner") return item.stableKey;
  const day = Math.ceil(item.sequence / 4);
  const position = ((item.sequence - 1) % 4) + 1;
  return `sl-vocab-${item.targetLanguage}-beginner-d${day}-${position}`;
}

function memoryState(item: CatalogRow, row: ProgressRow | undefined, now: number): VocabularyReviewState {
  if (!row) return createVocabularyReviewState(progressKey(item), now * 1000);
  return {
    sampleId: progressKey(item),
    status: row.status === "new" ? "learning" : row.status as VocabularyReviewState["status"],
    intervalDays: Math.max(0, Number(row.intervalDays || 0)),
    dueAt: row.dueAt === null ? null : Number(row.dueAt) * 1000,
    consecutiveCorrect: Math.max(0, Math.min(5, Number(row.reviewBox || 0))),
    recentCorrectModes: parseStringArray(row.modesSeen, MODES) as VocabularyReviewMode[],
    successfulDates: parseStringArray(row.successfulDates).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)),
    firstLearnedAt: row.firstLearnedAt === null ? null : row.firstLearnedAt * 1000,
    masteredAt: row.masteredAt === null ? null : row.masteredAt * 1000,
    lapseCount: Math.max(0, Number(row.lapseCount || 0)),
    lastGrade: null,
    lastReviewedAt: row.lastReviewedAt === null ? null : row.lastReviewedAt * 1000,
  };
}

function learnerStatus(row: ProgressRow | undefined) {
  if (row?.status === "mastered") return "mastered" as const;
  if (row && row.status !== "new" && row.status !== "suspended") return "learning" as const;
  return "unlearned" as const;
}

function starsFor(percent: number) {
  return percent <= 0 ? 0 : Math.min(5, Math.ceil(percent / 20));
}

function summarize(catalog: CatalogRow[], progress: Map<string, ProgressRow>) {
  const counts = { mastered: 0, learning: 0, unlearned: 0 };
  for (const item of catalog) counts[learnerStatus(progress.get(progressKey(item)))] += 1;
  const total = catalog.length;
  const percent = total ? Math.round(counts.mastered * 100 / total) : 0;
  return { total, ...counts, percent, stars: starsFor(percent) };
}

async function authorize(request: Request, classId: string) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "Authentication required" }, { status: 401 }) } as const;
  const database = getDatabase();
  const access = await requireOfficialClassMembership(database, user, classId);
  if (!access) return { error: Response.json({ error: "Active course access is required" }, { status: 403 }) } as const;
  return { user, database, access } as const;
}

async function catalogFor(database: ReturnType<typeof getDatabase>, targetLanguage: string, level: string) {
  const result = await database.prepare(`SELECT id,stable_key AS stableKey,version,target_language AS targetLanguage,
    level,difficulty,frequency_degree AS frequencyDegree,scene_key AS sceneKey,sequence,form,pronunciation,target_phonetic AS targetPhonetic,
    pronunciation_en AS pronunciationEn,pronunciation_zh AS pronunciationZh,
    pronunciation_guides AS pronunciationGuides,
    meaning_en AS meaningEn,meaning_zh AS meaningZh
    FROM smartlingo_vocabulary_items WHERE target_language=? AND review_status='published'
    ORDER BY difficulty ASC,frequency_degree DESC,sequence,id`)
    .bind(targetLanguage).run<CatalogRow>();
  const rank = LEVEL_RANK[level] || 1;
  return (result.results || []).filter(item => (LEVEL_RANK[item.level] || 99) <= rank);
}

async function progressFor(database: ReturnType<typeof getDatabase>, userId: string, pathId: string) {
  const result = await database.prepare(`SELECT word_key AS wordKey,word_version AS wordVersion,status,
    modes_seen AS modesSeen,review_box AS reviewBox,interval_days AS intervalDays,review_count AS reviewCount,
    correct_count AS correctCount,lapse_count AS lapseCount,last_score AS lastScore,due_at AS dueAt,
    last_reviewed_at AS lastReviewedAt,successful_dates AS successfulDates,
    first_learned_at AS firstLearnedAt,mastered_at AS masteredAt
    FROM smartlingo_vocabulary_progress WHERE user_id=? AND path_id=?`)
    .bind(userId, pathId).run<ProgressRow>();
  return new Map((result.results || []).map(row => [row.wordKey, row]));
}

function cardPayload(item: CatalogRow, catalog: CatalogRow[], progress: Map<string, ProgressRow>, now: number, adaptiveSentence?: SmartLingoSentenceExercise) {
  const row = progress.get(progressKey(item));
  const state = memoryState(item, row, now);
  const alternatives = catalog.filter(candidate => candidate.id !== item.id)
    .sort((a, b) => ((a.sequence * 17 + item.sequence * 31) % 97) - ((b.sequence * 17 + item.sequence * 31) % 97))
    .slice(0, 3);
  const options = [item, ...alternatives]
    .sort((a, b) => ((a.sequence * 13 + item.sequence * 7) % 41) - ((b.sequence * 13 + item.sequence * 7) % 41))
    .map(option => ({ id: option.id, form: option.form, meaningEn: option.meaningEn, meaningZh: option.meaningZh }));
  let pronunciationGuides: Record<string, string> = {};
  try {
    const parsed = JSON.parse(item.pronunciationGuides) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) pronunciationGuides = parsed as Record<string, string>;
  } catch { /* Migration constraints keep published rows valid. */ }
  const sentence = adaptiveSentence || buildCourseSentenceBank(item.targetLanguage as SmartLingoLearningLanguage, item.level as SmartLingoLevel)[(item.sequence - 1) % 120];
  return {
    id: item.id,
    progressKey: progressKey(item),
    version: item.version,
    form: item.form,
    pronunciation: item.pronunciation,
    targetPhonetic: item.targetPhonetic,
    pronunciationEn: item.pronunciationEn,
    pronunciationZh: item.pronunciationZh,
    pronunciationGuides,
    meaningEn: item.meaningEn,
    meaningZh: item.meaningZh,
    sceneKey: item.sceneKey,
    difficulty: item.difficulty,
    frequencyDegree: item.frequencyDegree,
    sentence: { id: sentence.id, scenario: sentence.scenario, promptZh: sentence.translation.zh, promptEn: sentence.translation.en, audioText: sentence.targetSentence, answerTokens: tokenizeSentence(sentence.targetSentence, item.targetLanguage as SmartLingoLearningLanguage) },
    direction: item.targetLanguage === "ar" ? "rtl" : "ltr",
    status: learnerStatus(row),
    memoryStage: state.consecutiveCorrect,
    nextMemoryDay: SMARTLINGO_VOCABULARY_MEMORY_DAYS[state.consecutiveCorrect] ?? null,
    mode: selectNextVocabularyReviewMode(state),
    dueAt: row?.dueAt ?? null,
    options,
  };
}

function libraryPayload(item: CatalogRow, progress: Map<string, ProgressRow>, now: number) {
  const row = progress.get(progressKey(item));
  const state = memoryState(item, row, now);
  return {
    id: item.id,
    form: item.form,
    targetPhonetic: item.targetPhonetic,
    meaningEn: item.meaningEn,
    meaningZh: item.meaningZh,
    sceneKey: item.sceneKey,
    difficulty: item.difficulty,
    frequencyDegree: item.frequencyDegree,
    direction: item.targetLanguage === "ar" ? "rtl" as const : "ltr" as const,
    status: learnerStatus(row),
    memoryStage: state.consecutiveCorrect,
  };
}

async function writeReport(database: ReturnType<typeof getDatabase>, userId: string, pathId: string, classId: string, localDate: string, summary: ReturnType<typeof summarize>) {
  const now = Math.floor(Date.now() / 1000);
  await database.prepare(`INSERT INTO smartlingo_vocabulary_daily_reports
    (id,user_id,path_id,class_id,local_date,total_count,mastered_count,learning_count,unlearned_count,mastery_percent,stars,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,path_id,local_date) DO UPDATE SET class_id=excluded.class_id,total_count=excluded.total_count,
    mastered_count=excluded.mastered_count,learning_count=excluded.learning_count,unlearned_count=excluded.unlearned_count,
    mastery_percent=excluded.mastery_percent,stars=excluded.stars,updated_at=excluded.updated_at`)
    .bind(createId(), userId, pathId, classId, localDate, summary.total, summary.mastered, summary.learning,
      summary.unlearned, summary.percent, summary.stars, now, now).run();
}

async function responsePayload(database: ReturnType<typeof getDatabase>, userId: string, access: { pathId: string; classId: string; targetLanguage: string; level: string; packageTier: string | null }, localDate: string, persistReport = false, startWordId = "", uiLang: "zh" | "en" = "en", includeAdaptiveSentences = true) {
  const level = access.packageTier || access.level || "beginner";
  const now = Math.floor(Date.now() / 1000);
  const catalog = await catalogFor(database, access.targetLanguage, level);
  const progress = await progressFor(database, userId, access.pathId);
  const summary = summarize(catalog, progress);
  if (persistReport) await writeReport(database, userId, access.pathId, access.classId, localDate, summary);
  const started = catalog.filter(item => learnerStatus(progress.get(progressKey(item))) === "learning")
    .sort((a, b) => (progress.get(progressKey(a))?.dueAt ?? 0) - (progress.get(progressKey(b))?.dueAt ?? 0));
  const fresh = catalog.filter(item => learnerStatus(progress.get(progressKey(item))) === "unlearned")
    .sort((a, b) => a.difficulty - b.difficulty || b.frequencyDegree - a.frequencyDegree || a.sequence - b.sequence);
  const due = started.filter(item => (progress.get(progressKey(item))?.dueAt ?? 0) <= now);
  const startIndex = startWordId ? catalog.findIndex(item => item.id === startWordId) : -1;
  const selected = startIndex >= 0
    ? [...catalog.slice(startIndex), ...catalog.slice(0, startIndex)].slice(0, 20)
    : [...due, ...fresh.slice(0, 20), ...started]
      .filter((item, index, values) => values.findIndex(candidate => candidate.id === item.id) === index)
      .slice(0, 20);
  const adaptive = selected.length && includeAdaptiveSentences ? await adaptiveSentenceRounds({
    database,
    language: access.targetLanguage as SmartLingoLearningLanguage,
    level: level as SmartLingoLevel,
    uiLang,
    roundVocabulary: Array.from({ length: Math.ceil(selected.length / 5) }, (_, roundIndex) => selected.slice(roundIndex * 5, roundIndex * 5 + 5).map(item => ({ id: item.id, form: item.form, pronunciation: item.pronunciation, meaning: uiLang === "zh" ? item.meaningZh : item.meaningEn, difficulty: item.difficulty, frequencyDegree: item.frequencyDegree }))),
  }).catch(() => null) : null;
  const items = catalog.map(item => libraryPayload(item, progress, now));
  const reportResult = await database.prepare(`SELECT local_date AS localDate,total_count AS total,mastered_count AS mastered,
    learning_count AS learning,unlearned_count AS unlearned,mastery_percent AS percent,stars
    FROM smartlingo_vocabulary_daily_reports WHERE user_id=? AND path_id=? ORDER BY local_date DESC LIMIT 21`)
    .bind(userId, access.pathId).run();
  return {
    localDate,
    targetLanguage: access.targetLanguage,
    level,
    methodology: { days: SMARTLINGO_VOCABULARY_MEMORY_DAYS, minimumModes: 3 },
    summary,
    learningReleaseId: adaptive?.releaseId || "graded-catalog",
    sentenceSource: adaptive?.sourceType || "graded-catalog",
    dailyDeck: selected.map((item, index) => cardPayload(item, catalog, progress, now, adaptive?.rounds[Math.floor(index / 5)]?.[index % 5])),
    items,
    reports: [{ localDate, ...summary }, ...(reportResult.results || []).filter(report => (report as { localDate?: string }).localDate !== localDate)].slice(0, 21),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const auth = await authorize(request, classId);
  if ("error" in auth) return auth.error;
  const timeZone = safeTimeZone(new URL(request.url).searchParams.get("timeZone"));
  const localDate = localDateKey(Math.floor(Date.now() / 1000), timeZone);
  const startWordId = new URL(request.url).searchParams.get("startWordId") || "";
  const uiLang = new URL(request.url).searchParams.get("lang") === "zh" ? "zh" : "en";
  return Response.json(await responsePayload(auth.database, auth.user.id, auth.access, localDate, false, startWordId, uiLang));
}

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const auth = await authorize(request, classId);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null) as {
    action?: string; cardId?: string; selectedId?: string; answer?: string; mode?: string; timeZone?: string; transcript?: string; lang?: string;
  } | null;
  if (!body?.cardId) return Response.json({ error: "A current vocabulary card is required" }, { status: 400 });
  const timeZone = safeTimeZone(body.timeZone || null);
  const now = Math.floor(Date.now() / 1000);
  const localDate = localDateKey(now, timeZone);
  const level = auth.access.packageTier || auth.access.level || "beginner";
  const catalog = await catalogFor(auth.database, auth.access.targetLanguage, level);
  const item = catalog.find(candidate => candidate.id === body.cardId);
  if (!item) return Response.json({ error: "This word is not in the published course vocabulary" }, { status: 409 });
  if (body.action === "pronunciation_review") {
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript || transcript.length > 240) {
      return Response.json({ error: "A short device transcript is required" }, { status: 400 });
    }
    return Response.json({ pronunciationFeedback: scorePronunciationTranscript(item.form, transcript) });
  }
  if ((!body.selectedId && !body.answer?.trim()) || !MODES.includes(body.mode as VocabularyReviewMode)) {
    return Response.json({ error: "A valid card answer and review mode are required" }, { status: 400 });
  }
  const progress = await progressFor(auth.database, auth.user.id, auth.access.pathId);
  const current = progress.get(progressKey(item));
  const state = memoryState(item, current, now);
  const expectedMode = selectNextVocabularyReviewMode(state);
  if (body.mode !== expectedMode) return Response.json({ error: "The vocabulary mode is stale; reload today's deck" }, { status: 409 });
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[.,!?;:،。！？；：'"“”‘’()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
  const correct = expectedMode === "spelling" || expectedMode === "cloze"
    ? normalize(body.answer || "") === normalize(item.form)
    : body.selectedId === item.id;
  const scheduled = scheduleVocabularyReview(state, {
    grade: correct ? "good" : "again",
    mode: expectedMode,
    reviewedAt: now * 1000,
    localDate,
  });
  const score = correct ? 100 : 0;
  await auth.database.prepare(`INSERT INTO smartlingo_vocabulary_progress
    (id,user_id,path_id,class_id,word_key,word_version,status,modes_seen,review_box,interval_days,
    review_count,correct_count,lapse_count,last_score,is_focused,successful_dates,first_learned_at,mastered_at,due_at,last_reviewed_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,0,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,path_id,word_key,word_version) DO UPDATE SET class_id=excluded.class_id,status=excluded.status,
    modes_seen=excluded.modes_seen,review_box=excluded.review_box,interval_days=excluded.interval_days,
    review_count=smartlingo_vocabulary_progress.review_count+1,
    correct_count=smartlingo_vocabulary_progress.correct_count+?,lapse_count=smartlingo_vocabulary_progress.lapse_count+?,
    last_score=excluded.last_score,successful_dates=excluded.successful_dates,first_learned_at=excluded.first_learned_at,
    mastered_at=excluded.mastered_at,due_at=excluded.due_at,last_reviewed_at=excluded.last_reviewed_at,updated_at=excluded.updated_at`)
    .bind(createId(), auth.user.id, auth.access.pathId, auth.access.classId, progressKey(item), item.version,
      scheduled.status, JSON.stringify(scheduled.recentCorrectModes), scheduled.consecutiveCorrect, scheduled.intervalDays,
      correct ? 1 : 0, correct ? 0 : 1, score, JSON.stringify(scheduled.successfulDates),
      scheduled.firstLearnedAt === null ? null : Math.floor(scheduled.firstLearnedAt / 1000),
      scheduled.masteredAt === null ? null : Math.floor(scheduled.masteredAt / 1000),
      scheduled.dueAt === null ? null : Math.floor(scheduled.dueAt / 1000), now, now, now,
      correct ? 1 : 0, correct ? 0 : 1).run();
  // The learner already has this round's sentence deck from GET. Do not block
  // immediate answer feedback on a newly shifted deck's optional AI sentence
  // generation; the client preserves the current dailyDeck until the next GET.
  return Response.json({ correct, ...(await responsePayload(auth.database, auth.user.id, auth.access, localDate, true, "", body.lang === "zh" ? "zh" : "en", false)) });
}
