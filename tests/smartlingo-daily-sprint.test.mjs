import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSprintPlan, gradeSprintPlan, SPRINT_DURATIONS } from "../lib/smartlingo-sprint.ts";
import { isPublicBeginnerSprintClassId, requirePublicBeginnerSprintCourse } from "../lib/smartlingo-learning-access.ts";

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
    vocabularyAnswers: Object.fromEntries(round.vocabulary.map(item => [item.id, item.id])),
    reading: round.reading.answerId,
    listening: round.listening.expected,
    writing: round.writing.expected,
    dialogueTranscript: round.dialogue.expected,
  }));
  assert.deepEqual(gradeSprintPlan(plan, responses), { score: 100, skillScores: { vocabulary: 100, reading: 100, listening: 100, writing: 100, dialogue: 100 } });
  const wrongVocabulary = responses.map(response => ({ ...response, vocabularyAnswers: Object.fromEntries(Object.keys(response.vocabularyAnswers).map(id => [id, "wrong"])) }));
  assert.equal(gradeSprintPlan(plan, wrongVocabulary).skillScores.vocabulary, 0);
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
  assert.match(playPicker, /source=play/);
  assert.match(play, /play\/rankings/);
  assert.match(play, /play\/redeem/);
  assert.ok(play.indexOf("play/redeem") < play.indexOf("06 · FREE BEGINNER COURSE"));
  assert.match(dashboard, /DashboardDailySprint/);
  assert.match(dashboardSprint, /添加新语言/);
  assert.match(dashboardSprint, /minutes\[language\.code\] \|\| 10/);
  assert.match(sprintRoute, /requireOfficialClassMembership/);
  assert.match(sprintRoute, /status='completed'/);
  assert.match(rewardsRoute, /smartlingo_course_credit_ledger/);
  assert.match(rewardsRoute, /digital_redeem/);
});

test("Home feature buttons use the same canonical pages as navigation, and the task image opens Sprint", () => {
  const header = readFileSync(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/[lang]/page.tsx", import.meta.url), "utf8");
  assert.ok(header.indexOf("选择课程") < header.indexOf("选择学院"));
  assert.ok(home.indexOf('href={`/${lang}/programs`}') < home.indexOf('href={`/${lang}/colleges`}'));
  for (const path of ["play/everyday", "programs", "colleges", "assistant"]) assert.match(home, new RegExp(path));
  assert.match(home, /play\?language=\$\{lang\}/);
  assert.doesNotMatch(home, /HomeLearningChoices|home-everyday|home-courses|home-colleges|home-ai/);
  assert.match(home, /PlayDailySprintPicker lang=\{lang\} initialLanguage=\{lang\}/);
  assert.match(home, /triggerClassName="lingo-hero-visual"/);
  assert.match(home, /打开今日速成，选择语言和时长/);
  assert.doesNotMatch(home, /className="lingo-hero-visual" href=/);
  assert.match(home, /lingo-community-art/);
  assert.match(home, /lingo-task-action/);
  assert.match(home, /href=\{`\/\$\{lang\}\/play\?language=\$\{lang\}`\}/);
});

test("open Beginner Sprint is anonymous-only when signed out and never persists its local result", async () => {
  for (const language of ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"]) {
    assert.equal(isPublicBeginnerSprintClassId(`course_${language}_basic`), true);
  }
  assert.equal(isPublicBeginnerSprintClassId("course_en_intermediate"), false);
  assert.equal(isPublicBeginnerSprintClassId("course_en_basic_extra"), false);

  let accessQuery = "";
  const database = { prepare(query) { accessQuery = query; return { bind() { return this; }, async first() { return null; } }; } };
  await requirePublicBeginnerSprintCourse(database, "course_it_basic");
  assert.match(accessQuery, /c\.package_tier='basic'/);
  assert.doesNotMatch(accessQuery, /c\.level='beginner'/);

  const sprintPage = readFileSync(new URL("../app/[lang]/classes/[classId]/sprint/page.tsx", import.meta.url), "utf8");
  const sprintRoute = readFileSync(new URL("../app/api/classes/[classId]/sprint/route.ts", import.meta.url), "utf8");
  const sprintClient = readFileSync(new URL("../components/DailySprint.tsx", import.meta.url), "utf8");
  assert.match(sprintPage, /query\.source==="play"/);
  assert.match(sprintPage, /isPublicBeginnerSprintClassId\(classId\)/);
  assert.match(sprintPage, /query\.source==="play"\|\|isPublicBeginnerSprintClassId\(classId\)/);
  assert.match(sprintPage, /publicPlay=\{publicPlay\}/);
  assert.match(sprintRoute, /requirePublicBeginnerSprintCourse/);
  assert.match(sprintRoute, /if \(!value\.anonymous && value\.user\) await value\.database\.prepare\(`INSERT INTO smartlingo_daily_sprint_runs/);
  assert.match(sprintRoute, /anonymous: value\.anonymous/);
  assert.match(sprintClient, /if\(anonymous\)\{setResult\(gradeSprintPlan\(plan,responses\)\)/);
  assert.match(sprintClient, /本次匿名学习不会写入账户或数据库/);
  assert.match(sprintClient, /免费注册/);
  assert.match(sprintClient, /登录/);
  assert.match(sprintClient, /recognition\.stop\(\)/);
  assert.match(sprintClient, /以口语 0 分继续/);
  assert.match(sprintClient, /没有识别到清楚语音/);
  assert.match(sprintClient, /sprint-flip-card/);
  assert.match(sprintClient, /选择正确的意思，或点击卡片翻面/);
  assert.match(sprintClient, /vocabularyAnswers/);
  assert.match(sprintClient, /正确答案：/);
  assert.match(sprintClient, /先听并跟读，再选择正确意思/);
  assert.match(sprintClient, /SentenceBuilderRound/);
});

test("migration adds idempotent rank and redemption ownership boundaries", () => {
  const migration = readFileSync(new URL("../drizzle/0152_daily_sprint_rewards.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE smartlingo_daily_sprint_runs/);
  assert.match(migration, /status IN \('in_progress','completed','abandoned'\)/);
  assert.match(migration, /smartlingo_digital_reward_owner_uq/);
  assert.match(migration, /entry_type IN \([^\n]*'digital_redeem'/);
  assert.match(migration, /smartlingo_course_credit_balance_insert_trg/);
});
