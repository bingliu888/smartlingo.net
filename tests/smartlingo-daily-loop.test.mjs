import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SMARTLINGO_DAILY_SKILLS,
  advanceLearningStreak,
  buildDailyAnswerFeedback,
  calculateLearningStreak,
  calculateLearningXp,
  composeDailyLearningSession,
  mergeCheckpointDrafts,
  mergeDailyCheckpointDrafts,
  reconcileCheckpointQueue,
  resolveDailyLearningDates,
} from "../lib/smartlingo-daily-loop.ts";

const sessionInput = minutes => ({
  minutes,
  useCase: "travel",
  stage: "beginner",
  recentScores: {
    vocabulary: 72,
    reading: 88,
    writing: 64,
    listening: 31,
    dialogue: 76,
  },
  dueVocabularyCount: 7,
  language: "es",
  date: "2026-08-03",
  contentVersion: "2026-08-03.1",
});

test("daily composition is deterministic, complete, bilingual, and exactly timed", () => {
  for (const minutes of [15, 30, 45, 60]) {
    const first = composeDailyLearningSession(sessionInput(minutes));
    const second = composeDailyLearningSession(sessionInput(minutes));
    assert.deepEqual(first, second);
    assert.equal(first.totalMinutes, minutes);
    assert.equal(first.blocks.reduce((total, block) => total + block.minutes, 0), minutes);
    assert.ok(first.blocks.some(block => block.kind === "new_material"));
    assert.ok(first.blocks.some(block => block.kind === "spaced_review"));
    assert.ok(first.blocks.some(block => block.kind === "recap"));
    assert.deepEqual(
      first.blocks.filter(block => block.kind === "skill_practice").map(block => block.skill),
      SMARTLINGO_DAILY_SKILLS,
    );
    assert.ok(first.blocks.every(block => block.minutes >= 1));
    assert.ok(first.blocks.every(block => block.rationale.zh && block.rationale.en));
    assert.ok(first.blocks.every(block => block.sourceType === "smartlingo_original"));
  }
});

test("daily practice advances at local midnight while an unfinished course checkpoint remains resumable", () => {
  assert.deepEqual(
    resolveDailyLearningDates("2026-08-22", "2026-08-21"),
    { practiceDate: "2026-08-22", checkpointDate: "2026-08-21" },
  );
  assert.throws(() => resolveDailyLearningDates("2026-08-32", "2026-08-21"), /valid calendar date/);
});

test("recent weak skills receive extra session time", () => {
  const session = composeDailyLearningSession({
    ...sessionInput(30),
    recentScores: {
      vocabulary: 94,
      reading: 92,
      writing: 90,
      listening: 10,
      dialogue: 88,
    },
  });
  const practice = Object.fromEntries(
    session.blocks.filter(block => block.kind === "skill_practice").map(block => [block.skill, block.minutes]),
  );
  assert.ok(practice.listening > practice.vocabulary);
  assert.ok(practice.listening > practice.reading);
  assert.ok(practice.listening > practice.writing);
  assert.ok(practice.listening > practice.dialogue);
  assert.match(session.blocks.find(block => block.skill === "listening").rationale.zh, /弱项/);
});

test("answer feedback is bilingual, versioned, and never labels a wrong answer correct", () => {
  const incorrect = buildDailyAnswerFeedback({
    skill: "writing",
    score: 18,
    skipped: false,
    targetForm: "I would like some water.",
    meaning: { zh: "我想要一些水。", en: "A polite request for water." },
    contentVersion: "2026-08-03.1",
  });
  assert.equal(incorrect.correctness, "incorrect");
  assert.equal(incorrect.isCorrect, false);
  assert.equal(incorrect.score, 18);
  assert.match(incorrect.explanation.zh, /不能按正确答案记录/);
  assert.match(incorrect.explanation.en, /must not be recorded as correct/);
  assert.ok(incorrect.hint.zh && incorrect.hint.en);
  assert.match(incorrect.disclaimer.zh, /不是真人教师评价/);
  assert.match(incorrect.disclaimer.en, /not a human teacher evaluation/);
  assert.match(incorrect.disclaimer.en, /not .*official exam result/);
  assert.equal(incorrect.contentVersion, "2026-08-03.1");
  assert.equal(incorrect.scoringBasis, "server_score");

  const skipped = buildDailyAnswerFeedback({
    skill: "listening",
    score: 100,
    skipped: true,
    targetForm: "Where is the station?",
    meaning: { zh: "车站在哪里？", en: "Asking where the station is." },
    contentVersion: "2026-08-03.1",
  });
  assert.equal(skipped.correctness, "skipped");
  assert.equal(skipped.isCorrect, null);
  assert.equal(skipped.score, 0);
});

