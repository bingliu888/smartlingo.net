import { buildCourseSentenceBank, buildSentenceChoiceTokens, normalizeSentenceAnswer, tokenizeSentence } from "./smartlingo-sentence-exercises.ts";
import type { SmartLingoInterfaceLanguage, SmartLingoLearningLanguage, SmartLingoLevel } from "./smartlingo-learning.ts";

export const SPRINT_DURATIONS = [5, 10, 15, 20] as const;
export type SprintDuration = (typeof SPRINT_DURATIONS)[number];

export type SprintVocabulary = {
  id: string;
  form: string;
  pronunciation: string;
  meaning: string;
  difficulty: number;
  frequencyDegree: number;
  gradeLevel: number;
};

export type SprintRound = {
  number: number;
  vocabulary: SprintVocabulary[];
  reading: { id: string; prompt: string; options: { id: string; label: string }[]; answerId: string };
  listening: { id: string; scenario: string; prompt: string; audioText: string; answerTokens: string[]; choiceTokens: string[]; expected: string; sourceLanguage: string; answerLanguage: string };
  writing: { id: string; scenario: string; prompt: string; answerTokens: string[]; choiceTokens: string[]; expected: string; sourceLanguage: string; answerLanguage: string };
  dialogue: { id: string; prompt: string; audioText: string; expected: string };
};

export type SprintPlan = {
  contentVersion: "smartlingo-sprint-2026-08-24.3";
  learningReleaseId: string;
  sentenceSource: "gpt-5.6-luna" | "safe-fallback" | "graded-catalog";
  language: SmartLingoLearningLanguage;
  level: SmartLingoLevel;
  uiLang: SmartLingoInterfaceLanguage;
  durationMinutes: SprintDuration;
  rounds: SprintRound[];
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

function rotate<T>(items: readonly T[], seed: string, count: number) {
  if (!items.length) return [];
  const offset = hash(seed) % items.length;
  const stride = items.length > 37 ? 37 : 1;
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(offset + index * stride) % items.length]);
}

function promptFor(sentence: { translation: { zh: string; en: string } }, lang: SmartLingoInterfaceLanguage) {
  return sentence.translation[lang];
}

function bridgeLanguage(target: SmartLingoLearningLanguage, uiLang: SmartLingoInterfaceLanguage): SmartLingoInterfaceLanguage {
  return target === uiLang ? (uiLang === "zh" ? "en" : "zh") : uiLang;
}

function distinctReadingOptions(
  candidates: readonly { id: string; label: string }[],
  answerId: string,
) {
  const unique = new Map<string, { id: string; label: string }>();
  for (const option of candidates) {
    const key = normalizeSentenceAnswer(option.label);
    if (!key) continue;
    const existing = unique.get(key);
    if (!existing || option.id === answerId) unique.set(key, option);
  }
  return [...unique.values()].slice(0, 3);
}

export function sanitizeSprintPlan(plan: SprintPlan): SprintPlan {
  return {
    ...plan,
    rounds: plan.rounds.map(round => ({
      ...round,
      reading: {
        ...round.reading,
        options: distinctReadingOptions(round.reading.options, round.reading.answerId),
      },
    })),
  };
}

