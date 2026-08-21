import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDailySessionPlan, QA_TARGET_LANGUAGES } from "../scripts/qa-21-day-session-plan.mjs";

const runner = readFileSync(new URL("../scripts/run-qa-21-day-learning.mjs", import.meta.url), "utf8");
const sessionPlanner = readFileSync(new URL("../scripts/qa-21-day-session-plan.mjs", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/qa-21-day-learning.yml", import.meta.url), "utf8");
const recoveryPrompt = readFileSync(new URL("../docs/qa-21-day-codex-recovery-prompt.md", import.meta.url), "utf8");
const launchAgent = readFileSync(new URL("../ops/com.smartlingo.qa21.recovery.plist", import.meta.url), "utf8");

test("cloud runner is route-only preflight for all required languages and surfaces", () => {
  for (const target of ["en", "ja", "es", "it"]) assert.match(runner, new RegExp(`"${target}"`));
  for (const surface of ["course", "course_trial", "play", "everyday_speaking"]) assert.match(runner, new RegExp(`"${surface}"`));
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
  assert.match(recoveryPrompt, /real Chrome session/);
  for (const skill of ["vocabulary", "reading", "writing", "listening", "speaking"]) {
    assert.match(recoveryPrompt, new RegExp(skill));
  }
  assert.match(recoveryPrompt, /Learn through play/);
  assert.match(recoveryPrompt, /Everyday Speaking/);
  assert.match(recoveryPrompt, /4 languages x \(5 course skills \+ Play \+ Everyday Speaking\)/);
  assert.match(recoveryPrompt, /Close every QA-created Chrome tab/);
  assert.match(recoveryPrompt, /Never weaken an assertion/);
  assert.match(recoveryPrompt, /Repeat diagnosis, fix, deploy, and retest/);
  assert.match(recoveryPrompt, /planned minimum active-learning duration/);
  assert.match(recoveryPrompt, /Never use `sleep`, passive waiting, or repeated no-op clicks/);
  assert.match(recoveryPrompt, /legitimate server-graded score/);
  assert.match(recoveryPrompt, /planned and measured active minutes/);
});

test("daily active-learning plans are bounded, reproducible, and rotate across the campaign", () => {
  const first = createDailySessionPlan("2026-08-21");
  assert.deepEqual(first, createDailySessionPlan("2026-08-21"));
  assert.deepEqual(first.map(item => item.language), QA_TARGET_LANGUAGES);

  for (const item of first) {
    assert.ok(item.minimumActiveMinutes >= 1 && item.minimumActiveMinutes <= 5);
    assert.ok(["vocabulary", "reading", "writing", "listening", "speaking"].includes(item.deepFocus));
    assert.equal(new Set(item.rotationOrder).size, 5);
  }

  const campaignDurations = new Set();
  for (let day = 21; day <= 31; day += 1) {
    for (const item of createDailySessionPlan(`2026-08-${String(day).padStart(2, "0")}`)) {
      campaignDurations.add(item.minimumActiveMinutes);
    }
  }
  for (let day = 1; day <= 10; day += 1) {
    for (const item of createDailySessionPlan(`2026-09-${String(day).padStart(2, "0")}`)) {
      campaignDurations.add(item.minimumActiveMinutes);
    }
  }
  assert.deepEqual([...campaignDurations].sort(), [1, 2, 3, 4, 5]);
});

test("route preflight exports the real-session plan without claiming score evidence", () => {
  assert.match(runner, /requiredRealSessionPlan/);
  assert.match(sessionPlanner, /minimumActiveMinutes/);
  assert.match(runner, /synthetic rows are forbidden/i);
});
