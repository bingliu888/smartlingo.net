import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDailySessionPlan, QA_LEARNING_FEATURES, QA_TARGET_LANGUAGES } from "../scripts/qa-21-day-session-plan.mjs";

const runner = readFileSync(new URL("../scripts/run-qa-21-day-learning.mjs", import.meta.url), "utf8");
const sessionPlanner = readFileSync(new URL("../scripts/qa-21-day-session-plan.mjs", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/qa-21-day-learning.yml", import.meta.url), "utf8");
const recoveryPrompt = readFileSync(new URL("../docs/qa-21-day-codex-recovery-prompt.md", import.meta.url), "utf8");
const launchAgent = readFileSync(new URL("../ops/com.smartlingo.qa21.recovery.plist", import.meta.url), "utf8");

test("cloud runner is route-only preflight for all required languages and surfaces", () => {
  for (const target of ["en", "ja", "es", "it"]) assert.match(runner, new RegExp(`"${target}"`));
  for (const surface of ["course", "course_trial", "play", "todays_sprint", "smartcard_practice", "smartcard_challenge", "everyday_speaking", "rankings"]) assert.match(runner, new RegExp(`"${surface}"`));
  assert.match(runner, /anonymous route preflight only/i);
  assert.match(runner, /not login, subscription, learning, speech, score, progress/i);
  assert.doesNotMatch(runner, /INSERT|UPDATE|DELETE|smartlingo_learning_activity_events|smartlingo-project-status/);
});

test("workflow runs at 3 AM PDT for the fixed window without writing learning evidence", () => {
  assert.match(workflow, /cron: "0 10 \* \* \*"/);
  assert.match(workflow, /2026-08-21/);
  assert.match(workflow, /2026-09-10/);
  assert.match(workflow, /route-only preflight evidence/i);
  assert.match(workflow, /Never publish a passed learning report/i);
  assert.doesNotMatch(workflow, /wrangler d1 execute|QA_DAY_COMPLETE|COUNT\(DISTINCT r\.user_id\)/);
});

test("local 3 AM task requires real Gmail, Chrome, login, and complete learning coverage", () => {
  assert.match(launchAgent, /<integer>3<\/integer>/);
  assert.match(launchAgent, /<integer>0<\/integer>/);
  assert.match(launchAgent, /--approve-for-me/);
  assert.doesNotMatch(launchAgent, /danger-full-access|dangerously-bypass/);
  assert.match(recoveryPrompt, /dedicated test learner 1 address/);
  assert.doesNotMatch(recoveryPrompt, /@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.match(recoveryPrompt, /connected Gmail account/);
  assert.match(recoveryPrompt, /standing authorization/);
  assert.match(recoveryPrompt, /Do not pause to request that authorization again/);
  assert.match(recoveryPrompt, /real Chrome session/);
  for (const skill of ["vocabulary", "reading", "writing", "listening", "speaking"]) {
    assert.match(recoveryPrompt, new RegExp(skill));
  }
  assert.match(recoveryPrompt, /Learn through play/);
  assert.match(recoveryPrompt, /shared header, click Learn through play/);
  assert.match(recoveryPrompt, /click the Today task image/);
  assert.match(recoveryPrompt, /dialog opens over the home page without first navigating to Play/);
  assert.match(recoveryPrompt, /\/zh\/play\?language=zh/);
  assert.match(recoveryPrompt, /all six activity tiles/);
  for (const activity of [
    "Today's Sprint",
    "SmartCard Practice",
    "SmartCard Challenge",
    "Free Trial",
    "Rankings",
    "Redeem",
  ]) {
    assert.match(recoveryPrompt, new RegExp(activity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(recoveryPrompt, /twelve-language picker/);
  assert.match(recoveryPrompt, /all six tiles remain\s+visible/);
  assert.match(recoveryPrompt, /Open Today's Sprint for the current target language/);
  assert.match(recoveryPrompt, /5, 10, 15, and 20 minute/);
  assert.match(recoveryPrompt, /10 minutes is selected by default/);
  assert.match(recoveryPrompt, /Select 5 minutes for this bounded\s+daily QA run/);
  assert.match(recoveryPrompt, /complete one entire five-skill round/);
  assert.match(recoveryPrompt, /final server-graded score/);
  assert.match(recoveryPrompt, /persisted signed-in Sprint result/);
  assert.match(recoveryPrompt, /starting without finishing the round is not a pass/);
  assert.match(recoveryPrompt, /Everyday Speaking/);
  assert.match(recoveryPrompt, /Beginner and inspect Intermediate and Advanced entry points/);
  assert.match(recoveryPrompt, /only local today can create a\s+missing question set/);
  assert.match(recoveryPrompt, /date-only YYYY-MM-DD/);
  assert.match(recoveryPrompt, /automatically after six seconds/);
  assert.match(recoveryPrompt, /Repeat after me defaults off/);
  assert.match(recoveryPrompt, /user-language-audio control defaults off/);
  assert.match(recoveryPrompt, /do not request microphone permission during scheduled QA/);
  assert.match(recoveryPrompt, /normal no-microphone path/);
  assert.match(recoveryPrompt, /Score History/);
  assert.match(recoveryPrompt, /Rankings/);
  assert.match(recoveryPrompt, /4 languages x \(Dashboard language section \+ 5 Course skills \+ completed\s+Today's Sprint \+ SmartCard Practice \+ SmartCard Challenge interaction \+ Everyday Speaking \+\s+Score History \+ Rankings\)/);
  assert.match(recoveryPrompt, /Close every QA-created Chrome tab/);
  assert.match(recoveryPrompt, /Never weaken an assertion/);
  assert.match(recoveryPrompt, /Repeat diagnosis, fix, deploy, and retest/);
  assert.match(recoveryPrompt, /planned minimum active-learning duration/);
  assert.match(recoveryPrompt, /Never use `sleep`, passive waiting, or repeated no-op clicks/);
  assert.match(recoveryPrompt, /legitimate server-graded score/);
  assert.match(recoveryPrompt, /planned and measured active minutes/);
  assert.match(recoveryPrompt, /all 36 official courses/);
  assert.match(recoveryPrompt, /exactly 120 prebuilt sentences per course/);
  assert.match(recoveryPrompt, /Listening must play the target-language sentence without displaying it as the prompt/);
  assert.match(recoveryPrompt, /selectable target-language word tiles/);
  assert.match(recoveryPrompt, /Writing must visibly show a sentence in the learner's interface language/);
  assert.match(recoveryPrompt, /show selectable words in the target language/);
  assert.match(recoveryPrompt, /merely opening a tab, playing audio,\s+or clicking unordered tiles is not a pass/);
});

test("daily active-learning plans are bounded, reproducible, and rotate across the campaign", () => {
  const first = createDailySessionPlan("2026-08-21");
  assert.deepEqual(first, createDailySessionPlan("2026-08-21"));
  assert.deepEqual(first.map(item => item.language), QA_TARGET_LANGUAGES);

  for (const item of first) {
    assert.ok(item.minimumActiveMinutes >= 1 && item.minimumActiveMinutes <= 5);
    assert.ok(["vocabulary", "reading", "writing", "listening", "speaking"].includes(item.deepFocus));
    assert.ok(QA_LEARNING_FEATURES.includes(item.featureFocus));
    assert.equal(new Set(item.rotationOrder).size, 5);
  }

  const campaignDurations = new Set();
  const campaignFeatureFoci = new Set();
  for (let day = 21; day <= 31; day += 1) {
    for (const item of createDailySessionPlan(`2026-08-${String(day).padStart(2, "0")}`)) {
      campaignDurations.add(item.minimumActiveMinutes);
      campaignFeatureFoci.add(item.featureFocus);
    }
  }
  for (let day = 1; day <= 10; day += 1) {
    for (const item of createDailySessionPlan(`2026-09-${String(day).padStart(2, "0")}`)) {
      campaignDurations.add(item.minimumActiveMinutes);
      campaignFeatureFoci.add(item.featureFocus);
    }
  }
  assert.deepEqual([...campaignDurations].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual([...campaignFeatureFoci].sort(), [...QA_LEARNING_FEATURES].sort());
});

test("route preflight exports the real-session plan without claiming score evidence", () => {
  assert.match(runner, /requiredRealSessionPlan/);
  assert.match(sessionPlanner, /minimumActiveMinutes/);
  assert.match(runner, /synthetic rows are forbidden/i);
});
