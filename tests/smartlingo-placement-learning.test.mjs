import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SMARTLINGO_LEARNING_CONTENT_VERSION,
  SMARTLINGO_LEARNING_LANGUAGE_CODES,
  SMARTLINGO_PLACEMENT_ESTIMATED_MINUTES,
  SMARTLINGO_SKILLS,
  SMARTLINGO_VOCABULARY_SAMPLES,
  buildDailyPracticeItem,
  buildDailyTeachingPlan,
  buildDailyVocabularyQuiz,
  createVocabularyReviewState,
  evaluatePlacement,
  generateAdaptivePlacementQuestions,
  gradeDailyPracticeItem,
  gradeDailyVocabularyQuiz,
  gradeDailyVocabularyQuizResponses,
  getBeginnerSessionVocabularyDeck,
  scheduleVocabularyReview,
  scorePlacementAnswer,
  scorePronunciationTranscript,
  toClientPlacementQuestions,
} from "../lib/smartlingo-learning.ts";

test("daily session plans fill exactly 15, 30, 45, or 60 minutes", () => {
  for (const minutes of [15, 30, 45, 60]) {
    const plan = buildDailyTeachingPlan(minutes);
    assert.equal(plan.reduce((total, block) => total + block.minutes, 0), minutes);
    assert.equal(plan.at(-1)?.skill === "community" || plan.at(-1)?.skill === "quiz", true);
    assert.ok(plan.every(block => block.title.zh && block.title.en));
    assert.equal(plan.find(block => block.skill === "vocabulary")?.itemCount, 10);
  }
});

test("every beginner timed session assigns ten unique vocabulary cards", () => {
  for (const language of SMARTLINGO_LEARNING_LANGUAGE_CODES) {
    for (let day = 1; day <= 7; day += 1) {
      const deck = getBeginnerSessionVocabularyDeck(language, day);
      assert.equal(deck.length, 10, `${language} day ${day} must assign ten cards`);
      assert.equal(new Set(deck.map(card => card.stableId)).size, 10);
      assert.ok(deck.every(card => card.sourceType === "smartlingo_original"));
    }
  }
});

test("class dashboard starts a focused tabbed session with a compact bottom-right timer", async () => {
  const workspace = await read("../components/LearningWorkspace.tsx");
  const sessionPage = await read("../app/[lang]/classes/[classId]/learn/session/page.tsx");
  assert.match(workspace, /className="sl-session-start"/);
  assert.match(workspace, /learn\/session`/);
  assert.match(sessionPage, /view="session"/);
  assert.match(workspace, /className="sl-skill-tabs"/);
  assert.match(workspace, /activeSkill === "vocabulary"/);
  assert.match(workspace, /PRACTICE_SKILLS\.filter\(skill => skill === activeSkill\)/);
  assert.match(workspace, /className=\{`sl-session-timer/);
  assert.match(workspace, /pause_session/);
  assert.match(workspace, /resume_session/);
  assert.match(workspace, /"exam"/);
  assert.match(workspace, /quitSession/);
  assert.match(workspace, /vocabularyItems: "10 vocabulary items"/);
  assert.match(workspace, /position:fixed;right:max\(18px,env\(safe-area-inset-right\)\)/);
});

test("repetition records a local preview and returns AI feedback in the interface language", async () => {
  const workspace = await read("../components/LearningWorkspace.tsx");
  const route = await read("../app/api/classes/[classId]/learning/route.ts");
  assert.match(workspace, /new MediaRecorder\(stream\)/);
  assert.match(workspace, /recordingPrivacy/);
  assert.match(workspace, /<audio controls preload="metadata"/);
  assert.match(route, /reviewSmartAiLearningContent/);
  assert.match(route, /language: uiLanguage/);
  assert.match(route, /do not claim direct acoustic analysis/);
});

test("pronunciation feedback is conservative, transcript-based, and never infers identity", () => {
  const exact = scorePronunciationTranscript("buongiorno", "Buongiorno!");
  const partial = scorePronunciationTranscript("buongiorno", "buon giorno");
  assert.equal(exact.score, 100);
  assert.ok(partial.score >= 80);
  assert.equal(exact.provisional, true);
  assert.equal(exact.basis, "device_transcript_match");
  assert.doesNotMatch(JSON.stringify(exact), /nationality|ethnicity|accent origin/i);
});

