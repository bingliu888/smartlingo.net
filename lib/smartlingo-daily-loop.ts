export const SMARTLINGO_DAILY_SKILLS = [
  "vocabulary",
  "reading",
  "writing",
  "listening",
  "dialogue",
] as const;

export type SmartLingoDailySkill = (typeof SMARTLINGO_DAILY_SKILLS)[number];
export type SmartLingoDailyMinutes = 15 | 30 | 45 | 60;

export function currentDailyQuizAnswers(
  answers: Readonly<Record<string, string>> | undefined,
  questionIds: readonly string[],
): Record<string, string> {
  if (!answers) return {};
  const currentIds = new Set(questionIds);
  return Object.fromEntries(Object.entries(answers).filter(([questionId]) => currentIds.has(questionId)));
}

export interface SmartLingoBilingualText {
  readonly zh: string;
  readonly en: string;
}

export interface DailyLearningSessionInput {
  readonly minutes: SmartLingoDailyMinutes;
  readonly useCase: string | SmartLingoBilingualText;
  readonly stage: string | SmartLingoBilingualText;
  readonly recentScores: Readonly<Record<SmartLingoDailySkill, number>>;
  readonly dueVocabularyCount: number;
  readonly language: string;
  /** A learner-local calendar date. Instants and UTC timestamps are rejected. */
  readonly date: string;
  readonly contentVersion: string;
}

export type DailyLearningBlock = {
  readonly id: string;
  readonly kind: "new_material" | "spaced_review" | "skill_practice" | "recap";
  readonly minutes: number;
  readonly skill?: SmartLingoDailySkill;
  readonly rationale: SmartLingoBilingualText;
  readonly sourceType: "smartlingo_original";
};

export interface DailyLearningSession {
  readonly id: string;
  readonly minutes: SmartLingoDailyMinutes;
  readonly totalMinutes: SmartLingoDailyMinutes;
  readonly language: string;
  readonly date: string;
  readonly contentVersion: string;
  readonly useCase: SmartLingoBilingualText;
  readonly stage: SmartLingoBilingualText;
  readonly dueVocabularyCount: number;
  readonly recentScores: Readonly<Record<SmartLingoDailySkill, number>>;
  readonly blocks: readonly DailyLearningBlock[];
  readonly sourceType: "smartlingo_original";
}

const USE_CASE_LABELS: Readonly<Record<string, SmartLingoBilingualText>> = {
  travel: { zh: "旅行沟通", en: "travel communication" },
  work: { zh: "工作协作", en: "work collaboration" },
  study: { zh: "学业学习", en: "academic study" },
  family: { zh: "家庭交流", en: "family communication" },
  community: { zh: "社区参与", en: "community participation" },
  daily_life: { zh: "日常生活", en: "daily life" },
};

const STAGE_LABELS: Readonly<Record<string, SmartLingoBilingualText>> = {
  beginner: { zh: "初级", en: "beginner" },
  intermediate: { zh: "中级", en: "intermediate" },
  advanced: { zh: "高级", en: "advanced" },
  foundation: { zh: "基础阶段", en: "foundation" },
  everyday: { zh: "日常应用阶段", en: "everyday application" },
  independent: { zh: "独立表达阶段", en: "independent expression" },
};

const SKILL_LABELS: Readonly<Record<SmartLingoDailySkill, SmartLingoBilingualText>> = {
  vocabulary: { zh: "词汇", en: "vocabulary" },
  reading: { zh: "阅读", en: "reading" },
  writing: { zh: "写作", en: "writing" },
  listening: { zh: "听力", en: "listening" },
  dialogue: { zh: "对话", en: "dialogue" },
};

const ALLOWED_MINUTES = new Set<number>([15, 30, 45, 60]);
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} must be a non-empty string`);
  return normalized;
}

function bilingualLabel(
  value: string | SmartLingoBilingualText,
  known: Readonly<Record<string, SmartLingoBilingualText>>,
  field: string,
): SmartLingoBilingualText {
  if (typeof value === "string") {
    const normalized = requireText(value, field);
    return known[normalized.toLocaleLowerCase()] ?? { zh: normalized, en: normalized };
  }
  return {
    zh: requireText(value.zh, `${field}.zh`),
    en: requireText(value.en, `${field}.en`),
  };
}

function boundedScore(value: number, field = "score"): number {
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function localDateOrdinal(value: string, field = "date"): number {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) throw new TypeError(`${field} must be a learner-local YYYY-MM-DD date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(0);
  instant.setUTCHours(0, 0, 0, 0);
  instant.setUTCFullYear(year, month - 1, day);
  if (
    instant.getUTCFullYear() !== year
    || instant.getUTCMonth() !== month - 1
    || instant.getUTCDate() !== day
  ) {
    throw new RangeError(`${field} must be a valid calendar date`);
  }
  return Math.floor(instant.getTime() / DAY_MS);
}

