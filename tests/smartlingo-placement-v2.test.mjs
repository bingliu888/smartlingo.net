import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SMARTLINGO_LEARNING_LANGUAGE_CODES,
  SMARTLINGO_PLACEMENT_CONTENT_VERSION,
  SMARTLINGO_SKILLS,
  evaluatePlacement,
  generateAdaptivePlacementQuestions,
  scorePlacementAnswer,
  toClientPlacementQuestions,
} from "../lib/smartlingo-learning.ts";
import { fixedCourseId } from "../lib/smartlingo-course-packages.ts";
import { buildQuickCourse } from "../lib/smartlingo-quick-courses.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("placement uses distinct scenes and four non-leaking choices in every supported language", () => {
  for (const language of SMARTLINGO_LEARNING_LANGUAGE_CODES) {
    const questions = generateAdaptivePlacementQuestions(language, [], `coverage-${language}`);
    assert.equal(questions.length, 15);
    assert.equal(new Set(questions.map(question => question.id)).size, 15);
    assert.equal(new Set(questions.map(question => question.scenarioId)).size, 12);
    assert.ok(questions.every(question => question.contentVersion === SMARTLINGO_PLACEMENT_CONTENT_VERSION));
    for (const skill of SMARTLINGO_SKILLS) {
      assert.equal(new Set(questions.filter(question => question.skill === skill).map(question => question.scenarioId)).size, 3);
    }
    for (const question of questions) {
      if (question.answerSpec.kind === "choice") {
        assert.equal(question.options?.length, 4, `${language}: ${question.id}`);
        assert.equal(new Set(question.options.map(option => option.id)).size, 4);
        assert.equal(new Set(question.options.map(option => option.label.en)).size, 4);
        assert.equal(new Set(question.options.map(option => option.label.zh)).size, 4);
        assert.ok(question.options.some(option => option.id === question.answerSpec.correctOptionId));
        if (question.context) {
          assert.ok(question.options.every(option => option.label.en !== question.context && option.label.zh !== question.context));
        }
      } else {
        assert.ok(question.answerSpec.referenceAnswer.includes(question.answerSpec.requiredTerms[0]));
        assert.notEqual(question.context?.en, question.answerSpec.referenceAnswer);
        assert.notEqual(question.context?.zh, question.answerSpec.referenceAnswer);
      }
    }
    assert.ok(toClientPlacementQuestions(questions).every(question => !("answerSpec" in question)));
  }
});

test("advanced recommendation requires actual upper-band sentence evidence", () => {
  const advance = SMARTLINGO_SKILLS.flatMap(skill => [
    { skill, round: 1, score: 100 },
    { skill, round: 2, score: 100 },
  ]);
  const questions = generateAdaptivePlacementQuestions("ja", advance, "advanced-evidence");
  const perfect = questions.map(question => scorePlacementAnswer(question,
    question.answerSpec.kind === "choice" ? question.answerSpec.correctOptionId : question.answerSpec.referenceAnswer));
  assert.equal(evaluatePlacement(perfect).recommendedLevel, "advanced");

  const vocabularyOnlyAdvanced = perfect.map(score => score.skill === "vocabulary" ? score : {
    ...score, level: "beginner", score: 100,
  });
  assert.notEqual(evaluatePlacement(vocabularyOnlyAdvanced).recommendedLevel, "advanced");

  const missingDialogue = perfect.map(score => score.skill === "dialogue" ? { ...score, score: 0, skipped: true } : score);
  const incompleteEvidence = evaluatePlacement(missingDialogue);
  assert.equal(incompleteEvidence.confidence, "low");
  assert.equal(incompleteEvidence.skills.find(skill => skill.skill === "dialogue")?.roundsCompleted, 0);
  assert.equal(incompleteEvidence.recommendedLevel, "beginner", "no assessed speaking evidence means no higher-band placement");
});

test("recommended course ID opens the corresponding next lesson and keeps manual override", async () => {
  const [assessment, learning, studio, enroll] = await Promise.all([
    read("../components/PlacementAssessment.tsx"),
    read("../app/api/classes/[classId]/learning/route.ts"),
    read("../components/ClassStudio.tsx"),
    read("../app/api/classes/[classId]/enroll/route.ts"),
  ]);
  for (const [level, tier, days] of [
    ["beginner", "basic", 7], ["intermediate", "intermediate", 30], ["advanced", "advanced", 90],
  ]) {
    assert.equal(fixedCourseId("ja", tier), `course_ja_${tier}`);
    const course = buildQuickCourse("ja", days, level);
    assert.equal(course.level, level);
    assert.ok(course.schedule[0]?.scene?.en);
  }
  assert.match(assessment, /recommendedLevel === "beginner" \? "basic" : state\.attempt\.recommendedLevel/);
  assert.match(assessment, /href=\{`\/\$\{routeLang\}\/classes\/\$\{encodeURIComponent\(recommendedCourse\)\}`\}/);
  assert.match(assessment, /className="placement-manual placement-manual-result"/);
  assert.match(assessment, /action: "restart", mode: level/);
  assert.match(learning, /access\.classKind === "official_course"[^]*fixedCoursePlacement\(access\)/);
  assert.match(learning, /buildQuickCourse\(targetLanguage, quickEnrollment\.durationDays as SmartLingoCourseDays, quickEnrollment\.level\)/);
  assert.match(studio, /joinCourse\(item\.id, Boolean\(detail\.courseAccess\?\.trialAvailable && !accessAllowed\)\)/);
  assert.match(enroll, /startMaxTrial: course\.packageTier !== "basic" && startMaxTrial/);
});

test("old placement content cannot be mixed with the new bank or counted as skipped proficiency", async () => {
  const [route, assessment] = await Promise.all([
    read("../app/api/classes/[classId]/placement/route.ts"),
    read("../components/PlacementAssessment.tsx"),
  ]);
  assert.match(route, /restartRequired = rows\.some\(row => row\.itemVersion !== SMARTLINGO_PLACEMENT_CONTENT_VERSION\)/);
  assert.match(route, /code: "PLACEMENT_VERSION_CHANGED"/);
  assert.match(route, /SET status = 'abandoned'/);
  assert.match(route, /if \(!skill\.roundsCompleted\) continue/);
  assert.match(route, /skill\.roundsCompleted,/);
  assert.match(assessment, /state\?\.attempt\?\.restartRequired/);
  assert.match(assessment, /state\.attempt\.confidence === "low"/);
  assert.match(assessment, /t\.manualHint/);
});