test("daily vocabulary quiz exposes no answer key and is graded server-side", () => {
  const questions = buildDailyVocabularyQuiz("it", 1, "2026-08-02", "en");
  assert.equal(questions.length, 4);
  assert.ok(questions.every(question => !JSON.stringify(question).includes("correctOptionId")));
  assert.equal(questions[0].responseMode, "image_free");
  assert.equal(questions.slice(1).every(question => question.responseMode === "choice"), true);
  assert.ok(questions.every(question => !JSON.stringify(question).includes("acceptedForm")));
  const blank = gradeDailyVocabularyQuiz("it", 1, "2026-08-02", "en", {});
  assert.deepEqual(blank, { score: 0, correctCount: 0, questionCount: 4 });
  const spokenOrWritten = gradeDailyVocabularyQuiz("it", 1, "2026-08-02", "en", {
    [questions[0].id]: `free:${questions[0].prompt}`,
  });
  assert.deepEqual(spokenOrWritten, { score: 25, correctCount: 1, questionCount: 4 });
  const responses = gradeDailyVocabularyQuizResponses("it", 1, "2026-08-02", "en", {
    [questions[0].id]: `free:${questions[0].prompt}`,
  });
  assert.equal(responses.length, 4);
  assert.deepEqual(responses.map(item => item.correct), [true, false, false, false]);
  assert.ok(responses.every(item => item.targetForm && item.meaning.zh && item.meaning.en));
  assert.ok(responses.every(item => !JSON.stringify(item).includes("correctOptionId")));
});

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("the learning catalog covers twelve languages, five skills, and three original versioned levels", () => {
  assert.deepEqual(
    SMARTLINGO_LEARNING_LANGUAGE_CODES,
    ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"],
  );
  assert.deepEqual(SMARTLINGO_SKILLS, ["vocabulary", "reading", "writing", "listening", "dialogue"]);

  for (const code of SMARTLINGO_LEARNING_LANGUAGE_CODES) {
    const samples = SMARTLINGO_VOCABULARY_SAMPLES[code];
    assert.equal(samples.length, 3, `${code} must have one seed sample for each level`);
    assert.deepEqual(samples.map(sample => sample.level), ["beginner", "intermediate", "advanced"]);
    assert.equal(new Set(samples.map(sample => sample.stableId)).size, samples.length);
    for (const sample of samples) {
      assert.equal(sample.version, SMARTLINGO_LEARNING_CONTENT_VERSION);
      assert.equal(sample.sourceType, "smartlingo_original");
      assert.equal(sample.humanReviewStatus, "reviewed");
      assert.ok(sample.form && sample.example && sample.meaning.zh && sample.meaning.en);
    }
  }
});

test("placement creates fifteen client-safe questions and adapts each skill from intermediate", () => {
  const initial = generateAdaptivePlacementQuestions("en", [], "placement-test");
  assert.equal(initial.length, 15);
  assert.equal(initial.reduce((minutes, question) => minutes + question.estimatedMinutes, 0), SMARTLINGO_PLACEMENT_ESTIMATED_MINUTES);
  for (const skill of SMARTLINGO_SKILLS) {
    const questions = initial.filter(question => question.skill === skill);
    assert.equal(questions.length, 3);
    assert.deepEqual(questions.map(question => question.round), [1, 2, 3]);
    assert.equal(questions[0].level, "intermediate");
  }

  const observations = SMARTLINGO_SKILLS.flatMap(skill => [
    { skill, round: 1, score: skill === "reading" ? 20 : 90 },
    { skill, round: 2, score: 60 },
  ]);
  const adapted = generateAdaptivePlacementQuestions("en", observations, "placement-test");
  assert.equal(adapted.find(question => question.skill === "reading" && question.round === 2)?.level, "beginner");
  assert.equal(adapted.find(question => question.skill === "vocabulary" && question.round === 2)?.level, "advanced");
  assert.equal(adapted.find(question => question.skill === "vocabulary" && question.round === 3)?.level, "advanced");

  const safe = toClientPlacementQuestions(initial);
  assert.equal(safe.length, 15);
  assert.ok(safe.every(question => !("answerSpec" in question)));
  assert.ok(safe.every(question => question.contentVersion === SMARTLINGO_LEARNING_CONTENT_VERSION));
});