export function buildSprintPlan(input: {
  runId: string;
  language: SmartLingoLearningLanguage;
  level: SmartLingoLevel;
  uiLang: SmartLingoInterfaceLanguage;
  durationMinutes: SprintDuration;
  vocabulary: readonly SprintVocabulary[];
  sentenceRounds?: readonly (readonly ReturnType<typeof buildCourseSentenceBank>[number][])[];
  learningReleaseId?: string;
  sentenceSource?: SprintPlan["sentenceSource"];
}): SprintPlan {
  const bank = buildCourseSentenceBank(input.language, input.level);
  const roundCount = input.durationMinutes / 5;
  const sprintVocabulary = input.vocabulary.slice(0, roundCount * 5);
  const rounds = Array.from({ length: roundCount }, (_, roundIndex) => {
    const seed = `${input.runId}:${roundIndex + 1}`;
    const sentences = input.sentenceRounds?.[roundIndex]?.length === 6 ? [...input.sentenceRounds[roundIndex]] : rotate(bank, seed, 6);
    const reading = sentences[0];
    const listening = sentences[1];
    const writing = sentences[2];
    const dialogue = sentences[3];
    const bridge = bridgeLanguage(input.language, input.uiLang);
    const listeningTokens = tokenizeSentence(promptFor(listening, bridge), bridge);
    const listeningTokenPool = sentences.flatMap(sentence => tokenizeSentence(promptFor(sentence, bridge), bridge));
    const writingTokens = tokenizeSentence(writing.targetSentence, input.language);
    const writingTokenPool = sentences.flatMap(sentence => tokenizeSentence(sentence.targetSentence, input.language));
    const currentReadingOptions = sentences.map(item => ({ id: item.id, label: promptFor(item, bridge) }));
    const fallbackReadingOptions = rotate(bank, `${seed}:reading-options`, bank.length)
      .map(item => ({ id: item.id, label: promptFor(item, bridge) }));
    const options = distinctReadingOptions([
      currentReadingOptions[0],
      ...currentReadingOptions.slice(1).sort((left, right) => hash(`${seed}:${left.id}`) - hash(`${seed}:${right.id}`)),
      ...fallbackReadingOptions,
    ], reading.id);
    return {
      number: roundIndex + 1,
      vocabulary: sprintVocabulary.slice(roundIndex * 5, roundIndex * 5 + 5),
      reading: { id: reading.id, prompt: reading.targetSentence, options, answerId: reading.id },
      listening: {
        id: listening.id,
        scenario: listening.scenario,
        prompt: promptFor(listening, bridge),
        audioText: listening.targetSentence,
        answerTokens: listeningTokens,
        choiceTokens: buildSentenceChoiceTokens(listeningTokens, listeningTokenPool, bridge, `${seed}:listening`),
        expected: promptFor(listening, bridge),
        sourceLanguage: input.language,
        answerLanguage: bridge,
      },
      writing: {
        id: writing.id,
        scenario: writing.scenario,
        prompt: promptFor(writing, bridge),
        answerTokens: writingTokens,
        choiceTokens: buildSentenceChoiceTokens(writingTokens, writingTokenPool, input.language, `${seed}:writing`),
        expected: writing.targetSentence,
        sourceLanguage: bridge,
        answerLanguage: input.language,
      },
      dialogue: { id: dialogue.id, prompt: promptFor(dialogue, input.uiLang), audioText: dialogue.targetSentence, expected: dialogue.targetSentence },
    } satisfies SprintRound;
  });
  return { contentVersion: "smartlingo-sprint-2026-08-24.3", learningReleaseId: input.learningReleaseId || "graded-catalog", sentenceSource: input.sentenceSource || "graded-catalog", language: input.language, level: input.level, uiLang: input.uiLang, durationMinutes: input.durationMinutes, rounds };
}

function transcriptScore(expected: string, actual: string) {
  const expectedWords = new Set(normalizeSentenceAnswer(expected).match(/[\p{L}\p{N}]+/gu) || [normalizeSentenceAnswer(expected)]);
  const actualNormalized = normalizeSentenceAnswer(actual);
  if (!actualNormalized) return 0;
  if (actualNormalized === normalizeSentenceAnswer(expected)) return 100;
  const matches = [...expectedWords].filter(word => actualNormalized.includes(word)).length;
  return Math.round(100 * matches / Math.max(1, expectedWords.size));
}

export type SprintAnswer = {
  vocabularySeen?: string[];
  vocabularyAnswers?: Record<string, string>;
  reading?: string;
  listening?: string;
  writing?: string;
  dialogueTranscript?: string;
};

export function gradeSprintPlan(plan: SprintPlan, responses: readonly SprintAnswer[]) {
  const skillTotals = { vocabulary: 0, reading: 0, listening: 0, writing: 0, dialogue: 0 };
  plan.rounds.forEach((round, index) => {
    const response = responses[index] || {};
    const answers = response.vocabularyAnswers || {};
    const hasAnswerEvidence = Object.keys(answers).length > 0;
    const seen = new Set((response.vocabularySeen || []).map(String));
    skillTotals.vocabulary += Math.round(100 * round.vocabulary.filter(item => hasAnswerEvidence ? answers[item.id] === item.id : seen.has(item.id)).length / Math.max(1, round.vocabulary.length));
    skillTotals.reading += response.reading === round.reading.answerId ? 100 : 0;
    skillTotals.listening += normalizeSentenceAnswer(response.listening || "") === normalizeSentenceAnswer(round.listening.expected) ? 100 : 0;
    skillTotals.writing += normalizeSentenceAnswer(response.writing || "") === normalizeSentenceAnswer(round.writing.expected) ? 100 : 0;
    skillTotals.dialogue += transcriptScore(round.dialogue.expected, response.dialogueTranscript || "");
  });
  const divisor = Math.max(1, plan.rounds.length);
  const skillScores = Object.fromEntries(Object.entries(skillTotals).map(([skill, total]) => [skill, Math.round(total / divisor)]));
  const score = Math.round(Object.values(skillScores).reduce((sum, value) => sum + value, 0) / 5);
  return { score, skillScores };
}