function ordinalToLocalDate(ordinal: number): string {
  const instant = new Date(ordinal * DAY_MS);
  const year = instant.getUTCFullYear().toString().padStart(4, "0");
  const month = (instant.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = instant.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDailyLearningDates(practiceDate: string, checkpointDate: string) {
  localDateOrdinal(practiceDate, "practiceDate");
  localDateOrdinal(checkpointDate, "checkpointDate");
  return { practiceDate, checkpointDate } as const;
}

function allocateSkillMinutes(
  budget: number,
  scores: Readonly<Record<SmartLingoDailySkill, number>>,
): Record<SmartLingoDailySkill, number> {
  const allocation = Object.fromEntries(SMARTLINGO_DAILY_SKILLS.map(skill => [skill, 1])) as Record<SmartLingoDailySkill, number>;
  let remaining = budget - SMARTLINGO_DAILY_SKILLS.length;
  const lowestScore = Math.min(...SMARTLINGO_DAILY_SKILLS.map(skill => scores[skill]));
  const highestScore = Math.max(...SMARTLINGO_DAILY_SKILLS.map(skill => scores[skill]));

  // Reserve a visible minute for a unique weakest area before proportional
  // allocation, so a short session still responds to recent evidence.
  const uniqueWeakest = SMARTLINGO_DAILY_SKILLS.filter(skill => scores[skill] === lowestScore);
  if (remaining > 0 && lowestScore < highestScore && uniqueWeakest.length === 1) {
    allocation[uniqueWeakest[0]] += 1;
    remaining -= 1;
  }

  if (remaining <= 0) return allocation;
  const weights = SMARTLINGO_DAILY_SKILLS.map(skill => ({
    skill,
    weight: 1 + (100 - scores[skill]),
  }));
  const weightTotal = weights.reduce((total, item) => total + item.weight, 0);
  const quotas = weights.map((item, index) => {
    const exact = remaining * item.weight / weightTotal;
    const whole = Math.floor(exact);
    allocation[item.skill] += whole;
    return { ...item, index, fraction: exact - whole };
  });
  const used = quotas.reduce((total, item) => total + Math.floor(remaining * item.weight / weightTotal), 0);
  const leftovers = remaining - used;
  quotas
    .sort((left, right) => right.fraction - left.fraction || scores[left.skill] - scores[right.skill] || left.index - right.index)
    .slice(0, leftovers)
    .forEach(item => { allocation[item.skill] += 1; });
  return allocation;
}

/**
 * Builds a deterministic complete daily loop. All allocation is based on
 * supplied server evidence; no random or wall-clock state enters the plan.
 */
export function composeDailyLearningSession(input: DailyLearningSessionInput): DailyLearningSession {
  if (!ALLOWED_MINUTES.has(input.minutes)) {
    throw new RangeError("minutes must be one of 15, 30, 45, or 60");
  }
  localDateOrdinal(input.date);
  const language = requireText(input.language, "language");
  const contentVersion = requireText(input.contentVersion, "contentVersion");
  if (!Number.isInteger(input.dueVocabularyCount) || input.dueVocabularyCount < 0) {
    throw new RangeError("dueVocabularyCount must be a non-negative integer");
  }
  const useCase = bilingualLabel(input.useCase, USE_CASE_LABELS, "useCase");
  const stage = bilingualLabel(input.stage, STAGE_LABELS, "stage");
  const recentScores = Object.fromEntries(SMARTLINGO_DAILY_SKILLS.map(skill => [
    skill,
    boundedScore(input.recentScores[skill], `recentScores.${skill}`),
  ])) as Record<SmartLingoDailySkill, number>;

  const newMaterialMinutes = Math.max(2, Math.round(input.minutes * 0.17));
  const reviewRate = input.dueVocabularyCount > 0 ? 0.12 : 0.06;
  const spacedReviewMinutes = Math.max(1, Math.round(input.minutes * reviewRate));
  const recapMinutes = Math.max(1, Math.round(input.minutes * 0.07));
  const skillBudget = input.minutes - newMaterialMinutes - spacedReviewMinutes - recapMinutes;
  const skillMinutes = allocateSkillMinutes(skillBudget, recentScores);
  const weakestScore = Math.min(...SMARTLINGO_DAILY_SKILLS.map(skill => recentScores[skill]));

  const blocks: DailyLearningBlock[] = [
    {
      id: `${input.date}:new-material`,
      kind: "new_material",
      minutes: newMaterialMinutes,
      rationale: {
        zh: `先用${stage.zh}难度的新情境连接“${useCase.zh}”目标，让今天的输入有清楚用途。`,
        en: `Begin with new ${stage.en}-stage context tied to ${useCase.en}, so today's input has a clear purpose.`,
      },
      sourceType: "smartlingo_original",
    },
    {
      id: `${input.date}:spaced-review`,
      kind: "spaced_review",
      minutes: spacedReviewMinutes,
      rationale: input.dueVocabularyCount > 0
        ? {
            zh: `按到期顺序提取 ${input.dueVocabularyCount} 个词汇项目，用主动回忆巩固长期记忆。`,
            en: `Retrieve ${input.dueVocabularyCount} due vocabulary item${input.dueVocabularyCount === 1 ? "" : "s"} in due order to strengthen long-term memory through active recall.`,
          }
        : {
            zh: "今天没有到期词汇；用一次简短提取预览保持复习节奏，不提前伪造掌握。",
            en: "No vocabulary is due today; use a short retrieval preview to keep the review rhythm without fabricating mastery.",
          },
      sourceType: "smartlingo_original",
    },
    ...SMARTLINGO_DAILY_SKILLS.map((skill): DailyLearningBlock => {
      const label = SKILL_LABELS[skill];
      const isWeakest = recentScores[skill] === weakestScore;
      return {
        id: `${input.date}:practice:${skill}`,
        kind: "skill_practice",
        skill,
        minutes: skillMinutes[skill],
        rationale: {
          zh: `${label.zh}近期分为 ${recentScores[skill]}；${isWeakest ? "作为当前弱项增加针对性练习，" : "用短练习保持技能连接，"}并把内容带回“${useCase.zh}”情境。`,
          en: `Recent ${label.en} score: ${recentScores[skill]}; ${isWeakest ? "give this current weak area targeted extra practice" : "use a short task to keep the skill connected"} and return it to the ${useCase.en} context.`,
        },
        sourceType: "smartlingo_original",
      };
    }),
    {
      id: `${input.date}:recap`,
      kind: "recap",
      minutes: recapMinutes,
      rationale: {
        zh: "最后用自己的话回顾一个新要点和一个待改进点，为下一次间隔复习留下明确线索。",
        en: "Finish by recalling one new point and one point to improve, leaving a clear cue for the next spaced review.",
      },
      sourceType: "smartlingo_original",
    },
  ];
  const totalMinutes = blocks.reduce((total, block) => total + block.minutes, 0);
  if (totalMinutes !== input.minutes) throw new Error("daily session allocation invariant failed");

  return {
    id: `daily:${input.date}:${language}:${contentVersion}:${input.minutes}`,
    minutes: input.minutes,
    totalMinutes: input.minutes,
    language,
    date: input.date,
    contentVersion,
    useCase,
    stage,
    dueVocabularyCount: input.dueVocabularyCount,
    recentScores,
    blocks,
    sourceType: "smartlingo_original",
  };
}

export type DailyAnswerCorrectness = "correct" | "partially_correct" | "incorrect" | "skipped";

export interface DailyAnswerFeedbackInput {
  readonly skill: SmartLingoDailySkill;
  /** A server-produced score. Client correctness claims must not be passed here. */
  readonly score: number;
  readonly skipped: boolean;
  readonly targetForm: string;
  readonly meaning: SmartLingoBilingualText;
  readonly contentVersion: string;
}

export interface DailyAnswerFeedback {
  readonly skill: SmartLingoDailySkill;
  readonly correctness: DailyAnswerCorrectness;
  readonly isCorrect: boolean | null;
  readonly score: number;
  readonly explanation: SmartLingoBilingualText;
  readonly hint: SmartLingoBilingualText;
  readonly disclaimer: SmartLingoBilingualText;
  readonly contentVersion: string;
  readonly scoringBasis: "server_score";
}

/** Creates conservative bilingual feedback from a server score. */
export function buildDailyAnswerFeedback(input: DailyAnswerFeedbackInput): DailyAnswerFeedback {
  if (!SMARTLINGO_DAILY_SKILLS.includes(input.skill)) throw new RangeError("skill is not supported");
  const targetForm = requireText(input.targetForm, "targetForm");
  const meaning = bilingualLabel(input.meaning, {}, "meaning");
  const contentVersion = requireText(input.contentVersion, "contentVersion");
  const score = boundedScore(input.score);
  const correctness: DailyAnswerCorrectness = input.skipped
    ? "skipped"
    : score >= 80
      ? "correct"
      : score >= 40
        ? "partially_correct"
        : "incorrect";

  const explanation: SmartLingoBilingualText = correctness === "correct"
    ? {
        zh: `这次作答正确呈现了“${targetForm}”的核心形式；它表示“${meaning.zh}”。`,
        en: `This answer correctly presents the core form “${targetForm},” meaning “${meaning.en}.”`,
      }
    : correctness === "partially_correct"
      ? {
          zh: `这次作答只部分符合目标，尚未完整呈现“${targetForm}”；它表示“${meaning.zh}”。`,
          en: `This answer is only partially correct and does not yet fully present “${targetForm},” meaning “${meaning.en}.”`,
        }
      : correctness === "incorrect"
        ? {
            zh: `这次作答尚未正确呈现目标形式，不能按正确答案记录；目标是“${targetForm}”，表示“${meaning.zh}”。`,
            en: `This answer does not correctly present the target and must not be recorded as correct; the target is “${targetForm},” meaning “${meaning.en}.”`,
          }
        : {
            zh: `本题已跳过，没有产生正确性判断；可先查看“${targetForm}”及其含义“${meaning.zh}”。`,
            en: `This item was skipped, so no correctness judgment was made; review “${targetForm}” and its meaning, “${meaning.en}.”`,
          };

  const hint: SmartLingoBilingualText = correctness === "correct"
    ? {
        zh: `把“${targetForm}”放进一个新的短句，再不看提示复述一次。`,
        en: `Put “${targetForm}” into a new short sentence, then recall it once without the prompt.`,
      }
    : {
        zh: `先把“${targetForm}”分成易辨认的词块，再把它与“${meaning.zh}”配对重试。`,
        en: `Break “${targetForm}” into recognizable chunks, pair it with “${meaning.en},” and try again.`,
      };

  return {
    skill: input.skill,
    correctness,
    isCorrect: correctness === "skipped" ? null : correctness === "correct",
    score: input.skipped ? 0 : score,
    explanation,
    hint,
    disclaimer: {
      zh: "这是人工智能生成的练习反馈，不是真人教师评价，也不是正式或官方考试结果。",
      en: "This artificial-intelligence practice feedback is not a human teacher evaluation or a formal or official exam result.",
    },
    contentVersion,
    scoringBasis: "server_score",
  };
}

export interface LearningXpInput {
  readonly serverScore: number | null | undefined;
  readonly skipped?: boolean;
  readonly paused?: boolean;
}

export interface LearningXpResult {
  readonly xp: number;
  readonly serverScore: number | null;
  readonly basis: "server_score";
  readonly eligible: boolean;
  readonly hasCashValue: false;
  readonly cashValue: 0;
  readonly cashValueCents: 0;
  readonly notice: SmartLingoBilingualText;
}

/** Learning XP is a server-score-derived motivation signal, never money. */
export function calculateLearningXp(input: LearningXpInput): LearningXpResult {
  const eligible = !input.skipped && !input.paused && typeof input.serverScore === "number" && Number.isFinite(input.serverScore);
  const serverScore = eligible ? boundedScore(input.serverScore as number, "serverScore") : null;
  return {
    xp: serverScore === null ? 0 : Math.round(serverScore / 5),
    serverScore,
    basis: "server_score",
    eligible,
    hasCashValue: false,
    cashValue: 0,
    cashValueCents: 0,
    notice: {
      zh: "学习经验值只用于显示练习进度，不具现金价值，也不是介绍人奖励积分。",
      en: "Learning XP only reflects practice progress; it has no cash value and is not introducer reward credit.",
    },
  };
}

export interface LearningStreakInput {
  readonly localDates: readonly string[];
  readonly today: string;
}

export interface LearningStreakResult {
  readonly current: number;
  readonly longest: number;
  readonly repairedDates: readonly string[];
}

export function calculateLearningStreak(localDates: readonly string[], today: string): LearningStreakResult;
export function calculateLearningStreak(input: LearningStreakInput): LearningStreakResult;
/**
 * Counts learner-local date strings without converting instants between zones.
 * One surrounded single-day gap may be repaired in every rolling 30-day span.
 */
export function calculateLearningStreak(
  datesOrInput: readonly string[] | LearningStreakInput,
  todayArgument?: string,
): LearningStreakResult {
  const usesArrayInput = Array.isArray(datesOrInput);
  const localDates: readonly string[] = usesArrayInput
    ? datesOrInput as readonly string[]
    : (datesOrInput as LearningStreakInput).localDates;
  const today = usesArrayInput ? todayArgument : (datesOrInput as LearningStreakInput).today;
  if (typeof today !== "string") throw new TypeError("today is required");
  const todayOrdinal = localDateOrdinal(today, "today");
  const actual = new Set<number>();
  localDates.forEach((date, index) => {
    const ordinal = localDateOrdinal(date, `localDates[${index}]`);
    if (ordinal <= todayOrdinal) actual.add(ordinal);
  });
  const ordered = [...actual].sort((left, right) => left - right);
  const repairCandidates: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index] - ordered[index - 1] === 2) repairCandidates.push(ordered[index] - 1);
  }
  const repairs: number[] = [];
  for (const candidate of repairCandidates) {
    if (repairs.every(previous => Math.abs(candidate - previous) >= 30)) repairs.push(candidate);
  }

  const effective = new Set([...actual, ...repairs]);
  const effectiveOrdered = [...effective].sort((left, right) => left - right);
  let longest = 0;
  let run = 0;
  let previous: number | undefined;
  for (const ordinal of effectiveOrdered) {
    run = previous !== undefined && ordinal === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = ordinal;
  }

  const currentEnd = effective.has(todayOrdinal)
    ? todayOrdinal
    : effective.has(todayOrdinal - 1)
      ? todayOrdinal - 1
      : null;
  let current = 0;
  if (currentEnd !== null) {
    for (let cursor = currentEnd; effective.has(cursor); cursor -= 1) current += 1;
  }
  return {
    current,
    longest,
    repairedDates: repairs.map(ordinalToLocalDate),
  };
}

