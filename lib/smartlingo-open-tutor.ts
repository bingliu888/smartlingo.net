import { isSmartLingoCommunityLanguage, SMARTLINGO_LANGUAGE_COMMUNITIES, type SmartLingoCommunityLanguage } from "./smartlingo-language-communities";
import { interfaceLanguages, isInterfaceLanguage, type InterfaceLanguage } from "./interface-locale";
import { SMARTLINGO_DAILY_MINUTES, SMARTLINGO_USE_CASES, type SmartLingoDailyMinutes, type SmartLingoUseCase } from "./smartlingo-paths";

export const OPEN_TUTOR_MAX_TURNS = 180;
export const OPEN_TUTOR_TRIAL_SECONDS = 10 * 60;
export const OPEN_TUTOR_PAID_SECONDS = 30 * 60;
export const OPEN_TUTOR_MAX_MESSAGE_LENGTH = 800;
export const OPEN_TUTOR_ACTIVE_TICK_SECONDS = 30;

export type OpenTutorLevel = "unknown" | "beginner" | "intermediate" | "advanced";
export type OpenTutorProfile = {
  level: OpenTutorLevel;
  levelReason: string;
  interests: string;
  useCase: SmartLingoUseCase;
  dailyMinutes: SmartLingoDailyMinutes;
  planFocus: string;
};

export function resolveOpenTutorMission(input: { language?: unknown; uiLanguage?: unknown }) {
  if (typeof input.language !== "string" || !isSmartLingoCommunityLanguage(input.language)) return null;
  if (typeof input.uiLanguage !== "string" || !isInterfaceLanguage(input.uiLanguage)) return null;
  return {
    language: SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === input.language)!,
    uiLanguage: input.uiLanguage as InterfaceLanguage,
  };
}

export function openTutorOpening(language: SmartLingoCommunityLanguage) {
  const openings: Record<SmartLingoCommunityLanguage, string> = {
    zh: "你好！我是 SmartLingo AI 导师。今天想聊什么？",
    en: "Hi! I’m your SmartLingo AI tutor. What shall we talk about?",
    es: "¡Hola! Soy tu tutor de IA. ¿De qué hablamos hoy?",
    ja: "こんにちは！AIの先生です。今日は何を話しましょうか？",
    ko: "안녕하세요! AI 선생님이에요. 오늘 무엇을 이야기할까요?",
    fr: "Bonjour ! Je suis votre tuteur IA. De quoi parlons-nous ?",
    de: "Hallo! Ich bin dein KI-Tutor. Worüber sprechen wir heute?",
    ru: "Привет! Я ваш ИИ-наставник. О чём поговорим?",
    it: "Ciao! Sono il tuo tutor IA. Di cosa parliamo oggi?",
    pt: "Olá! Sou seu tutor de IA. Sobre o que conversamos hoje?",
    ar: "مرحبًا! أنا معلّمك الذكي. عمّ نتحدث اليوم؟",
    hi: "नमस्ते! मैं आपका AI शिक्षक हूँ। आज किस बारे में बात करें?",
  };
  return openings[language];
}

export function defaultOpenTutorProfile(): OpenTutorProfile {
  return { level: "unknown", levelReason: "", interests: "", useCase: "daily_life", dailyMinutes: 10, planFocus: "" };
}

export function readOpenTutorProfile(value: string): OpenTutorProfile {
  let parsed: Record<string, unknown> = {};
  try {
    const candidate = JSON.parse(value) as unknown;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) parsed = candidate as Record<string, unknown>;
  } catch { /* Empty/corrupt context starts fresh. */ }
  const defaults = defaultOpenTutorProfile();
  return {
    level: ["unknown", "beginner", "intermediate", "advanced"].includes(String(parsed.level)) ? parsed.level as OpenTutorLevel : defaults.level,
    levelReason: typeof parsed.levelReason === "string" ? parsed.levelReason.slice(0, 160) : "",
    interests: typeof parsed.interests === "string" ? parsed.interests.slice(0, 160) : "",
    useCase: SMARTLINGO_USE_CASES.includes(parsed.useCase as SmartLingoUseCase) ? parsed.useCase as SmartLingoUseCase : defaults.useCase,
    dailyMinutes: SMARTLINGO_DAILY_MINUTES.includes(parsed.dailyMinutes as SmartLingoDailyMinutes) ? parsed.dailyMinutes as SmartLingoDailyMinutes : defaults.dailyMinutes,
    planFocus: typeof parsed.planFocus === "string" ? parsed.planFocus.slice(0, 240) : "",
  };
}

