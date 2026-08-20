import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../drizzle/0128_qa_21_day_learning.sql", import.meta.url), "utf8");
const singleLearnerMigration = readFileSync(new URL("../drizzle/0129_qa_single_learner.sql", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/run-qa-21-day-learning.mjs", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/qa-21-day-learning.yml", import.meta.url), "utf8");
const recoveryPrompt = readFileSync(new URL("../docs/qa-21-day-codex-recovery-prompt.md", import.meta.url), "utf8");
const launchAgent = readFileSync(new URL("../ops/com.smartlingo.qa21.recovery.plist", import.meta.url), "utf8");

test("one isolated QA account covers the four requested target languages", () => {
  assert.match(migration, /smartlingo-qa-21d-zh/);
  assert.match(migration, /\["en","ja","es","it"\]/);
  assert.match(migration, /system-managed-disabled/);
  assert.match(singleLearnerMigration, /DELETE FROM users WHERE id='smartlingo-qa-21d-en'/);
});

test("daily runner covers all five skills without awarding XP or rewards", () => {
  for (const skill of ["vocabulary", "speaking", "listening", "writing", "quiz"]) {
    assert.match(runner, new RegExp(`key: "${skill}"`));
  }
  assert.match(runner, /source_type,source_id/);
  assert.doesNotMatch(runner, /learning_xp_ledger|reward_ledger|course_credit_ledger/);
  assert.doesNotMatch(runner, /BEGIN TRANSACTION|COMMIT;/);
  assert.match(runner, /remote D1 file importer provides the atomic upload boundary/);
  assert.match(runner, /not human speech or human grading/);
  assert.match(runner, /smartlingo-project-status/);
  assert.match(runner, /fix, deploy, and rerun/);
});

test("workflow runs at 3 AM PDT for exactly the fixed 21-day window", () => {
  assert.match(workflow, /cron: "0 10 \* \* \*"/);
  assert.match(workflow, /2026-08-21/);
  assert.match(workflow, /2026-09-10/);
  assert.match(workflow, /COUNT\(DISTINCT r\.user_id\)=1/);
  assert.match(workflow, /COUNT\(DISTINCT r\.id\)=4/);
  assert.match(workflow, /COUNT\(i\.id\)=20/);
  assert.match(workflow, /SUM\(i\.passed\)=20/);
});

test("sandboxed Codex recovery starts after cloud QA and cannot fake success", () => {
  assert.match(launchAgent, /<integer>3<\/integer>/);
  assert.match(launchAgent, /<integer>5<\/integer>/);
  assert.match(launchAgent, /--approve-for-me/);
  assert.doesNotMatch(launchAgent, /danger-full-access/);
  assert.doesNotMatch(launchAgent, /dangerously-bypass/);
  assert.match(launchAgent, /2026-08-21/);
  assert.match(launchAgent, /2026-09-10/);
  assert.match(recoveryPrompt, /Never weaken an assertion/);
  assert.match(recoveryPrompt, /Repeat diagnosis,/);
  assert.match(recoveryPrompt, /payment, reward, referral, leaderboard/);
});
