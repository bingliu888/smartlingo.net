import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SMARTLINGO_LEARNING_DAYS,
  learningDayTopic,
  learningReward,
  nextLearningDay,
  safeLearningDay,
} from "../lib/smartlingo-learning-days.ts";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("all learning levels expose a complete easiest-to-capstone 21-day path", () => {
  assert.equal(SMARTLINGO_LEARNING_DAYS, 21);
  assert.equal(safeLearningDay(-4), 1);
  assert.equal(safeLearningDay(99), 21);
  for (const level of ["beginner", "intermediate", "advanced"]) {
    const topics = Array.from({ length: 21 }, (_, index) => learningDayTopic(level, index + 1));
    assert.equal(topics.length, 21);
    assert.equal(new Set(topics.map(item => item.en)).size, 21);
    assert.ok(topics.every(item => item.en && item.zh));
  }
});

test("reward lookup and member auto-next use server-owned score history", async () => {
  const rewardDatabase = { prepare() { return { bind() { return { async first() { return { rewardPoints: 55 }; } }; } }; } };
  assert.equal(await learningReward(rewardDatabase, "course", "intermediate", 96), 55);

  const dayDatabase = { prepare() { return { bind() { return { async run() { return { results: [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 4 }] }; } }; } }; } };
  assert.equal(await nextLearningDay(dayDatabase, "learner", "sprint", "beginner", "ja"), 3);
});

test("Sprint, SmartCard, courses, rewards, score history, and rankings share the day model", () => {
  const picker = source("../components/LearningDayPicker.tsx");
  const sprintPicker = source("../components/PlayDailySprintPicker.tsx");
  const sprintRoute = source("../app/api/classes/[classId]/sprint/route.ts");
  const smartcardRoute = source("../app/api/smartcards/[token]/route.ts");
  const courseRoute = source("../app/api/classes/[classId]/learning/route.ts");
  const rewardRoute = source("../app/api/admin/learning-rewards/route.ts");
  const rankingPage = source("../components/RankingHub.tsx");
  const scorePage = source("../app/[lang]/score-history/page.tsx");
  const migration = source("../drizzle/0167_learning_days_rewards_rankings.sql");

  for (const marker of [">≪</", ">‹</", ">›</", ">≫</"]) assert.match(picker, new RegExp(marker));
  assert.match(sprintPicker, /LearningDayPicker/);
  assert.match(sprintPicker, /day=\$\{day\}/);
  assert.match(sprintRoute, /ORDER BY difficulty ASC,frequency_degree DESC,sequence,id LIMIT 1000/);
  assert.match(sprintRoute, /\(dayNumber - 1\) \* 20/);
  assert.match(sprintRoute, /nextLearningDay/);
  assert.match(smartcardRoute, /LIMIT 500/);
  assert.match(smartcardRoute, /smartlingo_smartcard_daily_question_sets/);
  assert.match(smartcardRoute, /dailyQuestionIds/);
  assert.match(smartcardRoute, /dateFor\(body\.timeZone\)/);
  assert.match(courseRoute, /select_course_day/);
  assert.match(courseRoute, /Math\.min\(21/);
  assert.match(rewardRoute, /rules\.length>100/);
  assert.match(rewardRoute, /isBootstrapAdminEmail/);
  for (const category of ["sprint", "smartcard_challenge", "course_beginner", "course_intermediate", "course_advanced"]) assert.match(rankingPage, new RegExp(category));
  assert.match(scorePage, /每日记录/);
  assert.match(scorePage, /View rankings/);
  assert.match(migration, /smartlingo_learning_reward_rules/);
  assert.match(migration, /smartlingo_learning_score_history/);
  assert.match(migration, /smartlingo_smartcard_daily_question_sets/);
});

test("level tiles, fallback pictures, and genuinely slow speech are visible contracts", () => {
  const everyday = source("../app/[lang]/play/everyday/page.tsx");
  const challenge = source("../components/SmartCardChallengeCalendar.tsx");
  const picture = source("../components/VocabularyPicture.tsx");
  const speech = source("../lib/smartlingo-speech.ts");
  const course = source("../components/LearningWorkspace.tsx");
  const everydayPlayer = source("../components/EverydaySpeakingPlayer.tsx");

  assert.match(everyday, /level=beginner/);
  assert.match(everyday, /level=intermediate/);
  assert.match(everyday, /level=advanced/);
  assert.match(everyday, /进入初级场景/);
  assert.match(challenge, /level=intermediate/);
  assert.match(challenge, /level=advanced/);
  assert.match(picture, /vocabulary-picture-fallback/);
  assert.match(picture, /generic concept illustration/);
  assert.match(speech, /slow \? \.42/);
  assert.match(course, /speakLearningText/);
  assert.match(everydayPlayer, /slow \? \.42/);
});
