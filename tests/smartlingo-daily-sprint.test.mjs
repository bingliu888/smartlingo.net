import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSprintPlan, gradeSprintPlan, SPRINT_DURATIONS } from "../lib/smartlingo-sprint.ts";

const vocabulary = Array.from({ length: 1000 }, (_, index) => ({
  id: `word-${index + 1}`,
  form: `word ${index + 1}`,
  pronunciation: `/word ${index + 1}/`,
  meaning: `词义 ${index + 1}`,
}));

test("Daily Sprint offers the four requested durations and one complete five-skill round per five minutes", () => {
  assert.deepEqual(SPRINT_DURATIONS, [5, 10, 15, 20]);
  for (const durationMinutes of SPRINT_DURATIONS) {
    const plan = buildSprintPlan({ runId: `run-${durationMinutes}`, language: "en", level: "beginner", uiLang: "zh", durationMinutes, vocabulary });
    assert.equal(plan.rounds.length, durationMinutes / 5);
    assert.equal(new Set(plan.rounds.flatMap(round => round.vocabulary.map(item => item.id))).size, durationMinutes * 2);
    for (const round of plan.rounds) {
      assert.equal(round.vocabulary.length, 10);
      assert.equal(round.reading.options.length, 3);
      assert.ok(round.listening.audioText);
      assert.ok(round.listening.answerTokens.length > 1);
      assert.ok(round.writing.prompt);
      assert.ok(round.writing.answerTokens.length > 1);
      assert.ok(round.dialogue.audioText);
    }
  }
});

test("Daily Sprint scoring is server-derived across all five skills", () => {
  const plan = buildSprintPlan({ runId: "perfect-run", language: "en", level: "beginner", uiLang: "zh", durationMinutes: 10, vocabulary });
  const responses = plan.rounds.map(round => ({
    vocabularySeen: round.vocabulary.map(item => item.id),
    reading: round.reading.answerId,
    listening: round.listening.expected,
    writing: round.writing.expected,
    dialogueTranscript: round.dialogue.expected,
  }));
  assert.deepEqual(gradeSprintPlan(plan, responses), { score: 100, skillScores: { vocabulary: 100, reading: 100, listening: 100, writing: 100, dialogue: 100 } });
  const incomplete = gradeSprintPlan(plan, plan.rounds.map(() => ({})));
  assert.equal(incomplete.score, 0);
});

test("course and Play surfaces expose Daily Sprint, rankings, and digital redemption", () => {
  const menu = readFileSync(new URL("../components/CourseTrainingMenu.tsx", import.meta.url), "utf8");
  const play = readFileSync(new URL("../app/[lang]/play/page.tsx", import.meta.url), "utf8");
  const playPicker = readFileSync(new URL("../components/PlayDailySprintPicker.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/[lang]/dashboard/page.tsx", import.meta.url), "utf8");
  const dashboardSprint = readFileSync(new URL("../components/DashboardDailySprint.tsx", import.meta.url), "utf8");
  const sprintRoute = readFileSync(new URL("../app/api/classes/[classId]/sprint/route.ts", import.meta.url), "utf8");
  const rewardsRoute = readFileSync(new URL("../app/api/rewards/redeem/route.ts", import.meta.url), "utf8");
  assert.match(menu, /今日速成/);
  assert.match(menu, /\[5,10,15,20\]/);
  assert.match(play, /PlayDailySprintPicker/);
  assert.match(play, /isSmartLingoCommunityLanguage\(query\.language\) \? query\.language : lang/);
  assert.doesNotMatch(play, /\{language \? <>/);
  for (const tile of ["智慧卡练习", "智慧卡挑战", "免费试学", "排行榜", "兑换中心"]) assert.match(play, new RegExp(tile));
  assert.match(play, /GameLanguagePicker lang=\{lang\} basePath=\{`\/\$\{lang\}\/play`\} selected=\{language\}/);
  assert.match(playPicker, /今日速成/);
  assert.match(playPicker, /useState<\(typeof DURATIONS\)\[number\]>\(10\)/);
  assert.match(playPicker, /course_\$\{language\}_basic\/sprint\?minutes=/);
  assert.match(play, /play\/rankings/);
  assert.match(play, /play\/redeem/);
  assert.match(dashboard, /DashboardDailySprint/);
  assert.match(dashboardSprint, /添加新语言/);
  assert.match(dashboardSprint, /minutes\[language\.code\] \|\| 10/);
  assert.match(sprintRoute, /requireOfficialClassMembership/);
  assert.match(sprintRoute, /status='completed'/);
  assert.match(rewardsRoute, /smartlingo_course_credit_ledger/);
  assert.match(rewardsRoute, /digital_redeem/);
});

test("course navigation precedes college navigation and the home task is one linked image card", () => {
  const header = readFileSync(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/[lang]/page.tsx", import.meta.url), "utf8");
  assert.ok(header.indexOf("选择课程") < header.indexOf("选择学院"));
  assert.ok(home.indexOf('href="#home-courses"') < home.indexOf('href="#home-colleges"'));
  assert.ok(home.indexOf('id="home-courses"') < home.indexOf('id="home-colleges"'));
  assert.match(home, /className="lingo-hero-visual" href=\{`\/\$\{lang\}\/play\?language=\$\{lang\}`\}/);
  assert.match(home, /lingo-community-art/);
  assert.match(home, /lingo-task-action/);
});

test("migration adds idempotent rank and redemption ownership boundaries", () => {
  const migration = readFileSync(new URL("../drizzle/0152_daily_sprint_rewards.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE smartlingo_daily_sprint_runs/);
  assert.match(migration, /status IN \('in_progress','completed','abandoned'\)/);
  assert.match(migration, /smartlingo_digital_reward_owner_uq/);
  assert.match(migration, /entry_type IN \([^\n]*'digital_redeem'/);
  assert.match(migration, /smartlingo_course_credit_balance_insert_trg/);
});