test("learning XP only uses server score and has no cash value", () => {
  const earned = calculateLearningXp({ serverScore: 60 });
  const stronger = calculateLearningXp({ serverScore: 90 });
  assert.deepEqual(
    { xp: earned.xp, basis: earned.basis, hasCashValue: earned.hasCashValue, cashValue: earned.cashValue },
    { xp: 12, basis: "server_score", hasCashValue: false, cashValue: 0 },
  );
  assert.ok(stronger.xp > earned.xp);
  assert.equal(calculateLearningXp({ serverScore: 100, skipped: true }).xp, 0);
  assert.equal(calculateLearningXp({ serverScore: 100, paused: true }).xp, 0);
  assert.match(earned.notice.zh, /不具现金价值/);
  assert.match(earned.notice.en, /no cash value/);
});

test("streaks deduplicate local days and stay stable across a month boundary", () => {
  const result = calculateLearningStreak(
    ["2026-07-31", "2026-08-01", "2026-08-01", "2026-08-02"],
    "2026-08-02",
  );
  assert.deepEqual(result, { current: 3, longest: 3, repairedDates: [] });
  assert.deepEqual(
    calculateLearningStreak({ localDates: ["2026-08-01"], today: "2026-08-02" }),
    { current: 1, longest: 1, repairedDates: [] },
    "yesterday remains the current streak until the learner-local day finishes",
  );
  assert.throws(
    () => calculateLearningStreak(["2026-08-02T23:30:00-07:00"], "2026-08-02"),
    /learner-local YYYY-MM-DD/,
    "instants must be converted to local dates before streak calculation",
  );
});

test("streak repair fills one single-day gap per rolling thirty days", () => {
  assert.deepEqual(
    calculateLearningStreak(["2026-07-31", "2026-08-02"], "2026-08-02"),
    { current: 3, longest: 3, repairedDates: ["2026-08-01"] },
  );

  const twoNearbyGaps = calculateLearningStreak(
    ["2026-06-01", "2026-06-03", "2026-06-05"],
    "2026-06-05",
  );
  assert.deepEqual(twoNearbyGaps.repairedDates, ["2026-06-02"]);
  assert.equal(twoNearbyGaps.current, 1);
  assert.equal(twoNearbyGaps.longest, 3);

  const distantGaps = calculateLearningStreak(
    ["2026-06-01", "2026-06-03", "2026-07-03", "2026-07-05"],
    "2026-07-05",
  );
  assert.deepEqual(distantGaps.repairedDates, ["2026-06-02", "2026-07-04"]);
  assert.deepEqual(
    advanceLearningStreak({ localDates: ["2026-08-01", "2026-08-03"], today: "2026-08-03" }),
    { current: 3, longest: 3, repairedDates: ["2026-08-02"] },
  );
});

test("offline checkpoint drafts three-way merge disjoint edits and retain both conflicting sides", () => {
  const base = {
    position: 2,
    answers: { vocabulary: "hola", reading: "A" },
    note: "base note",
    completed: false,
  };
  const server = {
    position: 3,
    answers: { vocabulary: "hola", reading: "A", listening: "B" },
    note: "server note",
    completed: false,
  };
  const client = {
    position: 2,
    answers: { vocabulary: "hola", reading: "A", writing: "gracias" },
    note: "offline note",
    completed: false,
  };

  const result = mergeCheckpointDrafts(base, server, client);
  assert.equal(result.merged.position, 3);
  assert.deepEqual(result.merged.answers, {
    vocabulary: "hola",
    reading: "A",
    listening: "B",
    writing: "gracias",
  });
  assert.equal(result.merged.completed, false);
  assert.equal("note" in result.merged, false, "a conflict must not silently select one side");
  assert.equal(result.hasConflicts, true);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(
    {
      field: result.conflicts[0].field,
      base: result.conflicts[0].base,
      server: result.conflicts[0].server,
      client: result.conflicts[0].client,
    },
    { field: "note", base: "base note", server: "server note", client: "offline note" },
  );
  assert.deepEqual(base.answers, { vocabulary: "hola", reading: "A" }, "merge must not mutate the base draft");
  assert.deepEqual(mergeDailyCheckpointDrafts({ base, server, client }), result);
});

