import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities";

export const SMARTLINGO_LEARNING_CONTENT_VERSION = "2026-08-01.1" as const;

export const SMARTLINGO_LEARNING_LANGUAGE_CODES = [
  "zh",
  "en",
  "es",
  "ja",
  "ko",
  "fr",
  "de",
  "ru",
  "it",
  "pt",
  "ar",
  "hi",
] as const satisfies readonly SmartLingoCommunityLanguage[];

export type SmartLingoLearningLanguage = (typeof SMARTLINGO_LEARNING_LANGUAGE_CODES)[number];

export const SMARTLINGO_SKILLS = [
  "vocabulary",
  "reading",
  "writing",
  "listening",
  "dialogue",
] as const;

export type SmartLingoSkill = (typeof SMARTLINGO_SKILLS)[number];
export type SmartLingoLevel = "beginner" | "intermediate" | "advanced";
export type SmartLingoInterfaceLanguage = "zh" | "en";

export interface BilingualText {
  readonly zh: string;
  readonly en: string;
}

export interface SmartLingoVocabularySample {
  readonly stableId: string;
  readonly version: typeof SMARTLINGO_LEARNING_CONTENT_VERSION;
  readonly language: SmartLingoLearningLanguage;
  readonly level: SmartLingoLevel;
  readonly form: string;
  readonly pronunciation: string;
  readonly meaning: BilingualText;
  readonly example: string;
  readonly exampleTranslation: BilingualText;
  readonly topic: "greeting" | "planning" | "ideas";
  readonly sourceType: "smartlingo_original";
}

export interface SmartLingoVocabularyVisualCue {
  readonly kind: "pictogram";
  readonly symbol: string;
  readonly label: BilingualText;
}

/** A language-neutral cue paired with the learner's interface-language meaning. */
export function getVocabularyVisualCue(
  sample: Pick<SmartLingoVocabularySample, "topic">,
): SmartLingoVocabularyVisualCue {
  if (sample.topic === "greeting") {
    return { kind: "pictogram", symbol: "👋", label: { zh: "见面问候", en: "Greeting someone" } };
  }
  if (sample.topic === "planning") {
    return { kind: "pictogram", symbol: "🗓️", label: { zh: "日程与计划", en: "Schedule and plan" } };
  }
  return { kind: "pictogram", symbol: "💡", label: { zh: "想法与观点", en: "Idea and viewpoint" } };
}

function vocabularySample(
  language: SmartLingoLearningLanguage,
  level: SmartLingoLevel,
  slug: string,
  form: string,
  pronunciation: string,
  meaningZh: string,
  meaningEn: string,
  example: string,
  exampleZh: string,
  exampleEn: string,
  topic: SmartLingoVocabularySample["topic"],
): SmartLingoVocabularySample {
  return {
    stableId: `sl-vocab-${language}-${slug}`,
    version: SMARTLINGO_LEARNING_CONTENT_VERSION,
    language,
    level,
    form,
    pronunciation,
    meaning: { zh: meaningZh, en: meaningEn },
    example,
    exampleTranslation: { zh: exampleZh, en: exampleEn },
    topic,
    sourceType: "smartlingo_original",
  };
}

/**
 * Small, original seed content for deterministic placement and daily-practice
 * fallbacks. It is not a third-party item bank. Public course content should
 * continue to use reviewed, immutable versions before broader publication.
 */
