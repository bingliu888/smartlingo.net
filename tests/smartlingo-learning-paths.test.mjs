import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SMARTLINGO_LEARNING_CONTENT_VERSION,
  SMARTLINGO_SKILLS,
  generateAdaptivePlacementQuestions,
} from "../lib/smartlingo-learning.ts";
import {
  SMARTLINGO_DAILY_MINUTES,
  SMARTLINGO_LANGUAGE_CATALOG,
  SMARTLINGO_PATH_CONTENT_VERSION,
  SMARTLINGO_STAGE_IDS,
  SMARTLINGO_USE_CASES,
  buildLanguagePath,
  canEnterPathUnit,
  resolveLearningPath,
  startingPointForOnboarding,
  validateLearningOnboarding,
} from "../lib/smartlingo-paths.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("the twelve-language catalog has stable text-only identity, speech, stage, status, and version metadata", async () => {
  assert.equal(SMARTLINGO_LANGUAGE_CATALOG.length, 12);
  assert.equal(new Set(SMARTLINGO_LANGUAGE_CATALOG.map(language => language.code)).size, 12);
  assert.equal(new Set(SMARTLINGO_LANGUAGE_CATALOG.map(language => language.stableId)).size, 12);
  assert.equal(new Set(SMARTLINGO_LANGUAGE_CATALOG.map(language => language.pathId)).size, 12);
  assert.equal(new Set(SMARTLINGO_LANGUAGE_CATALOG.map(language => language.classId)).size, 12);

  for (const language of SMARTLINGO_LANGUAGE_CATALOG) {
    assert.equal(language.stableId, `sl-language-${language.code}`);
    assert.ok(language.nameZh && language.nameEn && language.nativeName);
    assert.ok(["ltr", "rtl"].includes(language.direction));
    assert.match(language.speechLocale, /^[a-z]{2,3}-[A-Z]{2}$/);
    assert.equal(language.speech.playback, "device_dependent");
    assert.equal(language.speech.microphone, "device_dependent_signed_in");
    assert.equal(language.speech.liveAudio, "signed_in");
    assert.deepEqual(language.stageIds, SMARTLINGO_STAGE_IDS);
    assert.equal(language.contentStatus, "foundation_ready");
    assert.equal(language.contentVersion, SMARTLINGO_PATH_CONTENT_VERSION);
    assert.equal(language.learningContentVersion, SMARTLINGO_LEARNING_CONTENT_VERSION);
    assert.equal(language.sourceType, "smartlingo_original");
  }
  assert.equal(SMARTLINGO_LANGUAGE_CATALOG.find(language => language.code === "pt")?.speechLocale, "pt-BR");
  assert.equal(SMARTLINGO_LANGUAGE_CATALOG.find(language => language.code === "ar")?.direction, "rtl");

  const publicSources = (await Promise.all([
    read("../lib/smartlingo-paths.ts"),
    read("../components/LearningPathPlanner.tsx"),
    read("../app/[lang]/programs/page.tsx"),
  ])).join("\n");
  assert.doesNotMatch(publicSources, /[\u{1F1E6}-\u{1F1FF}]{2}/u);
  assert.doesNotMatch(publicSources, /(?:language|community)[-_ ]flag/i);
  assert.doesNotMatch(publicSources, /ten languages|10 种|four core skills|4 项核心技能/i);
});