test("placement scoring is deterministic, balanced across five skills, and produces a recommendation", () => {
  const questions = generateAdaptivePlacementQuestions("en", [], "scoring-test");
  const scores = questions.map(question => {
    const answer = question.answerSpec.kind === "choice"
      ? question.answerSpec.correctOptionId
      : `${question.answerSpec.requiredTerms[0]} is useful in today's language practice.`;
    return scorePlacementAnswer(question, answer);
  });
  const evaluation = evaluatePlacement(scores);

  assert.equal(evaluation.answeredQuestions, 15);
  assert.equal(evaluation.isComplete, true);
  assert.equal(evaluation.overallScore, 100);
  assert.equal(evaluation.recommendedLevel, "advanced");
  assert.equal(evaluation.confidence, "high");
  assert.deepEqual(evaluation.skills.map(skill => skill.skill), SMARTLINGO_SKILLS);
  assert.ok(evaluation.skills.every(skill => skill.score === 100 && skill.roundsCompleted === 3));

  const skipped = scorePlacementAnswer(questions[0], null, true);
  assert.deepEqual({ score: skipped.score, skipped: skipped.skipped }, { score: 0, skipped: true });
});

test("vocabulary mastery requires three consecutive correct answers in three different modes", () => {
  let repeated = createVocabularyReviewState("sl-vocab-en-schedule-001", 0);
  repeated = scheduleVocabularyReview(repeated, { grade: "good", mode: "recognition", reviewedAt: 1_000 });
  repeated = scheduleVocabularyReview(repeated, { grade: "good", mode: "recognition", reviewedAt: 2_000 });
  repeated = scheduleVocabularyReview(repeated, { grade: "good", mode: "recall", reviewedAt: 3_000 });
  assert.equal(repeated.consecutiveCorrect, 3);
  assert.equal(repeated.status, "review", "repeating one mode must not count as three-mode mastery");

  let varied = scheduleVocabularyReview(repeated, { grade: "again", mode: "cloze", reviewedAt: 4_000 });
  assert.equal(varied.consecutiveCorrect, 0);
  assert.deepEqual(varied.recentCorrectModes, []);
  varied = scheduleVocabularyReview(varied, { grade: "good", mode: "recognition", reviewedAt: 5_000 });
  varied = scheduleVocabularyReview(varied, { grade: "hard", mode: "recall", reviewedAt: 6_000 });
  varied = scheduleVocabularyReview(varied, { grade: "easy", mode: "listening", reviewedAt: 7_000 });
  assert.equal(varied.status, "mastered");
  assert.equal(varied.consecutiveCorrect, 3);
  assert.deepEqual(varied.recentCorrectModes, ["recognition", "recall", "listening"]);
  assert.ok(varied.dueAt > 7_000);

  const suspended = scheduleVocabularyReview(varied, { grade: "suspend", mode: "cloze", reviewedAt: 8_000 });
  assert.equal(suspended.status, "suspended");
  assert.equal(suspended.dueAt, null);
});

test("vocabulary focus lists are server-authorized and durable", async () => {
  const [route, workspace, migration] = await Promise.all([
    read("../app/api/classes/[classId]/learning/route.ts"),
    read("../components/LearningWorkspace.tsx"),
    read("../drizzle/0039_smartlingo_vocabulary_focus.sql"),
  ]);
  assert.match(route, /action === "set_vocabulary_focus"/);
  assert.match(route, /currentState\.vocabularyDeck\.some/);
  assert.match(route, /is_focused = 1 OR lapse_count > 0/);
  assert.match(workspace, /错题与重点词本/);
  assert.match(workspace, /Mistakes and focus words/);
  assert.match(workspace, /humanReviewStatus === "reviewed"/);
  assert.match(migration, /ADD COLUMN `is_focused` integer DEFAULT 0 NOT NULL/);
  assert.match(migration, /smartlingo_vocabulary_progress_focus_idx/);
});