export const SMARTLINGO_VOCABULARY_SAMPLES = {
  zh: [
    vocabularySample("zh", "beginner", "hello-001", "你好", "nǐ hǎo", "问候语：你好", "hello", "你好，很高兴认识你。", "你好，很高兴认识你。", "Hello, it is nice to meet you.", "greeting"),
    vocabularySample("zh", "intermediate", "plan-001", "计划", "jì huà", "为将来安排步骤", "a plan; to plan", "我们先制定今天的学习计划。", "我们先制定今天的学习计划。", "Let us make today's study plan first.", "planning"),
    vocabularySample("zh", "advanced", "weigh-001", "权衡", "quán héng", "比较不同因素后作出判断", "to weigh or balance alternatives", "做决定前，需要权衡时间和效果。", "做决定前，需要权衡时间和效果。", "Before deciding, we need to weigh time and effectiveness.", "ideas"),
  ],
  en: [
    vocabularySample("en", "beginner", "hello-001", "hello", "/həˈloʊ/", "问候语：你好", "a greeting", "Hello, it is good to meet you.", "你好，很高兴认识你。", "Hello, it is good to meet you.", "greeting"),
    vocabularySample("en", "intermediate", "schedule-001", "schedule", "/ˈskedʒuːl/", "时间安排；日程", "a plan of times and activities", "Our study schedule includes a short review each morning.", "我们的学习日程包含每天早上的简短复习。", "Our study schedule includes a short review each morning.", "planning"),
    vocabularySample("en", "advanced", "perspective-001", "perspective", "/pərˈspektɪv/", "看待问题的角度；观点", "a way of viewing a situation", "Listening to another perspective can improve a decision.", "倾听另一种观点可以改善决策。", "Listening to another perspective can improve a decision.", "ideas"),
  ],
  es: [
    vocabularySample("es", "beginner", "hello-001", "hola", "/ˈola/", "问候语：你好", "hello", "Hola, me alegra conocerte.", "你好，很高兴认识你。", "Hello, I am glad to meet you.", "greeting"),
    vocabularySample("es", "intermediate", "schedule-001", "horario", "/oˈɾaɾjo/", "时间表；日程", "schedule or timetable", "Mi horario incluye práctica por la mañana.", "我的日程包括早上的练习。", "My schedule includes practice in the morning.", "planning"),
    vocabularySample("es", "advanced", "perspective-001", "perspectiva", "/peɾspekˈtiβa/", "看待问题的角度；观点", "perspective or point of view", "Otra perspectiva puede cambiar nuestra decisión.", "另一种观点可能改变我们的决定。", "Another perspective can change our decision.", "ideas"),
  ],
  ja: [
    vocabularySample("ja", "beginner", "hello-001", "こんにちは", "konnichiwa", "白天见面时的问候语", "hello; good afternoon", "こんにちは。お会いできてうれしいです。", "你好，很高兴见到你。", "Hello. I am happy to meet you.", "greeting"),
    vocabularySample("ja", "intermediate", "schedule-001", "予定", "yotei", "预定的安排；计划", "plan or schedule", "今日の予定を確認しましょう。", "让我们确认今天的安排。", "Let us check today's schedule.", "planning"),
    vocabularySample("ja", "advanced", "viewpoint-001", "視点", "shiten", "观察或思考问题的角度", "viewpoint or perspective", "別の視点から問題を考えます。", "我们从另一个角度思考问题。", "We consider the problem from another perspective.", "ideas"),
  ],
  ko: [
    vocabularySample("ko", "beginner", "hello-001", "안녕하세요", "annyeonghaseyo", "礼貌的问候语：你好", "a polite hello", "안녕하세요. 만나서 반갑습니다.", "你好，很高兴见到你。", "Hello. It is nice to meet you.", "greeting"),
    vocabularySample("ko", "intermediate", "schedule-001", "일정", "iljeong", "日程；预定安排", "schedule or planned agenda", "오늘 일정을 함께 확인해요.", "我们一起确认今天的日程。", "Let us check today's schedule together.", "planning"),
    vocabularySample("ko", "advanced", "perspective-001", "관점", "gwanjeom", "看待问题的角度；观点", "point of view or perspective", "다른 관점에서 문제를 살펴봅시다.", "让我们从另一个角度看这个问题。", "Let us examine the problem from another perspective.", "ideas"),
  ],
  fr: [
    vocabularySample("fr", "beginner", "hello-001", "bonjour", "/bɔ̃.ʒuʁ/", "白天使用的问候语", "hello; good day", "Bonjour, je suis ravi de vous rencontrer.", "你好，很高兴见到你。", "Hello, I am pleased to meet you.", "greeting"),
    vocabularySample("fr", "intermediate", "schedule-001", "horaire", "/ɔ.ʁɛʁ/", "时间表；日程", "schedule or timetable", "Mon horaire prévoit une révision le matin.", "我的日程安排了早上的复习。", "My schedule includes a review in the morning.", "planning"),
    vocabularySample("fr", "advanced", "perspective-001", "perspective", "/pɛʁ.spɛk.tiv/", "观点；看待问题的角度", "perspective or point of view", "Cette perspective nous aide à mieux décider.", "这个观点帮助我们作出更好的决定。", "This perspective helps us make a better decision.", "ideas"),
  ],
  de: [
    vocabularySample("de", "beginner", "hello-001", "Hallo", "/ˈhaloː/", "问候语：你好", "hello", "Hallo, ich freue mich, dich kennenzulernen.", "你好，很高兴认识你。", "Hello, I am glad to meet you.", "greeting"),
    vocabularySample("de", "intermediate", "schedule-001", "Zeitplan", "/ˈtsaɪ̯tˌplaːn/", "时间表；进度安排", "schedule or timetable", "Unser Zeitplan enthält jeden Morgen eine kurze Wiederholung.", "我们的日程包含每天早上的简短复习。", "Our schedule includes a short review every morning.", "planning"),
    vocabularySample("de", "advanced", "perspective-001", "Perspektive", "/pɛʁspɛkˈtiːvə/", "观点；观察角度", "perspective or point of view", "Eine andere Perspektive kann die Entscheidung verbessern.", "另一种观点可以改善决策。", "Another perspective can improve the decision.", "ideas"),
  ],
  ru: [
    vocabularySample("ru", "beginner", "hello-001", "привет", "privet", "非正式问候语：你好", "an informal hello", "Привет, рад познакомиться.", "你好，很高兴认识你。", "Hello, it is nice to meet you.", "greeting"),
    vocabularySample("ru", "intermediate", "schedule-001", "расписание", "raspisaniye", "时间表；日程", "schedule or timetable", "В расписании есть утреннее повторение.", "日程中有早间复习。", "The schedule includes a morning review.", "planning"),
    vocabularySample("ru", "advanced", "viewpoint-001", "точка зрения", "tochka zreniya", "观点；看待问题的角度", "point of view", "Другая точка зрения помогает принять решение.", "另一种观点有助于作出决定。", "Another point of view helps us make a decision.", "ideas"),
  ],
  it: [
    vocabularySample("it", "beginner", "hello-001", "ciao", "/ˈtʃa.o/", "非正式问候语：你好", "an informal hello", "Ciao, sono felice di conoscerti.", "你好，很高兴认识你。", "Hello, I am happy to meet you.", "greeting"),
    vocabularySample("it", "intermediate", "schedule-001", "programma", "/proˈɡramma/", "计划；日程安排", "plan or schedule", "Il programma include un breve ripasso al mattino.", "日程包括早上的简短复习。", "The schedule includes a short review in the morning.", "planning"),
    vocabularySample("it", "advanced", "perspective-001", "prospettiva", "/prospetˈtiva/", "观点；观察角度", "perspective or point of view", "Una nuova prospettiva può migliorare la scelta.", "新的观点可以改善选择。", "A new perspective can improve the choice.", "ideas"),
  ],
  pt: [
    vocabularySample("pt", "beginner", "hello-001", "olá", "/oˈla/", "问候语：你好", "hello", "Olá, é um prazer conhecer você.", "你好，很高兴认识你。", "Hello, it is a pleasure to meet you.", "greeting"),
    vocabularySample("pt", "intermediate", "schedule-001", "horário", "/oˈɾaɾju/", "时间表；日程", "schedule or timetable", "Meu horário inclui uma revisão pela manhã.", "我的日程包括早上的复习。", "My schedule includes a review in the morning.", "planning"),
    vocabularySample("pt", "advanced", "perspective-001", "perspectiva", "/peʁspeˈtʃivɐ/", "观点；观察角度", "perspective or point of view", "Outra perspectiva pode melhorar a decisão.", "另一种观点可以改善决策。", "Another perspective can improve the decision.", "ideas"),
  ],
  ar: [
    vocabularySample("ar", "beginner", "hello-001", "مرحبًا", "marḥaban", "问候语：你好", "hello", "مرحبًا، سعيد بلقائك.", "你好，很高兴见到你。", "Hello, I am happy to meet you.", "greeting"),
    vocabularySample("ar", "intermediate", "schedule-001", "جدول", "jadwal", "时间表；日程", "schedule or timetable", "يتضمن جدولي مراجعة قصيرة صباحًا.", "我的日程包括早上的简短复习。", "My schedule includes a short review in the morning.", "planning"),
    vocabularySample("ar", "advanced", "perspective-001", "منظور", "manẓūr", "观点；观察角度", "perspective or point of view", "يساعدنا منظور آخر على اتخاذ قرار أفضل.", "另一种观点帮助我们作出更好的决定。", "Another perspective helps us make a better decision.", "ideas"),
  ],
  hi: [
    vocabularySample("hi", "beginner", "hello-001", "नमस्ते", "namaste", "问候语：你好", "hello", "नमस्ते, आपसे मिलकर खुशी हुई।", "你好，很高兴见到你。", "Hello, I am happy to meet you.", "greeting"),
    vocabularySample("hi", "intermediate", "schedule-001", "कार्यक्रम", "kāryakram", "计划；日程安排", "plan or schedule", "आज के कार्यक्रम में सुबह का अभ्यास शामिल है।", "今天的日程包括早上的练习。", "Today's schedule includes morning practice.", "planning"),
    vocabularySample("hi", "advanced", "perspective-001", "दृष्टिकोण", "dṛṣṭikoṇ", "观点；看待问题的角度", "perspective or point of view", "एक नया दृष्टिकोण बेहतर निर्णय में मदद करता है।", "新的观点有助于作出更好的决定。", "A new perspective helps us make a better decision.", "ideas"),
  ],
} as const satisfies Record<SmartLingoLearningLanguage, readonly SmartLingoVocabularySample[]>;

