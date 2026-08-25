import type { SprintAnswer, SprintDuration } from "./smartlingo-sprint";
import type { SmartLingoLearningLanguage } from "./smartlingo-learning";

export const ANONYMOUS_SPRINT_COOKIE = "smartlingo-anonymous-sprint";
export const ANONYMOUS_SPRINT_MAX_AGE = 7200;

const stages = new Set(["vocabulary", "reading", "listening", "writing", "dialogue"]);

export type AnonymousSprintState = {
  runId: string;
  classId: string;
  language: SmartLingoLearningLanguage;
  durationMinutes: SprintDuration;
  dayNumber: number;
  roundIndex: number;
  stage: string;
  wordIndex: number;
  responses: SprintAnswer[];
  remainingSeconds: number;
  updatedAt: number;
};

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

export function parseAnonymousSprintCookie(header: string | null): AnonymousSprintState | null {
  const encoded = header?.split(";").map(item => item.trim()).find(item => item.startsWith(`${ANONYMOUS_SPRINT_COOKIE}=`))?.slice(ANONYMOUS_SPRINT_COOKIE.length + 1);
  if (!encoded) return null;
  try {
    const value = JSON.parse(decodeURIComponent(encoded)) as Partial<AnonymousSprintState>;
    if (typeof value.runId !== "string" || !value.runId || typeof value.classId !== "string" || !value.classId) return null;
    if (typeof value.language !== "string" || !["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"].includes(value.language)) return null;
    if (![5, 10, 15, 20].includes(Number(value.durationMinutes)) || !stages.has(String(value.stage)) || !Array.isArray(value.responses)) return null;
    return {
      runId: value.runId,
      classId: value.classId,
      language: value.language as SmartLingoLearningLanguage,
      durationMinutes: Number(value.durationMinutes) as SprintDuration,
      dayNumber: boundedInteger(value.dayNumber, 1, 21),
      roundIndex: boundedInteger(value.roundIndex, 0, 3),
      stage: String(value.stage),
      wordIndex: boundedInteger(value.wordIndex, 0, 4),
      responses: value.responses.slice(0, 4),
      remainingSeconds: boundedInteger(value.remainingSeconds, 0, 2400),
      updatedAt: boundedInteger(value.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    };
  } catch {
    return null;
  }
}

export function resumeAnonymousSprintState(
  state: AnonymousSprintState | null,
  expected: Pick<AnonymousSprintState, "classId" | "language" | "durationMinutes" | "dayNumber">,
  now: number,
) {
  if (!state || state.classId !== expected.classId || state.language !== expected.language || state.durationMinutes !== expected.durationMinutes || state.dayNumber !== expected.dayNumber) return null;
  const elapsed = Math.max(0, now - state.updatedAt);
  if (!state.updatedAt || elapsed > ANONYMOUS_SPRINT_MAX_AGE) return null;
  return { ...state, remainingSeconds: Math.max(0, state.remainingSeconds - elapsed), updatedAt: now };
}

export function anonymousSprintCookie(state: AnonymousSprintState) {
  return `${ANONYMOUS_SPRINT_COOKIE}=${encodeURIComponent(JSON.stringify(state))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ANONYMOUS_SPRINT_MAX_AGE}`;
}