test("daily five-skill tasks are stable, localized, client-safe, and graded from server reconstruction", () => {
  for (const skill of SMARTLINGO_SKILLS) {
    const first = buildDailyPracticeItem("ar", skill, "2026-08-01", "zh");
    const second = buildDailyPracticeItem("ar", skill, "2026-08-01", "zh");
    assert.deepEqual(first, second);
    assert.match(first.taskId, new RegExp(`^daily:2026-08-01:ar:${skill}:`));
    assert.equal(first.direction, "rtl");
    assert.ok(first.prompt);
    assert.equal("answerSpec" in first, false);
    const skipped = gradeDailyPracticeItem("ar", skill, "2026-08-01", null, true);
    assert.deepEqual({ score: skipped.score, skipped: skipped.skipped }, { score: 0, skipped: true });
  }
  const recommended = buildDailyPracticeItem("en", "reading", "2026-08-01", "en", "advanced");
  assert.equal(recommended.level, "advanced", "placement recommendation must drive later daily learning");
  const recommendedGrade = gradeDailyPracticeItem("en", "reading", "2026-08-01", null, true, "advanced");
  assert.equal(recommendedGrade.level, "advanced");
  assert.throws(
    () => buildDailyPracticeItem("hi", "reading", "2026-02-30", "en"),
    /valid calendar date/,
  );
});

test("the learning calendar is a single-column five-skill log with community activity and no flags", async () => {
  const [calendar, workspace, placement, chooser, menu, catalog, page] = await Promise.all([
    read("../components/LearningLogCalendar.tsx"),
    read("../components/LearningWorkspace.tsx"),
    read("../components/PlacementAssessment.tsx"),
    read("../components/LanguageCommunityChooser.tsx"),
    read("../components/InterfaceLanguageMenu.tsx"),
    read("../lib/smartlingo-language-communities.ts"),
    read("../app/[lang]/learning-log/page.tsx"),
  ]);

  for (const [key, zh, en] of [
    ["vocabulary", "词汇", "Vocabulary"],
    ["reading", "阅读", "Reading"],
    ["writing", "写作", "Writing"],
    ["listening", "听力", "Listening"],
    ["dialogue", "对话", "Dialogue"],
  ]) {
    assert.match(calendar, new RegExp(`key: "${key}", zh: "${zh}", en: "${en}"`));
  }
  assert.match(calendar, /const COMMUNITY = \{ zh: "社区", en: "Community"/);
  assert.match(calendar, /grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/);
  assert.equal((calendar.match(/className="sl-log-calendar"/g) || []).length, 1);
  assert.ok(calendar.indexOf('className="sl-log-calendar"') < calendar.indexOf('className="sl-log-detail"'));
  const shellRule = calendar.match(/\.sl-learning-log\s*\{\s*width:\s*100%;[\s\S]*?\}/)?.[0] ?? "";
  assert.match(shellRule, /display:\s*grid/);
  assert.doesNotMatch(shellRule, /grid-template-columns/);
  assert.match(page, /<LearningWorkspace[^>]*calendarOnly/);
  assert.match(workspace, /<LearningLogCalendar/);
  assert.match(placement, /约 30 分钟的自适应分级/);
  assert.match(placement, /Beginner/);
  assert.match(placement, /Intermediate/);
  assert.match(placement, /Advanced/);
  assert.match(placement, /pause: "暂停"/);
  assert.match(placement, /pause: "Pause"/);
  assert.match(placement, /skip: "跳过本题"/);
  assert.match(placement, /skip: "Skip this item"/);
  assert.match(placement, /\.placement-shell\{width:100%;max-width:none;min-width:0;/);
  assert.doesNotMatch(placement, /\.placement-shell\{width:min\(/);

  const publicSources = [calendar, placement, chooser, menu, catalog].join("\n");
  assert.doesNotMatch(publicSources, /[\u{1F1E6}-\u{1F1FF}]{2}/u);
  assert.doesNotMatch(publicSources, /(?:language|community)[-_ ]flag/i);
});