test("goal onboarding validates language, use case, daily time, self-report, and all three entry choices", () => {
  assert.deepEqual(SMARTLINGO_USE_CASES, ["daily_life", "travel", "work", "study", "community"]);
  assert.deepEqual(SMARTLINGO_DAILY_MINUTES, [5, 10, 15, 20]);
  const fundamentals = validateLearningOnboarding({
    targetLanguage: "ja",
    useCase: "travel",
    dailyMinutes: 10,
    selfReportedLevel: "advanced",
    entryMode: "fundamentals",
  });
  assert.equal(fundamentals.ok, true);
  assert.deepEqual(startingPointForOnboarding(fundamentals.value), {
    stageId: "foundation",
    unitId: "sl-unit-ja-first-contact",
  }, "explicit fundamentals must override the self-reported level");

  const selected = validateLearningOnboarding({
    targetLanguage: "es",
    useCase: "work",
    dailyMinutes: 20,
    selfReportedLevel: "intermediate",
    entryMode: "self_selected",
  });
  assert.equal(selected.ok, true);
  assert.deepEqual(startingPointForOnboarding(selected.value), {
    stageId: "everyday",
    unitId: "sl-unit-es-directions-and-services",
  });

  const adaptive = validateLearningOnboarding({
    targetLanguage: "ar",
    useCase: "community",
    dailyMinutes: 5,
    selfReportedLevel: "beginner",
    entryMode: "adaptive",
  });
  assert.equal(adaptive.ok, true);
  assert.equal(startingPointForOnboarding(adaptive.value), null);

  const invalid = validateLearningOnboarding({
    targetLanguage: "xx",
    useCase: "immigration_decision",
    dailyMinutes: 999,
    selfReportedLevel: "native",
    entryMode: "certificate",
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.issues, ["target_language", "use_case", "daily_minutes", "self_reported_level", "entry_mode"]);
});

test("every language has an acyclic three-stage, nine-unit prerequisite path covering all five skills and real situations", () => {
  for (const language of SMARTLINGO_LANGUAGE_CATALOG) {
    const stages = buildLanguagePath(language.code);
    assert.deepEqual(stages.map(stage => stage.id), SMARTLINGO_STAGE_IDS);
    assert.deepEqual(stages.map(stage => stage.level), ["A1", "A2", "B1+"]);
    assert.equal(stages.flatMap(stage => stage.units).length, 9);
    assert.equal(stages[0].availability, "available");
    assert.ok(stages.slice(1).every(stage => stage.availability === "preview"));

    const units = stages.flatMap(stage => stage.units);
    assert.equal(new Set(units.map(unit => unit.id)).size, units.length);
    assert.ok(units.every(unit => unit.id.startsWith(`sl-unit-${language.code}-`)));
    assert.ok(units.every(unit => unit.title.zh && unit.title.en && unit.summary.zh && unit.summary.en));
    assert.ok(units.every(unit => unit.scenario.zh && unit.scenario.en));
    assert.ok(units.every(unit => unit.contentVersion === SMARTLINGO_PATH_CONTENT_VERSION));
    assert.ok(units.every(unit => unit.sourceType === "smartlingo_original"));
    assert.equal(units[0].prerequisiteUnitId, null);
    assert.equal(canEnterPathUnit(language.code, units[0].id, []), true);
    for (let index = 1; index < units.length; index += 1) {
      assert.equal(units[index].prerequisiteUnitId, units[index - 1].id);
      assert.equal(canEnterPathUnit(language.code, units[index].id, []), false);
      assert.equal(canEnterPathUnit(language.code, units[index].id, [units[index - 1].id]), true);
    }
    for (const stage of stages) {
      const covered = new Set(stage.units.flatMap(unit => unit.skills));
      assert.deepEqual([...SMARTLINGO_SKILLS].filter(skill => !covered.has(skill)), []);
    }
  }
});

test("language switching isolates stable unit IDs and missing content returns a bilingual-friendly fallback", () => {
  const english = buildLanguagePath("en").flatMap(stage => stage.units).map(unit => unit.id);
  const spanish = buildLanguagePath("es").flatMap(stage => stage.units).map(unit => unit.id);
  assert.equal(english.some(id => spanish.includes(id)), false);
  assert.equal(resolveLearningPath("en", "zh").kind, "path");
  const unavailableZh = resolveLearningPath("xx", "zh");
  const unavailableEn = resolveLearningPath("xx", "en");
  assert.equal(unavailableZh.kind, "content_unavailable");
  assert.equal(unavailableZh.code, "SMARTLINGO_CONTENT_UNAVAILABLE");
  assert.match(unavailableZh.message, /学习记录不会丢失/);
  assert.match(unavailableEn.message, /saved progress is retained/i);
});

test("placement remains fifteen unique original versioned items, starts at intermediate, and localizes context", () => {
  for (const language of SMARTLINGO_LANGUAGE_CATALOG) {
    const questions = generateAdaptivePlacementQuestions(language.code, [], "path-integrity");
    assert.equal(questions.length, 15);
    assert.equal(new Set(questions.map(question => question.id)).size, 15);
    assert.ok(questions.every(question => question.sourceType === "smartlingo_original"));
    assert.ok(questions.every(question => question.contentVersion === SMARTLINGO_LEARNING_CONTENT_VERSION));
    assert.ok(SMARTLINGO_SKILLS.every(skill => questions.find(question => question.skill === skill && question.round === 1)?.level === "intermediate"));
    for (const question of questions.filter(question => question.skill === "writing" || question.skill === "dialogue")) {
      assert.equal(typeof question.context, "object");
      assert.ok(question.context.zh && question.context.en);
    }
  }
});

test("route and UI contracts preserve progress, retain retake history, create no skipped-placement scores, and expose the map", async () => {
  const [planRoute, placementRoute, planner, programs] = await Promise.all([
    read("../app/api/learning-plan/route.ts"),
    read("../app/api/classes/[classId]/placement/route.ts"),
    read("../components/LearningPathPlanner.tsx"),
    read("../app/[lang]/programs/page.tsx"),
  ]);
  assert.match(planRoute, /database\.batch\(\[/);
  assert.match(planRoute, /COALESCE\(smartlingo_learning_plans\.current_stage_id/);
  assert.match(planRoute, /scoresCreated: false/);
  assert.match(placementRoute, /action === "skip_placement"/);
  assert.match(placementRoute, /SET status = 'abandoned'/);
  assert.match(placementRoute, /VALUES \(\?, \?, \?, \?, \?, 'completed'/);
  assert.match(placementRoute, /status <> 'abandoned'/);
  assert.match(placementRoute, /item_key = \? AND item_version = \?/);
  assert.match(placementRoute, /action === "restart"/);
  assert.match(planner, /Skip placement and start with fundamentals/);
  assert.match(planner, /跳过测评，从基础开始/);
  assert.match(planner, /data-layout-fill="stage-unit-map"/);
  assert.match(planner, /data-layout-track=\{unit\.id\}/);
  assert.match(programs, /<LearningPathPlanner lang=\{locale\}/);
  assert.match(programs, /data-layout-page="programs"/);
});
