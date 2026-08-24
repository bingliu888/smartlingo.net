import { askSmartAi } from "./smartlingo-ai-gateway";
import {
  SMARTLINGO_SENTENCE_CONTENT_VERSION,
  tokenizeSentence,
  type SmartLingoSentenceExercise,
} from "./smartlingo-sentence-exercises";
import type { SmartLingoInterfaceLanguage, SmartLingoLearningLanguage, SmartLingoLevel } from "./smartlingo-learning";
import type { SprintVocabulary } from "./smartlingo-sprint";

type Database = {
  prepare(sql: string): {
    bind(...values: unknown[]): ReturnType<Database["prepare"]>;
    first<T>(): Promise<T | null>;
    run<T = Record<string, unknown>>(): Promise<{ results?: T[]; success?: boolean }>;
  };
};

type GeneratedSentence = {
  target: string;
  translationZh: string;
  translationEn: string;
  usedWordIds: string[];
};

type GeneratedRound = { sentences: GeneratedSentence[] };

export type AdaptiveSentenceSet = {
  releaseId: string;
  sourceType: "gpt-5.6-luna" | "safe-fallback";
  rounds: SmartLingoSentenceExercise[][];
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeFallback(roundVocabulary: readonly SprintVocabulary[], language: SmartLingoLearningLanguage, level: SmartLingoLevel, roundIndex: number): SmartLingoSentenceExercise[] {
  const usable = roundVocabulary.slice(Math.max(0, roundVocabulary.length - 5));
  return Array.from({ length: 6 }, (_, index) => {
    const word = usable[index % Math.max(1, usable.length)] || roundVocabulary[0];
    const meaning = word?.meaning || word?.form || "";
    return {
      id: `adaptive:fallback:${language}:${roundIndex + 1}:${index + 1}:${word?.id || "word"}`,
      contentVersion: SMARTLINGO_SENTENCE_CONTENT_VERSION,
      language,
      level,
      cefrBand: level === "beginner" ? "A1-aligned" : level === "intermediate" ? "A2-B1-aligned" : "B1+-B2-aligned",
      difficulty: level === "beginner" ? 1 : level === "intermediate" ? 3 : 5,
      frequencyDegree: word?.frequencyDegree || 1,
      sequence: roundIndex * 6 + index + 1,
      scenario: "learned-word-review",
      functionId: "need",
      targetSentence: word?.form || "",
      translation: { zh: meaning, en: meaning },
      anchorVocabulary: word?.form || "",
    };
  });
}

function parseGenerated(value: string, cumulativeVocabulary: readonly SprintVocabulary[][], language: SmartLingoLearningLanguage, level: SmartLingoLevel) {
  const jsonStart = value.indexOf("[");
  const jsonEnd = value.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value.slice(jsonStart, jsonEnd + 1)); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length !== cumulativeVocabulary.length) return null;
  const metadata = level === "beginner"
    ? { cefrBand: "A1-aligned" as const, difficulty: 1 as const }
    : level === "intermediate"
      ? { cefrBand: "A2-B1-aligned" as const, difficulty: 3 as const }
      : { cefrBand: "B1+-B2-aligned" as const, difficulty: 5 as const };
  const rounds: SmartLingoSentenceExercise[][] = [];
  for (let roundIndex = 0; roundIndex < parsed.length; roundIndex += 1) {
    const entry = parsed[roundIndex] as GeneratedRound;
    if (!entry || !Array.isArray(entry.sentences) || entry.sentences.length !== 6) return null;
    const allowed = new Map(cumulativeVocabulary[roundIndex].map(word => [word.id, word]));
    const sentences: SmartLingoSentenceExercise[] = [];
    for (let index = 0; index < entry.sentences.length; index += 1) {
      const candidate = entry.sentences[index];
      const target = cleanText(candidate?.target, 120);
      const translationZh = cleanText(candidate?.translationZh, 180);
      const translationEn = cleanText(candidate?.translationEn, 180);
      const usedWordIds = Array.isArray(candidate?.usedWordIds) ? candidate.usedWordIds.filter(id => typeof id === "string" && allowed.has(id)) : [];
      const anchor = usedWordIds.map(id => allowed.get(id)!).find(word => target.normalize("NFKC").toLocaleLowerCase().includes(word.form.normalize("NFKC").toLocaleLowerCase()));
      if (!target || !translationZh || !translationEn || !anchor || target.length > Math.max(34, cumulativeVocabulary[roundIndex].length * 12)) return null;
      sentences.push({
        id: `adaptive:${language}:${roundIndex + 1}:${index + 1}:${stableHash(target)}`,
        contentVersion: SMARTLINGO_SENTENCE_CONTENT_VERSION,
        language,
        level,
        ...metadata,
        frequencyDegree: anchor.frequencyDegree,
        sequence: roundIndex * 6 + index + 1,
        scenario: "learned-vocabulary",
        functionId: "need",
        targetSentence: target,
        translation: { zh: translationZh, en: translationEn },
        anchorVocabulary: anchor.form,
      });
    }
    rounds.push(sentences);
  }
  return rounds;
}

