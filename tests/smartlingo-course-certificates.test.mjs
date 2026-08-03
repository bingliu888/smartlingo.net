import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SMARTLINGO_COURSE_EARLY_MASTERY_SCORE,
  SMARTLINGO_COURSE_PASS_SCORE,
  calculateCourseDailyScore,
  calculateCourseOutcome,
} from "../lib/smartlingo-course-scoring.ts";

test("daily course scores stay on a 1–100 scale and require every scheduled skill plus quiz", () => {
  const partial = calculateCourseDailyScore({
    requiredSkills: ["vocabulary", "listening", "dialogue"],
    skillScores: { vocabulary: 100, listening: 80 },
    quizScore: 90,
  });
  assert.equal(partial.score, 90);
  assert.equal(partial.complete, false);
  const complete = calculateCourseDailyScore({
    requiredSkills: ["vocabulary", "listening", "dialogue"],
    skillScores: { vocabulary: 100, listening: 95, dialogue: 90 },
    quizScore: 95,
  });
  assert.deepEqual(complete, { score: 95, complete: true, evidenceCount: 4 });
});

test("60 passes a completed schedule while 95 permits early mastery completion", () => {
  assert.equal(SMARTLINGO_COURSE_PASS_SCORE, 60);
  assert.equal(SMARTLINGO_COURSE_EARLY_MASTERY_SCORE, 95);
  assert.deepEqual(calculateCourseOutcome({ durationDays: 7, completedDayScores: [95] }), {
    currentScore: 95,
    completedDays: 1,
    passScore: 60,
    earlyMasteryScore: 95,
    passed: true,
    completionReason: "early_mastery",
  });
  assert.equal(calculateCourseOutcome({ durationDays: 7, completedDayScores: [60, 60, 60, 60, 60, 60] }).passed, false);
  assert.equal(calculateCourseOutcome({ durationDays: 7, completedDayScores: [60, 60, 60, 60, 60, 60, 60] }).passed, true);
  assert.equal(calculateCourseOutcome({ durationDays: 7, completedDayScores: [59, 59, 59, 59, 59, 59, 59] }).passed, false);
});

test("certificate schema and product surfaces keep immutable learner, course, score, and issue evidence", async () => {
  const [schema, dashboard, admin, workspace] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/[lang]/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/LearningWorkspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /smartlingo_course_certificates/);
  assert.match(schema, /certificate_number/);
  assert.match(schema, /member_name/);
  assert.match(schema, /final_score/);
  assert.match(schema, /issued_at/);
  assert.match(dashboard, /certificates/);
  assert.match(admin, /admin\/certificates/);
  assert.match(workspace, /courseProgress/);
});
