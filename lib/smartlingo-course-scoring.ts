import type { SmartLingoSkill } from "./smartlingo-learning";

export const SMARTLINGO_COURSE_PASS_SCORE = 60 as const;
export const SMARTLINGO_COURSE_EARLY_MASTERY_SCORE = 95 as const;

export type CourseDailyScoreInput = {
  requiredSkills: readonly SmartLingoSkill[];
  skillScores: Partial<Record<SmartLingoSkill, number | null | undefined>>;
  quizScore: number | null | undefined;
};

export type CourseOutcomeInput = {
  durationDays: number;
  completedDayScores: readonly number[];
};

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateCourseDailyScore(input: CourseDailyScoreInput) {
  const requiredSkills = [...new Set(input.requiredSkills)];
  const evidence = requiredSkills.flatMap(skill => {
    const value = input.skillScores[skill];
    return typeof value === "number" && Number.isFinite(value) ? [boundedScore(value)] : [];
  });
  if (typeof input.quizScore === "number" && Number.isFinite(input.quizScore)) {
    evidence.push(boundedScore(input.quizScore));
  }
  const complete = requiredSkills.every(skill => {
    const value = input.skillScores[skill];
    return typeof value === "number" && Number.isFinite(value);
  }) && typeof input.quizScore === "number" && Number.isFinite(input.quizScore);
  const score = evidence.length
    ? Math.max(1, Math.round(evidence.reduce((total, value) => total + value, 0) / evidence.length))
    : null;
  return { score, complete, evidenceCount: evidence.length };
}

export function calculateCourseOutcome(input: CourseOutcomeInput) {
  const validScores = input.completedDayScores
    .filter(value => Number.isFinite(value))
    .map(boundedScore);
  const currentScore = validScores.length
    ? Math.max(1, Math.round(validScores.reduce((total, value) => total + value, 0) / validScores.length))
    : null;
  const completedDays = validScores.length;
  const earlyMastery = currentScore !== null
    && currentScore >= SMARTLINGO_COURSE_EARLY_MASTERY_SCORE
    && completedDays >= 1;
  const completedSchedule = completedDays >= input.durationDays;
  const passed = currentScore !== null
    && currentScore >= SMARTLINGO_COURSE_PASS_SCORE
    && (earlyMastery || completedSchedule);
  return {
    currentScore,
    completedDays,
    passScore: SMARTLINGO_COURSE_PASS_SCORE,
    earlyMasteryScore: SMARTLINGO_COURSE_EARLY_MASTERY_SCORE,
    passed,
    completionReason: passed ? earlyMastery ? "early_mastery" as const : "course_complete" as const : null,
  };
}