export async function adaptiveSentenceRounds(input: {
  database: Database;
  language: SmartLingoLearningLanguage;
  level: SmartLingoLevel;
  uiLang: SmartLingoInterfaceLanguage;
  roundVocabulary: readonly SprintVocabulary[][];
}): Promise<AdaptiveSentenceSet> {
  const release = await input.database.prepare(`SELECT release_id AS releaseId FROM smartlingo_learning_content_releases WHERE content_key='adaptive-sentences' LIMIT 1`).first<{ releaseId: string }>();
  const releaseId = release?.releaseId || "bootstrap-2026-08-23";
  const cumulative = input.roundVocabulary.map((_, index) => input.roundVocabulary.slice(0, index + 1).flat());
  const vocabularyIds = cumulative.map(round => round.map(word => word.id));
  const cacheKey = `adaptive:${releaseId}:${input.language}:${input.level}:${input.uiLang}:${stableHash(JSON.stringify(vocabularyIds))}`;
  const cached = await input.database.prepare(`SELECT payload_json AS payloadJson,source_type AS sourceType FROM smartlingo_adaptive_sentence_sets WHERE cache_key=? AND release_id=? LIMIT 1`).bind(cacheKey, releaseId).first<{ payloadJson: string; sourceType: AdaptiveSentenceSet["sourceType"] }>();
  if (cached) {
    try { return { releaseId, sourceType: cached.sourceType, rounds: JSON.parse(cached.payloadJson) as SmartLingoSentenceExercise[][] }; } catch { /* regenerate corrupt cache */ }
  }
  const fallbackRounds = cumulative.map((words, index) => safeFallback(words, input.language, input.level, index));
  const compactVocabulary = cumulative.map((words, roundIndex) => ({
    round: roundIndex + 1,
    allowedWords: words.map(word => ({ id: word.id, form: word.form, meaning: word.meaning, difficulty: word.difficulty, frequency: word.frequencyDegree })),
  }));
  const response = await askSmartAi({
    feature: "content_help",
    subject: `adaptive-sentences:${input.language}:${input.level}`,
    language: input.uiLang,
    instructions: `Create strictly graded language-learning sentences. Return JSON only: an array with one object per supplied round, each object exactly {"sentences":[six objects]}; every sentence object is {"target":"...","translationZh":"...","translationEn":"...","usedWordIds":["..."]}. The target sentence MUST use only content words from that round's allowedWords, although minimal A1 grammar words, particles, articles, pronouns, and inflections are allowed. Every sentence must contain at least one supplied word verbatim and list its exact id. Prefer words added in the current round, then reuse earlier-round words. Never introduce unsupplied names, places, idioms, advanced vocabulary, facts, or cultural assumptions. Beginner sentences are 2-7 words; intermediate 4-11; advanced 6-15. Keep translations literal.`,
    content: JSON.stringify({ targetLanguage: input.language, level: input.level, rounds: compactVocabulary }),
    preserveOnFailure: "",
    deps: { policyOverrides: { content_help: { timeoutMs: 6_000 } } },
  }).catch(() => ({ value: "" }));
  const generated = response.value ? parseGenerated(response.value, cumulative, input.language, input.level) : null;
  const rounds = generated || fallbackRounds;
  const sourceType: AdaptiveSentenceSet["sourceType"] = generated ? "gpt-5.6-luna" : "safe-fallback";
  await input.database.prepare(`INSERT INTO smartlingo_adaptive_sentence_sets(cache_key,release_id,target_language,level,ui_language,vocabulary_ids_json,payload_json,source_type,created_at)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,source_type=excluded.source_type,created_at=excluded.created_at`)
    .bind(cacheKey,releaseId,input.language,input.level,input.uiLang,JSON.stringify(vocabularyIds),JSON.stringify(rounds),sourceType,Math.floor(Date.now()/1000)).run()
    .catch(() => ({ success: false }));
  return { releaseId, sourceType, rounds };
}

export function adaptiveExerciseTokens(exercise: SmartLingoSentenceExercise, answerLanguage: SmartLingoLearningLanguage | SmartLingoInterfaceLanguage) {
  return tokenizeSentence(exercise.targetSentence, answerLanguage);
}