test("an immutable in-flight checkpoint request confirms before queued typing receives a new operation", () => {
  const requestA = { draft: { answers: { writing: "A" } }, activeStep: "writing" };
  const queuedAb = { draft: { answers: { writing: "AB" } }, activeStep: "writing" };
  assert.deepEqual(reconcileCheckpointQueue({
    server: requestA,
    queued: queuedAb,
    pending: requestA,
  }), {
    pendingAlreadyApplied: true,
    queuedAlreadyAligned: false,
    pendingRequestRemains: false,
    needsAnotherOperation: true,
    canClearLocalStorage: false,
  });
  assert.deepEqual(reconcileCheckpointQueue({
    server: { draft: {}, activeStep: "vocabulary" },
    queued: queuedAb,
    pending: requestA,
  }), {
    pendingAlreadyApplied: false,
    queuedAlreadyAligned: false,
    pendingRequestRemains: true,
    needsAnotherOperation: false,
    canClearLocalStorage: false,
  });
  assert.equal(reconcileCheckpointQueue({ server: queuedAb, queued: queuedAb, pending: null }).canClearLocalStorage, true);
});

test("daily learning API keeps GET read-only and the server authoritative for time and completion", async () => {
  const route = await readFile(new URL("../app/api/classes/[classId]/learning/route.ts", import.meta.url), "utf8");
  assert.match(route, /refreshProgress = false/);
  assert.match(route, /refreshProgress\s*\?\s*await refreshQuickCourseProgress/);
  assert.match(route, /requiredSkills: SMARTLINGO_SKILLS/);
  assert.doesNotMatch(route, /filter\(task => assignedSkills\.includes/);
  assert.match(route, /SMARTLINGO_SESSION_TIME_REMAINS/);
  assert.match(route, /const remaining = calculated/);
  assert.doesNotMatch(route, /Math\.min\(calculated, clientRemaining\)/);
  assert.match(route, /dailyComplete = daily\.complete && \(timer\?\.status === "completed" \|\| timerRemaining === 0\)/);
  assert.match(route, /const authoritativeDailyPlan = checkpointPlan\(checkpointRow, dailyLoop\.plan\)/);
  assert.match(route, /resolveDailyLearningDates\(date, authoritativeDailyPlan\.date\)/);
  assert.match(route, /buildDailyPracticeItem\(targetLanguage, skill, practiceDate/);
  assert.match(route, /taskDate !== state\.date/);
  assert.match(route, /gradeDailyVocabularyQuiz\(auth\.access\.targetLanguage, day, sessionDate/);
  assert.match(route, /const authoritativeTimeZone = await ensureLearningStreakAuthority/);
  assert.match(route, /const authoritativeDate = localDateKey\(Number\(activity\.createdAt\), authoritativeTimeZone\)/);
});

test("checkpoint, feedback, XP, and quiz writes are revisioned and idempotent", async () => {
  const route = await readFile(new URL("../app/api/classes/[classId]/learning/route.ts", import.meta.url), "utf8");
  assert.match(route, /action === "save_checkpoint"/);
  assert.match(route, /FROM smartlingo_daily_checkpoint_revisions/);
  assert.match(route, /mergeCheckpointDrafts\(baseDraft, serverDraft, clientDraft\)/);
  assert.doesNotMatch(route, /checkpointDraft\(body\.baseDraft\)/);
  assert.match(route, /revision = revision \+ 1/);
  assert.match(route, /WHERE id = \? AND user_id = \? AND revision = \?/);
  assert.match(route, /last_operation_id = \?/);
  assert.match(route, /last_operation_fingerprint = \?/);
  assert.match(route, /actualCheckpointId: receipt\.checkpointId/);
  assert.match(route, /intendedCheckpointId/);
  assert.match(route, /enrollmentScope\?\.status === "active"/);
  assert.match(route, /SMARTLINGO_CHECKPOINT_SCOPE_STALE/);
  assert.match(route, /SMARTLINGO_CHECKPOINT_CONFLICT/);
  assert.match(route, /SMARTLINGO_CHECKPOINT_BASE_UNAVAILABLE/);
  assert.match(route, /smartlingo_daily_answer_feedback/);
  assert.match(route, /smartlingo_learning_xp_ledger/);
  assert.match(route, /activity_event_id/);
  assert.match(route, /Learning XP only reflects practice progress; it has no cash value/);
  assert.doesNotMatch(route, /introducer_reward_ledger|reward_ledger/);
  assert.match(route, /COALESCE\(MAX\(attempt_number\), 0\) \+ 1/);
  assert.match(route, /quizSubmissionFingerprint/);
  assert.match(route, /await auth\.database\.batch\(statements\)/);
  assert.match(route, /SMARTLINGO_QUIZ_INCOMPLETE_RECEIPT/);
  assert.match(route, /WHERE user_id = \? AND revision = \? AND time_zone = \? RETURNING revision/);
  assert.doesNotMatch(route, /if \(!inserted\) return false;[\s\S]{0,300}reconcileLearningStreak/);
  const quizBlock = route.slice(
    route.indexOf('if (action === "submit_daily_quiz")'),
    route.indexOf('if (action === "vocabulary_review")'),
  );
  assert.doesNotMatch(quizBlock, /INSERT OR IGNORE|DELETE FROM/);
  assert.match(quizBlock, /A stable client operation identity is required/);
  const checkpointBlock = route.slice(
    route.indexOf('if (action === "save_checkpoint")'),
    route.indexOf('if (["start_session"'),
  );
  assert.ok(
    checkpointBlock.indexOf("const existingReceipt = await dailySyncReceipt")
      < checkpointBlock.indexOf("const state = await learningState"),
    "committed checkpoint operations must replay before the current course day is read",
  );
});

test("learning workspace restores weak-network drafts and exposes accessible feedback tabs", async () => {
  const workspace = await readFile(new URL("../components/LearningWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /window\.sessionStorage\.setItem\(checkpointStorageKey/);
  assert.match(workspace, /action: "save_checkpoint"/);
  assert.match(workspace, /checkpointId: pendingRequest\.checkpointId/);
  assert.match(workspace, /enrollmentId: requestEnrollmentId/);
  assert.match(workspace, /courseDay: requestCourseDay/);
  assert.match(workspace, /checkpointDate: requestSessionDate/);
  assert.match(workspace, /checkpointContentVersion: requestContentVersion/);
  assert.match(workspace, /checkpointScopeKeyRef\.current !== requestScopeKey/);
  assert.match(workspace, /type PendingCheckpointRequest =/);
  assert.match(workspace, /requestDraft: CheckpointDraft/);
  assert.match(workspace, /requestActiveStep: TrainingTab/);
  assert.match(workspace, /pendingCheckpointRequestRef\.current/);
  assert.match(workspace, /draft: pendingRequest\.requestDraft/);
  assert.match(workspace, /activeStep: pendingRequest\.requestActiveStep/);
  assert.match(workspace, /conflict\?: boolean/);
  assert.match(workspace, /serverRevision\?: number/);
  assert.match(workspace, /checkpointConflictRef\.current && serialized === conflictDraftJsonRef\.current/);
  assert.match(workspace, /conflict: true,[\s\S]*?serverRevision: nextCheckpoint\.revision[\s\S]*?serverDraft: latestDraft/);
  assert.match(workspace, /setCheckpointSyncStatus\(storedConflict \? "conflict"/);
  assert.match(workspace, /reconcileCheckpointQueue\(\{/);
  assert.match(workspace, /const \{ pendingAlreadyApplied, queuedAlreadyAligned \} = reconciliation/);
  assert.match(workspace, /currentDraftStateJsonRef\.current === latestSerialized/);
  assert.match(workspace, /checkpoint\?\.revision \?\? 0/);
  assert.match(workspace, /SMARTLINGO_CHECKPOINT_CONFLICT|checkpointSyncStatus.*conflict/s);
  assert.match(workspace, /aria-controls=\{`sl-learning-panel-/);
  assert.match(workspace, /onKeyDown=\{event => handleTrainingTabKey/);
  assert.match(workspace, /role="tabpanel"/);
  assert.match(workspace, /dailyQuizResult\?\.responses/);
  assert.match(workspace, /clientOperationId: quizOperationIdRef\.current/);
  assert.match(workspace, /setSessionStatus\("completing"\)/);
  assert.doesNotMatch(workspace, /setNotice\(t\.sessionComplete\);[\s\S]{0,180}fetch\(/);
});
