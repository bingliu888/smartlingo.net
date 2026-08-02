import assert from "node:assert/strict";
import test from "node:test";
import {
  SMARTLINGO_QUICK_COURSE_DAYS,
  SMARTLINGO_SHOWCASE_LEARNERS,
  buildQuickCourse,
} from "../lib/smartlingo-quick-courses.ts";
import { SMARTLINGO_COMMUNITY_LANGUAGE_CODES } from "../lib/smartlingo-language-communities.ts";
import {
  SMARTLINGO_BEGINNER_VOCABULARY_METADATA,
  getBeginnerVocabularyDeck,
  getVocabularySample,
  getVocabularySampleById,
  getVocabularyVisualCue,
} from "../lib/smartlingo-learning.ts";

test("all twelve languages publish one-, two-, and four-week beginner fast tracks", () => {
  const courses = SMARTLINGO_COMMUNITY_LANGUAGE_CODES.flatMap(language =>
    SMARTLINGO_QUICK_COURSE_DAYS.map(days => buildQuickCourse(language, days)));
  assert.equal(courses.length, 36);
  assert.equal(new Set(courses.map(course => course.stableId)).size, 36);
  for (const course of courses) {
    assert.equal(course.schedule.length, course.days);
    assert.equal(course.level, "beginner");
    assert.equal(course.isFreeDefault, course.days === 7);
    assert.ok(course.schedule.every((day, index) => day.day === index + 1));
    assert.ok(course.schedule.every(day => day.skills.includes("vocabulary") && day.skills.includes("listening") && day.skills.includes("dialogue")));
  }
});

test("reading begins in the 14-day path and writing begins in the 28-day path", () => {
  const fourteen = buildQuickCourse("it", 14);
  const fourWeeks = buildQuickCourse("it", 28);
  assert.ok(fourteen.schedule.slice(3).every(day => day.skills.includes("reading")));
  assert.ok(fourteen.schedule.every(day => !day.skills.includes("writing")));
  assert.ok(fourWeeks.schedule.slice(7).every(day => day.skills.includes("writing")));
  assert.deepEqual(fourWeeks.schedule.at(-1)?.skills, ["vocabulary", "reading", "writing", "listening", "dialogue"]);
});

test("test1 is an English-interface beginner learning Chinese on the free path", () => {
  const test1 = SMARTLINGO_SHOWCASE_LEARNERS[0];
  assert.equal(test1.testId, "test1");
  assert.equal(test1.interfaceLanguage, "en");
  assert.equal(test1.startingTarget, "zh");
  assert.equal(test1.level, "beginner");
  assert.equal(test1.courseDays, 7);
  assert.equal(test1.targetLanguages.length, 12);
  assert.equal(test1.accountKind, "qa_fixture_not_identity");
});

test("twelve QA fixtures cover every interface language without pretending to be identities", () => {
  assert.equal(SMARTLINGO_SHOWCASE_LEARNERS.length, 12);
  assert.deepEqual(
    [...SMARTLINGO_SHOWCASE_LEARNERS.map(learner => learner.interfaceLanguage)].sort(),
    [...SMARTLINGO_COMMUNITY_LANGUAGE_CODES].sort(),
  );
  assert.ok(SMARTLINGO_SHOWCASE_LEARNERS.every(learner => learner.targetLanguages.length === 12));
});

test("vocabulary practice pairs a neutral visual cue with bilingual source-language meaning", () => {
  for (const language of SMARTLINGO_COMMUNITY_LANGUAGE_CODES) {
    const sample = getVocabularySample(language, "beginner");
    const cue = getVocabularyVisualCue(sample);
    assert.equal(cue.kind, "pictogram");
    assert.ok(cue.symbol.length > 0);
    assert.ok(cue.label.zh.length > 0);
    assert.ok(cue.label.en.length > 0);
    assert.ok(sample.meaning.zh.length > 0);
    assert.ok(sample.meaning.en.length > 0);
  }
});

test("every language class has a seven-day, scene-based beginner flashcard library", () => {
  assert.deepEqual(SMARTLINGO_BEGINNER_VOCABULARY_METADATA, {
    version: "2026-08-02.1",
    cardsPerDay: 4,
    days: 7,
    cardsPerLanguage: 28,
    sourceType: "smartlingo_original",
  });
  for (const language of SMARTLINGO_COMMUNITY_LANGUAGE_CODES) {
    const cards = Array.from({ length: 7 }, (_, index) => getBeginnerVocabularyDeck(language, index + 1)).flat();
    assert.equal(cards.length, 28, `${language} must publish 28 beginner cards`);
    assert.equal(new Set(cards.map(card => card.stableId)).size, 28);
    for (const card of cards) {
      assert.equal(card.sourceType, "smartlingo_original");
      assert.equal(card.level, "beginner");
      assert.ok(card.form && card.pronunciation && card.meaning.zh && card.meaning.en);
      assert.equal(getVocabularySampleById(language, card.stableId)?.stableId, card.stableId);
      const cue = getVocabularyVisualCue(card);
      assert.ok(cue.symbol && cue.label.zh && cue.label.en);
    }
  }
});

test("the free week follows practical life scenes instead of isolated word lists", () => {
  const topics = Array.from({ length: 7 }, (_, index) => getBeginnerVocabularyDeck("it", index + 1)[0].topic);
  assert.deepEqual(topics, ["greetings", "introductions", "transport", "directions", "restaurant", "shopping", "help"]);
  assert.deepEqual(getBeginnerVocabularyDeck("it", 5).map(card => card.form), ["menù", "acqua", "vegetariano", "il conto, per favore"]);
});
