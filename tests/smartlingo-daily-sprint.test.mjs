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
  difficulty: 1 + Math.floor(index / 250),
  frequencyDegree: 10 - (index % 10),
}));

test("Daily Sprint offers the four requested durations and one complete five-skill round per five minutes", () => {
  assert.deepEqual(SPRINT_DURATIONS, [5, 10, 15, 20]);
  for (const durationMinutes of SPRINT_DURATIONS) {
    const plan = buildSprintPlan({ runId: `run-${durationMinutes}`, language: "en", level: "beginner", uiLang: "zh", durationMinutes, vocabulary });
    assert.equal(plan.rounds.length, durationMinutes / 5);
    assert.equal(new Set(plan.rounds.flatMap(round => round.vocabulary.map(item => item.id))).size, durationMinutes);
    for (const round of plan.rounds) {
      assert.equal(round.vocabulary.length, 5);
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

test("course and anonymous Play expose six isolated learning activities", () => {
  const menu = readFileSync(new URL("../components/CourseTrainingMenu.tsx", import.meta.url), "utf8");
  const play = readFileSync(new URL("../app/[lang]/play/page.tsx", import.meta.url), "utf8");
  const playPicker = readFileSync(new URL("../components/PlayDailySprintPicker.tsx", import.meta.url), "utf8");
  const freeTrialPicker = readFileSync(new URL("../components/PlayFreeTrialPicker.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/[lang]/dashboard/page.tsx", import.meta.url), "utf8");
  const dashboardSprint = readFileSync(new URL("../components/DashboardDailySprint.tsx", import.meta.url), "utf8");
  const sprintRoute = readFileSync(new URL("../app/api/classes/[classId]/sprint/route.ts", import.meta.url), "utf8");
  const rewardsRoute = readFileSync(new URL("../app/api/rewards/redeem/route.ts", import.meta.url), "utf8");
  assert.match(menu, /今日速成/);
  assert.match(menu, /\[5,10,15,20\]/);
  assert.match(play, /PlayDailySprintPicker/);
  for (const tile of ["智慧卡练习", "智慧卡挑战", "兑换", "排行榜"]) assert.match(play, new RegExp(tile));
  assert.match(freeTrialPicker, /免费试学/);
  assert.match(play, /PlayFreeTrialPicker/);
  assert.match(freeTrialPicker, /免费试学/);
  assert.match(freeTrialPicker, /course_\$\{language\}_basic\/trial\/\$\{skill\.id\}/);
  assert.match(play, /href=\{`\/\$\{lang\}\/smartcards`\}/);
  assert.match(play, /href=\{`\/\$\{lang\}\/play\/redeem`\}/);
  assert.doesNotMatch(play, /searchParams|query\.language|initialLanguage=/);
  assert.match(playPicker, /今日速成/);
  assert.match(playPicker, /useState<\(typeof DURATIONS\)\[number\]>\(10\)/);
  assert.match(playPicker, /selection\.source === initialTarget \? selection\.value : initialTarget/);
  assert.match(playPicker, /setSelection\(\{ source: initialTarget, value: item\.code \}\)/);
  assert.match(playPicker, /course_\$\{language\}_basic\/sprint\?minutes=/);
  assert.match(playPicker, /source=play/);
  assert.match(play, /play\/rankings/);
  assert.match(dashboard, /DashboardDailySprint/);
  assert.match(dashboardSprint, /添加语言/);
  assert.equal((dashboardSprint.match(/Add language/g) || []).length, 1);
  assert.match(dashboardSprint, /minutes\[language\.code\] \|\| 10/);
  assert.match(sprintRoute, /requireOfficialClassMembership/);
  assert.match(sprintRoute, /status='completed'/);
  assert.match(rewardsRoute, /smartlingo_course_credit_ledger/);
  assert.match(rewardsRoute, /digital_redeem/);
});

test("Home feature buttons use the same canonical pages as navigation, and the task image opens Sprint", () => {
  const header = readFileSync(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/[lang]/page.tsx", import.meta.url), "utf8");
  assert.ok(header.indexOf("t.courses") < header.indexOf("t.colleges"));
  assert.ok(home.indexOf('href={`/${locale}/programs`}') < home.indexOf('href={`/${locale}/colleges`}'));
  for (const path of ["play/everyday", "programs", "colleges", "assistant"]) assert.match(home, new RegExp(path));
  assert.match(home, /play\?language=\$\{locale\}/);
  assert.doesNotMatch(home, /HomeLearningChoices|home-everyday|home-courses|home-colleges|home-ai/);
  assert.match(home, /PlayDailySprintPicker lang=\{locale\} initialLanguage=\{locale\}/);
  assert.match(home, /triggerClassName="lingo-hero-visual"/);
  assert.match(home, /triggerLabel=\{ui\.openSprint\}/);
  assert.doesNotMatch(home, /className="lingo-hero-visual" href=/);
  assert.match(home, /lingo-community-art/);
  assert.match(home, /lingo-task-action/);
  assert.match(home, /href=\{`\/\$\{locale\}\/play\?language=\$\{locale\}`\}/);
});

test("anonymous Sprint overwrites its short cookie while signed-in members resume D1 checkpoints", async () => {
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
  const sentenceBuilder = readFileSync(new URL("../components/SentenceBuilderRound.tsx", import.meta.url), "utf8");
  assert.match(sprintPage, /query\.source==="play"/);
  assert.match(sprintPage, /isPublicBeginnerSprintClassId\(classId\)/);
  assert.match(sprintPage, /query\.source==="play"\|\|isPublicBeginnerSprintClassId\(classId\)/);
  assert.match(sprintPage, /publicPlay=\{publicPlay\}/);
  assert.match(sprintRoute, /requirePublicBeginnerSprintCourse/);
  assert.match(sprintRoute, /if \(!value\.anonymous && value\.user\) await value\.database\.batch\(\[/);
  assert.match(sprintRoute, /smartlingo_daily_sprint_run_days/);
  assert.match(sprintRoute, /anonymous: value\.anonymous/);
  assert.doesNotMatch(sprintClient, /document\.cookie|localStorage|sessionStorage|resumeRunId/);
  assert.match(sprintClient, /if \(!plan \|\| !runId/);
  assert.match(sprintClient, /action: "checkpoint"/);
  assert.match(sprintRoute, /progress_json AS progressJson/);
  assert.match(sprintRoute, /run\.status='in_progress' ORDER BY run\.started_at DESC LIMIT 1/);
  assert.match(sprintRoute, /smartlingo-anonymous-sprint/);
  assert.match(sprintRoute, /Set-Cookie/);
  assert.match(sprintRoute, /Max-Age=7200/);
  assert.match(sprintRoute, /if \(value\.anonymous \|\| !value\.user\)/);
  assert.match(sprintClient, /免费注册/);
  assert.match(sprintClient, /登录/);
  assert.match(sprintClient, /recognition\.stop\(\)/);
  assert.match(sprintClient, /scoreSmartCardPronunciation/);
  assert.match(sprintClient, /三次跟读完成，平均/);
  assert.match(sprintClient, /\[1,2,3\]/);
  assert.doesNotMatch(sprintClient, /再跟读一次/);
  assert.doesNotMatch(sprintClient, /beginSpeech\(/);
  assert.doesNotMatch(sprintClient, /if \(!round \|\| !word \|\| !vocabChecked\) return/);
  assert.match(sprintClient, /sprint-flip-card/);
  assert.match(sprintClient, /VocabularyPicture/);
  assert.match(sprintClient, /useState\(false\).*repeatAfterMe|repeatAfterMe, setRepeatAfterMe/s);
  assert.match(sprintClient, /选择正确的意思，或点击卡片翻面/);
  assert.match(sprintClient, /vocabularyAnswers/);
  assert.match(sprintClient, /正确答案：/);
  assert.match(sprintClient, /跟读句子三遍，再选择正确意思/);
  assert.match(sprintClient, /SentenceBuilderRound/);
  assert.doesNotMatch(sprintClient, /<SentenceBuilderRound autoAdvance/);
  assert.match(sentenceBuilder, /const exerciseKey = exercises\.map\(item => item\.id\)\.join\("\|"\)/);
  assert.match(sentenceBuilder, /\}, \[exerciseKey\]\)/);
  assert.doesNotMatch(sentenceBuilder, /\}, \[exercises\]\)/);
  assert.match(sprintClient, /word\.pronunciation \? <b>/);
  assert.match(sprintClient, /剩余时间/);
  assert.match(sprintClient, /是否延长 5 分钟完成/);
  assert.match(sprintClient, /setRemainingSeconds\(300\)/);
  assert.match(sprintClient, /否，退出/);
  assert.match(sprintRoute, /ORDER BY difficulty ASC,frequency_degree DESC,sequence,id/);
  assert.match(sprintRoute, /adaptiveSentenceRounds/);
  assert.doesNotMatch(sprintRoute, /resumeRunId/);
});

test("sentence building always crosses from one language to another", () => {
  const zhTarget = buildSprintPlan({ runId: "bridge-zh", language: "zh", level: "beginner", uiLang: "zh", durationMinutes: 5, vocabulary });
  const enTarget = buildSprintPlan({ runId: "bridge-en", language: "en", level: "beginner", uiLang: "en", durationMinutes: 5, vocabulary });
  for (const plan of [zhTarget, enTarget]) {
    const round = plan.rounds[0];
    assert.notEqual(round.listening.sourceLanguage, round.listening.answerLanguage);
    assert.notEqual(round.writing.sourceLanguage, round.writing.answerLanguage);
    assert.notEqual(round.listening.expected, round.listening.audioText);
  }
  const sentenceBuilder = readFileSync(new URL("../components/SentenceBuilderRound.tsx", import.meta.url), "utf8");
  assert.match(sentenceBuilder, /Listen in \$\{sourceName\}; build the meaning in \$\{answerName\}/);
  assert.match(sentenceBuilder, /Read in \$\{sourceName\}; build the sentence in \$\{answerName\}/);
});

test("migration adds idempotent rank and redemption ownership boundaries", () => {
  const migration = readFileSync(new URL("../drizzle/0152_daily_sprint_rewards.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE smartlingo_daily_sprint_runs/);
  assert.match(migration, /status IN \('in_progress','completed','abandoned'\)/);
  assert.match(migration, /smartlingo_digital_reward_owner_uq/);
  assert.match(migration, /entry_type IN \([^\n]*'digital_redeem'/);
  assert.match(migration, /smartlingo_course_credit_balance_insert_trg/);
});

test("Sprint resume migration stores member-only checkpoints", () => {
  const migration = readFileSync(new URL("../drizzle/0157_daily_sprint_resume.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN progress_json TEXT NOT NULL DEFAULT '\{\}' CHECK\(json_valid\(progress_json\)\)/);
  assert.match(migration, /ADD COLUMN checkpointed_at INTEGER/);
  assert.match(migration, /user_id,class_id,status,started_at DESC/);
});