export const SMARTLINGO_PLACEMENT_ESTIMATED_MINUTES = 30 as const;

export const SMARTLINGO_SKILL_ESTIMATED_MINUTES = {
  vocabulary: 1,
  reading: 2,
  writing: 3,
  listening: 2,
  dialogue: 2,
} as const satisfies Record<SmartLingoSkill, number>;

export interface PlacementOption {
  readonly id: string;
  readonly label: BilingualText;
}

type PlacementAnswerSpec =
  | { readonly kind: "choice"; readonly correctOptionId: string }
  | { readonly kind: "constructed"; readonly requiredTerms: readonly string[]; readonly minimumCharacters: number };

export interface PlacementQuestion {
  readonly id: string;
  readonly contentVersion: typeof SMARTLINGO_LEARNING_CONTENT_VERSION;
  readonly language: SmartLingoLearningLanguage;
  readonly skill: SmartLingoSkill;
  readonly round: 1 | 2 | 3;
  readonly level: SmartLingoLevel;
  readonly prompt: BilingualText;
  readonly context?: string | BilingualText;
  readonly audioText?: string;
  readonly options?: readonly PlacementOption[];
  readonly estimatedMinutes: number;
  readonly sourceType: "smartlingo_original";
  readonly answerSpec: PlacementAnswerSpec;
}