/** Stable object-input entry point used by server learning-event handlers. */
export function advanceLearningStreak(input: LearningStreakInput): LearningStreakResult {
  return calculateLearningStreak(input);
}

type JsonRecord = Readonly<Record<string, unknown>>;

export interface CheckpointMergeConflict {
  readonly field: string;
  readonly base: unknown;
  readonly server: unknown;
  readonly client: unknown;
  readonly basePresent: boolean;
  readonly serverPresent: boolean;
  readonly clientPresent: boolean;
  readonly resolution: "manual_required";
}

export interface CheckpointDraftMerge<T extends JsonRecord> {
  readonly merged: Partial<T>;
  readonly conflicts: readonly CheckpointMergeConflict[];
  readonly hasConflicts: boolean;
}

export interface DailyCheckpointDraftMergeInput<T extends JsonRecord> {
  readonly base: T;
  readonly server: T;
  readonly client: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => valuesEqual(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && valuesEqual(left[key], right[key]));
  }
  return false;
}

export interface CheckpointQueueState<TDraft extends object, TStep extends string> {
  readonly draft: TDraft;
  readonly activeStep: TStep;
}

export interface CheckpointQueueReconciliation {
  readonly pendingAlreadyApplied: boolean;
  readonly queuedAlreadyAligned: boolean;
  readonly pendingRequestRemains: boolean;
  readonly needsAnotherOperation: boolean;
  readonly canClearLocalStorage: boolean;
}

