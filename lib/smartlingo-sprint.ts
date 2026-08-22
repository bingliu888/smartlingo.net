import { buildCourseSentenceBank, normalizeSentenceAnswer, tokenizeSentence } from "./smartlingo-sentence-exercises.ts";
import type { SmartLingoInterfaceLanguage, SmartLingoLearningLanguage, SmartLingoLevel } from "./smartlingo-learning.ts";

export const SPRINT_DURATIONS = [5, 10, 15, 20] as const;
export type SprintDuration = (typeof SPRINT_DURATIONS)[number];

export type SprintVocabulary = {
  id: string;
  form: string;
  pronunciation: string;
  meaning: string;
};

export type SprintRound = {
  number: number;
  vocabulary: SprintVocabulary[];
  reading: { id: string; prompt: string; options: { id: string; label: string }[]; answerId: string };
  listening: { id: string; scenario: string; prompt: string; audioText: string; answerTokens: string[]; expected: string };
  writing: { id: string; scenario: string; prompt: string; answerTokens: string[]; expected: string };
  dialogue: { id: string; prompt: string; audioText: string; expected: string };
};

export type SprintPlan = {
  contentVersion: "smartlingo-sprint-2026-08-21.1";
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

export function buildSprintPlan(input: {
  runId: string;
  language: SmartLingoLearningLanguage;
  level: SmartLingoLevel;
  uiLang: SmartLingoInterfaceLanguage;
  durationMinutes: SprintDuration;
  vocabulary: readonly SprintVocabulary[];
}): SprintPlan {
  const bank = buildCourseSentenceBank(input.language, input.level);
  const roundCount = input.durationMinutes / 5;
  const sprintVocabulary = rotate(input.vocabulary, `${input.runId}:vocabulary`, roundCount * 10);
  const rounds = Array.from({ length: roundCount }, (_, roundIndex) => {
    const seed = `${input.runId}:${roundIndex + 1}`;
    const sentences = rotate(bank, seed, 6);
    const reading = sentences[0];
    const listening = sentences[1];
    const writing = sentences[2];
    const dialogue = sentences[3];
    const distractors = [sentences[4], sentences[5]];
    const options = [reading, ...distractors]
      .map(item => ({ id: item.id, label: promptFor(item, input.uiLang) }))
      .sort((left, right) => hash(`${seed}:${left.id}`) - hash(`${seed}:${right.id}`));
    return {
      number: roundIndex + 1,
      vocabulary: sprintVocabulary.slice(roundIndex * 10, roundIndex * 10 + 10),
      reading: { id: reading.id, prompt: reading.targetSentence, options, answerId: reading.id },
      listening: {
        id: listening.id,
        scenario: listening.scenario,
        prompt: "",
        audioText: listening.targetSentence,
        answerTokens: tokenizeSentence(listening.targetSentence, input.language),
        expected: listening.targetSentence,
      },
      writing: {
        id: writing.id,
        scenario: writing.scenario,
        prompt: promptFor(writing, input.uiLang),
        answerTokens: tokenizeSentence(writing.targetSentence, input.language),
        expected: writing.targetSentence,
      },
      dialogue: { id: dialogue.id, prompt: promptFor(dialogue, input.uiLang), audioText: dialogue.targetSentence, expected: dialogue.targetSentence },
    } satisfies SprintRound;
  });
  return { contentVersion: "smartlingo-sprint-2026-08-21.1", language: input.language, level: input.level, uiLang: input.uiLang, durationMinutes: input.durationMinutes, rounds };
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