export function parseOpenTutorReply(value: string, prior: OpenTutorProfile, answeredTurns: number) {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let result: Record<string, unknown>;
  try { result = JSON.parse(trimmed) as Record<string, unknown>; } catch { return null; }
  const reply = typeof result.reply === "string" ? result.reply.trim().slice(0, 1_200) : "";
  if (!reply || typeof result.reply !== "string" || result.reply.length > 2_000) return null;
  const next = readOpenTutorProfile(JSON.stringify({ ...prior, ...result }));
  if (result.level !== undefined && !["unknown", "beginner", "intermediate", "advanced"].includes(String(result.level))) {
    next.level = prior.level;
    next.levelReason = prior.levelReason;
  }
  // One short learner answer is not evidence for a placement judgment.
  if (answeredTurns < 2) { next.level = prior.level; next.levelReason = prior.levelReason; }
  return { reply, profile: next };
}

export function openTutorInstructions(mission: NonNullable<ReturnType<typeof resolveOpenTutorMission>>, turn: number, shortAnswer = false) {
  const interfaceLanguage = interfaceLanguages.find(item => item.code === mission.uiLanguage)?.nameEn || "English";
  const answerLength = shortAnswer ? "one short sentence of at most 12 words" : "one or two short conversational sentences";
  return `You are a clearly disclosed AI language tutor, not a real person. Have a warm, natural one-to-one conversation with a learner of ${mission.language.nameEn} (${mission.language.nativeName}). This is OPEN conversation, not a fixed scenario. The learner chooses topics; welcome ordinary questions about interests, daily life, work, culture or other safe subjects. First get to know their motivation and interests. Over several real learner turns, estimate beginner/intermediate/advanced from their actual ${mission.language.nameEn} production, with uncertainty; never treat one short sentence or only ${interfaceLanguage} support-language text as reliable target-language evidence. If evidence is insufficient, keep level unknown. Adapt the complexity of your target-language replies to the evidence. Gently correct at most one useful error per turn, then ask one relevant follow-up. Write the reply in ${mission.language.nameEn}, not ${interfaceLanguage}; only give brief ${interfaceLanguage} support if explicitly requested. Collaboratively propose a practical 5/10/15/20-minute daily learning plan based on the learner's goals, but never claim to save it until the learner confirms in the UI. Turn ${turn}; keep the conversation on the learner's chosen subject rather than forcing a lesson script. Do not claim to be human, to have a life or physical presence, to know confidential facts, or to remember beyond the provided context. High-stakes medical, legal and financial questions require qualified sources rather than professional advice. Never claim an official test score or credential. Return JSON ONLY, with keys reply (${answerLength}), level (unknown/beginner/intermediate/advanced), levelReason (short evidence or empty), interests (short summary, no sensitive details), useCase (daily_life/travel/work/study/community), dailyMinutes (5/10/15/20), planFocus (one concise actionable focus). No Markdown or extra keys.`;
}

export function openTutorTurnContent(history: { learner: string; tutor: string }[], message: string, opening: string, profile: OpenTutorProfile) {
  return JSON.stringify({ tutorOpening: opening, profile, priorExchanges: history.slice(-8), learnerMessage: message });
}

export function validOpenTutorMessage(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= OPEN_TUTOR_MAX_MESSAGE_LENGTH;
}