/**
 * Reconciles an immutable in-flight request with the latest queued editor state.
 * A response-lost request is cleared only when its exact evidence is visible on
 * the server; later typing then requires a distinct operation identity.
 */
export function reconcileCheckpointQueue<TDraft extends object, TStep extends string>(input: {
  readonly server: CheckpointQueueState<TDraft, TStep>;
  readonly queued: CheckpointQueueState<TDraft, TStep>;
  readonly pending: CheckpointQueueState<TDraft, TStep> | null;
}): CheckpointQueueReconciliation {
  const statesEqual = (
    left: CheckpointQueueState<TDraft, TStep>,
    right: CheckpointQueueState<TDraft, TStep>,
  ) => left.activeStep === right.activeStep && valuesEqual(left.draft, right.draft);
  const pendingAlreadyApplied = input.pending ? statesEqual(input.pending, input.server) : false;
  const queuedAlreadyAligned = statesEqual(input.queued, input.server);
  const pendingRequestRemains = Boolean(input.pending && !pendingAlreadyApplied);
  return {
    pendingAlreadyApplied,
    queuedAlreadyAligned,
    pendingRequestRemains,
    needsAnotherOperation: !pendingRequestRemains && !queuedAlreadyAligned,
    canClearLocalStorage: !pendingRequestRemains && queuedAlreadyAligned,
  };
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    Object.keys(value).forEach(key => {
      Object.defineProperty(result, key, {
        value: cloneValue(value[key]),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    });
    return result as T;
  }
  return value;
}

type MergeNode = {
  readonly present: boolean;
  readonly value?: unknown;
  readonly conflicts: readonly CheckpointMergeConflict[];
};

function mergeNode(
  path: string,
  basePresent: boolean,
  base: unknown,
  serverPresent: boolean,
  server: unknown,
  clientPresent: boolean,
  client: unknown,
): MergeNode {
  const serverChanged = serverPresent !== basePresent || (serverPresent && !valuesEqual(server, base));
  const clientChanged = clientPresent !== basePresent || (clientPresent && !valuesEqual(client, base));
  if (!serverChanged && !clientChanged) return { present: basePresent, value: cloneValue(base), conflicts: [] };
  if (serverChanged && !clientChanged) return { present: serverPresent, value: cloneValue(server), conflicts: [] };
  if (!serverChanged && clientChanged) return { present: clientPresent, value: cloneValue(client), conflicts: [] };
  if (serverPresent === clientPresent && (!serverPresent || valuesEqual(server, client))) {
    return { present: serverPresent, value: cloneValue(server), conflicts: [] };
  }

  // Disjoint edits inside plain objects can still merge. Arrays remain atomic
  // because their indexes usually encode ordered checkpoint events.
  if (serverPresent && clientPresent && isRecord(server) && isRecord(client) && (!basePresent || isRecord(base))) {
    const baseRecord = isRecord(base) ? base : {};
    const result: Record<string, unknown> = {};
    const conflicts: CheckpointMergeConflict[] = [];
    const keys = [...new Set([...Object.keys(baseRecord), ...Object.keys(server), ...Object.keys(client)])].sort();
    for (const key of keys) {
      const child = mergeNode(
        path ? `${path}.${key}` : key,
        hasOwn(baseRecord, key),
        baseRecord[key],
        hasOwn(server, key),
        server[key],
        hasOwn(client, key),
        client[key],
      );
      conflicts.push(...child.conflicts);
      if (child.present) {
        Object.defineProperty(result, key, {
          value: child.value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }
    return { present: true, value: result, conflicts };
  }

  return {
    present: false,
    conflicts: [{
      field: path,
      base: cloneValue(base),
      server: cloneValue(server),
      client: cloneValue(client),
      basePresent,
      serverPresent,
      clientPresent,
      resolution: "manual_required",
    }],
  };
}

/**
 * Performs a field-aware three-way merge. Conflicted values are never silently
 * selected; both sides remain available in the conflict record.
 */
export function mergeCheckpointDrafts<T extends JsonRecord>(
  base: T,
  server: T,
  client: T,
): CheckpointDraftMerge<T> {
  if (!isRecord(base) || !isRecord(server) || !isRecord(client)) {
    throw new TypeError("base, server, and client drafts must be records");
  }
  const merged: Record<string, unknown> = {};
  const conflicts: CheckpointMergeConflict[] = [];
  const keys = [...new Set([...Object.keys(base), ...Object.keys(server), ...Object.keys(client)])].sort();
  for (const key of keys) {
    const result = mergeNode(
      key,
      hasOwn(base, key),
      base[key],
      hasOwn(server, key),
      server[key],
      hasOwn(client, key),
      client[key],
    );
    conflicts.push(...result.conflicts);
    if (result.present) {
      Object.defineProperty(merged, key, {
        value: result.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  return {
    merged: merged as Partial<T>,
    conflicts,
    hasConflicts: conflicts.length > 0,
  };
}

/** Stable object-input entry point used by offline checkpoint sync. */
export function mergeDailyCheckpointDrafts<T extends JsonRecord>(
  input: DailyCheckpointDraftMergeInput<T>,
): CheckpointDraftMerge<T> {
  return mergeCheckpointDrafts(input.base, input.server, input.client);
}