export type ClientPlacementQuestion = Omit<PlacementQuestion, "answerSpec">;

export interface AdaptivePlacementObservation {
  readonly skill: SmartLingoSkill;
  readonly round: 1 | 2;
  readonly score: number;
  readonly skipped?: boolean;
}

export interface PlacementAnswerScore {
  readonly questionId: string;
  readonly skill: SmartLingoSkill;
  readonly round: 1 | 2 | 3;
  readonly level: SmartLingoLevel;
  readonly score: number;
  readonly skipped: boolean;
}

export interface PlacementSkillEvaluation {
  readonly skill: SmartLingoSkill;
  readonly score: number;
  readonly roundsCompleted: number;
}

export interface PlacementEvaluation {
  readonly contentVersion: typeof SMARTLINGO_LEARNING_CONTENT_VERSION;
  readonly answeredQuestions: number;
  readonly isComplete: boolean;
  readonly overallScore: number;
  readonly skills: readonly PlacementSkillEvaluation[];
  readonly recommendedLevel: SmartLingoLevel;
  readonly confidence: "low" | "medium" | "high";
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicOrder<T extends { readonly id: string }>(items: readonly T[], seed: string): T[] {
  return [...items]
    .map((item, index) => ({ item, index, rank: stableHash(`${seed}:${index}:${item.id}`) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ item }) => item);
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function adaptLevel(level: SmartLingoLevel, score: number): SmartLingoLevel {
  const ordered: readonly SmartLingoLevel[] = ["beginner", "intermediate", "advanced"];
  const index = ordered.indexOf(level);
  if (score >= 80) return ordered[Math.min(ordered.length - 1, index + 1)];
  if (score <= 40) return ordered[Math.max(0, index - 1)];
  return level;
}

export function getVocabularySample(
  language: SmartLingoLearningLanguage,
  level: SmartLingoLevel,
): SmartLingoVocabularySample {
  const samples = SMARTLINGO_VOCABULARY_SAMPLES[language];
  const sample = samples.find(item => item.level === level);
  if (!sample) throw new Error(`No ${level} vocabulary sample for ${language}`);
  return sample;
}

function buildPlacementQuestion(
  language: SmartLingoLearningLanguage,
  skill: SmartLingoSkill,
  round: 1 | 2 | 3,
  level: SmartLingoLevel,
  seed: string,
  idPrefix = "placement",
): PlacementQuestion {
  const sample = getVocabularySample(language, level);
  const id = `${idPrefix}:${language}:${skill}:r${round}:${level}:${SMARTLINGO_LEARNING_CONTENT_VERSION}`;
  const choices = deterministicOrder(
    SMARTLINGO_VOCABULARY_SAMPLES[language].map(item => ({
      id: item.stableId,
      label: item.meaning,
    })),
    `${seed}:${id}`,
  );
  const shared = {
    id,
    contentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
    language,
    skill,
    round,
    level,
    estimatedMinutes: SMARTLINGO_SKILL_ESTIMATED_MINUTES[skill],
    sourceType: "smartlingo_original" as const,
  } as const;

  if (skill === "vocabulary") {
    return {
      ...shared,
      prompt: {
        zh: `选择“${sample.form}”最准确的意思。`,
        en: `Choose the most accurate meaning of “${sample.form}”.`,
      },
      context: sample.pronunciation,
      options: choices,
      answerSpec: { kind: "choice", correctOptionId: sample.stableId },
    };
  }

  if (skill === "reading") {
    return {
      ...shared,
      prompt: {
        zh: `阅读句子，然后选择其中“${sample.form}”表达的意思。`,
        en: `Read the sentence, then choose what “${sample.form}” expresses.`,
      },
      context: sample.example,
      options: choices,
      answerSpec: { kind: "choice", correctOptionId: sample.stableId },
    };
  }

  if (skill === "listening") {
    return {
      ...shared,
      prompt: {
        zh: "播放句子，听完后选择核心词语表达的意思。",
        en: "Play the sentence, then choose the meaning expressed by its key phrase.",
      },
      audioText: sample.example,
      options: choices,
      answerSpec: { kind: "choice", correctOptionId: sample.stableId },
    };
  }

  if (skill === "writing") {
    return {
      ...shared,
      prompt: {
        zh: `使用“${sample.form}”写一个完整、自然的句子。`,
        en: `Write one complete, natural sentence using “${sample.form}”.`,
      },
      context: sample.meaning,
      answerSpec: {
        kind: "constructed",
        requiredTerms: [sample.form],
        minimumCharacters: Math.max(4, sample.form.length + 2),
      },
    };
  }

  return {
    ...shared,
    prompt: {
      zh: `在简短对话中使用“${sample.form}”自然回应对方。`,
      en: `Use “${sample.form}” in a natural, short reply to another person.`,
    },
    context: round === 1
      ? { zh: "一位新同学向你问好。", en: "A new classmate greets you." }
      : round === 2
        ? { zh: "一位同学询问你的计划。", en: "A classmate asks about your plan." }
        : { zh: "小组决定前，一位同学询问你的看法。", en: "A classmate asks for your view before a group decision." },
    answerSpec: {
      kind: "constructed",
      requiredTerms: [sample.form],
      minimumCharacters: Math.max(4, sample.form.length + 2),
    },
  };
}

/**
 * Generates exactly fifteen questions: five skills across three rounds. Each
 * skill begins at intermediate. Its next round moves up, down, or stays put
 * from that skill's preceding deterministic score.
 */
export function generateAdaptivePlacementQuestions(
  language: SmartLingoLearningLanguage,
  observations: readonly AdaptivePlacementObservation[] = [],
  seed = "smartlingo-placement",
): PlacementQuestion[] {
  const questions: PlacementQuestion[] = [];
  const currentLevels = new Map<SmartLingoSkill, SmartLingoLevel>(
    SMARTLINGO_SKILLS.map(skill => [skill, "intermediate"]),
  );

  for (const round of [1, 2, 3] as const) {
    for (const skill of SMARTLINGO_SKILLS) {
      if (round > 1) {
        const prior = observations.find(item => item.skill === skill && item.round === round - 1);
        if (prior) {
          const level = currentLevels.get(skill) ?? "intermediate";
          currentLevels.set(skill, adaptLevel(level, prior.skipped ? 0 : clampScore(prior.score)));
        }
      }
      questions.push(buildPlacementQuestion(
        language,
        skill,
        round,
        currentLevels.get(skill) ?? "intermediate",
        seed,
      ));
    }
  }

  return questions;
}

export function toClientPlacementQuestion(question: PlacementQuestion): ClientPlacementQuestion {
  const { answerSpec: _answerSpec, ...safeQuestion } = question;
  void _answerSpec;
  return safeQuestion;
}

export function toClientPlacementQuestions(
  questions: readonly PlacementQuestion[],
): ClientPlacementQuestion[] {
  return questions.map(toClientPlacementQuestion);
}

function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
    .replace(/[.,!?;:،。！？；：'"“”‘’()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scorePlacementAnswer(
  question: PlacementQuestion,
  answer: string | null | undefined,
  skipped = false,
): PlacementAnswerScore {
  let score = 0;
  if (!skipped && typeof answer === "string" && answer.trim()) {
    if (question.answerSpec.kind === "choice") {
      score = answer === question.answerSpec.correctOptionId ? 100 : 0;
    } else {
      const normalized = normalizeAnswer(answer);
      const hasRequiredTerm = question.answerSpec.requiredTerms.some(term =>
        normalized.includes(normalizeAnswer(term)),
      );
      const hasEnoughContent = Array.from(normalized).length >= question.answerSpec.minimumCharacters;
      score = hasRequiredTerm && hasEnoughContent ? 100 : hasEnoughContent ? 60 : hasRequiredTerm ? 45 : 0;
    }
  }

  return {
    questionId: question.id,
    skill: question.skill,
    round: question.round,
    level: question.level,
    score,
    skipped,
  };
}

export function recommendPlacementLevel(
  overallScore: number,
  skillScores: Readonly<Record<SmartLingoSkill, number>>,
): SmartLingoLevel {
  const balancedScores = SMARTLINGO_SKILLS.map(skill => clampScore(skillScores[skill]));
  if (overallScore >= 80 && balancedScores.every(score => score >= 65)) return "advanced";
  if (overallScore >= 55 && balancedScores.every(score => score >= 40)) return "intermediate";
  return "beginner";
}

export function evaluatePlacement(
  scores: readonly PlacementAnswerScore[],
): PlacementEvaluation {
  const uniqueScores = new Map<string, PlacementAnswerScore>();
  for (const score of scores) uniqueScores.set(score.questionId, score);
  const values = [...uniqueScores.values()];
  const skills = SMARTLINGO_SKILLS.map(skill => {
    const skillValues = values.filter(item => item.skill === skill).slice(0, 3);
    const score = skillValues.length
      ? Math.round(skillValues.reduce((total, item) => total + clampScore(item.score), 0) / skillValues.length)
      : 0;
    return { skill, score, roundsCompleted: skillValues.length } satisfies PlacementSkillEvaluation;
  });
  const scoreRecord = Object.fromEntries(skills.map(item => [item.skill, item.score])) as Record<SmartLingoSkill, number>;
  const overallScore = Math.round(
    skills.reduce((total, item) => total + item.score, 0) / SMARTLINGO_SKILLS.length,
  );
  const answeredQuestions = values.length;

  return {
    contentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
    answeredQuestions,
    isComplete: SMARTLINGO_SKILLS.every(skill =>
      values.filter(item => item.skill === skill).length >= 3,
    ),
    overallScore,
    skills,
    recommendedLevel: recommendPlacementLevel(overallScore, scoreRecord),
    confidence: answeredQuestions >= 15 ? "high" : answeredQuestions >= 8 ? "medium" : "low",
  };
}

export const SMARTLINGO_VOCABULARY_REVIEW_MODES = [
  "recognition",
  "recall",
  "listening",
  "spelling",
  "cloze",
] as const;

export type VocabularyReviewMode = (typeof SMARTLINGO_VOCABULARY_REVIEW_MODES)[number];
export type VocabularyReviewGrade = "again" | "hard" | "good" | "easy" | "suspend";
export type VocabularyReviewStatus = "learning" | "review" | "mastered" | "suspended";

export interface VocabularyReviewState {
  readonly sampleId: string;
  readonly status: VocabularyReviewStatus;
  readonly intervalDays: number;
  readonly dueAt: number | null;
  readonly consecutiveCorrect: number;
  readonly recentCorrectModes: readonly VocabularyReviewMode[];
  readonly lapseCount: number;
  readonly lastGrade: VocabularyReviewGrade | null;
  readonly lastReviewedAt: number | null;
}

export interface VocabularyReviewEvent {
  readonly grade: VocabularyReviewGrade;
  readonly mode: VocabularyReviewMode;
  readonly reviewedAt: number;
}

const DAY_MS = 86_400_000;

export function createVocabularyReviewState(
  sampleId: string,
  dueAt = Date.now(),
): VocabularyReviewState {
  return {
    sampleId,
    status: "learning",
    intervalDays: 0,
    dueAt,
    consecutiveCorrect: 0,
    recentCorrectModes: [],
    lapseCount: 0,
    lastGrade: null,
    lastReviewedAt: null,
  };
}

export function scheduleVocabularyReview(
  state: VocabularyReviewState,
  event: VocabularyReviewEvent,
): VocabularyReviewState {
  if (!Number.isFinite(event.reviewedAt)) throw new Error("reviewedAt must be a finite timestamp");
  if (event.grade === "suspend") {
    return {
      ...state,
      status: "suspended",
      dueAt: null,
      lastGrade: event.grade,
      lastReviewedAt: event.reviewedAt,
    };
  }

  if (event.grade === "again") {
    return {
      ...state,
      status: "learning",
      intervalDays: 0,
      dueAt: event.reviewedAt + 10 * 60_000,
      consecutiveCorrect: 0,
      recentCorrectModes: [],
      lapseCount: state.lapseCount + 1,
      lastGrade: event.grade,
      lastReviewedAt: event.reviewedAt,
    };
  }

  const recentCorrectModes = [...state.recentCorrectModes, event.mode].slice(-3);
  const consecutiveCorrect = Math.min(3, state.consecutiveCorrect + 1);
  const mastered = consecutiveCorrect >= 3 && new Set(recentCorrectModes).size >= 3;
  const multiplier = event.grade === "hard" ? 1.2 : event.grade === "good" ? 2.5 : 4;
  const minimumDays = event.grade === "hard" ? 1 : event.grade === "good" ? 2 : 4;
  const intervalDays = Math.max(minimumDays, Math.round(Math.max(1, state.intervalDays) * multiplier));

  return {
    ...state,
    status: mastered ? "mastered" : "review",
    intervalDays,
    dueAt: event.reviewedAt + intervalDays * DAY_MS,
    consecutiveCorrect,
    recentCorrectModes,
    lastGrade: event.grade,
    lastReviewedAt: event.reviewedAt,
  };
}

export function selectNextVocabularyReviewMode(
  state: VocabularyReviewState,
): VocabularyReviewMode {
  const unused = SMARTLINGO_VOCABULARY_REVIEW_MODES.find(
    mode => !state.recentCorrectModes.includes(mode),
  );
  if (unused) return unused;
  return SMARTLINGO_VOCABULARY_REVIEW_MODES[
    stableHash(`${state.sampleId}:${state.lastReviewedAt ?? 0}`) % SMARTLINGO_VOCABULARY_REVIEW_MODES.length
  ];
}

export interface DailyPracticeItem {
  readonly taskId: string;
  readonly contentVersion: typeof SMARTLINGO_LEARNING_CONTENT_VERSION;
  readonly language: SmartLingoLearningLanguage;
  readonly skill: SmartLingoSkill;
  readonly level: SmartLingoLevel;
  readonly date: string;
  readonly prompt: string;
  readonly context?: string;
  readonly audioText?: string;
  readonly options?: readonly { readonly id: string; readonly label: string }[];
  readonly estimatedMinutes: number;
  readonly direction: "ltr" | "rtl";
}

function assertIsoDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must use YYYY-MM-DD");
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("date must be a valid calendar date");
  }
}

function localize(text: BilingualText, uiLang: SmartLingoInterfaceLanguage): string {
  return text[uiLang];
}

function buildDailyInternalQuestion(
  language: SmartLingoLearningLanguage,
  skill: SmartLingoSkill,
  date: string,
  levelOverride?: SmartLingoLevel,
): PlacementQuestion {
  assertIsoDate(date);
  const hash = stableHash(`${date}:${language}:${skill}:${SMARTLINGO_LEARNING_CONTENT_VERSION}`);
  const levels: readonly SmartLingoLevel[] = ["beginner", "intermediate", "advanced"];
  const level = levelOverride ?? levels[hash % levels.length];
  const round = ((hash % 3) + 1) as 1 | 2 | 3;
  const question = buildPlacementQuestion(language, skill, round, level, date, "daily");
  return {
    ...question,
    id: `daily:${date}:${language}:${skill}:${SMARTLINGO_LEARNING_CONTENT_VERSION}`,
  };
}

/** Returns a localized client-safe daily task; no scoring key is included. */
export function buildDailyPracticeItem(
  language: SmartLingoLearningLanguage,
  skill: SmartLingoSkill,
  date: string,
  uiLang: SmartLingoInterfaceLanguage,
  levelOverride?: SmartLingoLevel,
): DailyPracticeItem {
  const question = buildDailyInternalQuestion(language, skill, date, levelOverride);
  return {
    taskId: question.id,
    contentVersion: question.contentVersion,
    language,
    skill,
    level: question.level,
    date,
    prompt: localize(question.prompt, uiLang),
    context: typeof question.context === "string" ? question.context : question.context?.[uiLang],
    audioText: question.audioText,
    options: question.options?.map(option => ({ id: option.id, label: localize(option.label, uiLang) })),
    estimatedMinutes: question.estimatedMinutes,
    direction: language === "ar" ? "rtl" : "ltr",
  };
}

/** Reconstructs the immutable daily task server-side before deterministic grading. */
export function gradeDailyPracticeItem(
  language: SmartLingoLearningLanguage,
  skill: SmartLingoSkill,
  date: string,
  answer: string | null | undefined,
  skipped = false,
  levelOverride?: SmartLingoLevel,
): PlacementAnswerScore {
  return scorePlacementAnswer(buildDailyInternalQuestion(language, skill, date, levelOverride), answer, skipped);
}
