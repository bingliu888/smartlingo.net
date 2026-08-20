import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../drizzle/0128_qa_21_day_learning.sql", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/run-qa-21-day-learning.mjs", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/qa-21-day-learning.yml", import.meta.url), "utf8");

test("two isolated QA accounts cover the requested interface and target languages", () => {
  assert.match(migration, /smartlingo-qa-21d-zh/);
  assert.match(migration, /smartlingo-qa-21d-en/);
  assert.match(migration, /\["en","ja","es","it"\]/);
  assert.match(migration, /\["zh","ja","es","it"\]/);
  assert.match(migration, /system-managed-disabled/);
});

test("daily runner covers all five skills without awarding XP or rewards", () => {
  for (const skill of ["vocabulary", "speaking", "listening", "writing", "quiz"]) {
    assert.match(runner, new RegExp(`key: "${skill}"`));
  }
  assert.match(runner, /source_type,source_id/);
  assert.doesNotMatch(runner, /learning_xp_ledger|reward_ledger|course_credit_ledger/);
  assert.match(runner, /not human speech or human grading/);
  assert.match(runner, /smartlingo-project-status/);
  assert.match(runner, /fix, deploy, and rerun/);
});

test("workflow runs at 3 AM PDT for exactly the fixed 21-day window", () => {
  assert.match(workflow, /cron: "0 10 \* \* \*"/);
  assert.match(workflow, /2026-08-21/);
  assert.match(workflow, /2026-09-10/);
  assert.match(workflow, /COUNT\(DISTINCT r\.user_id\)=2/);
  assert.match(workflow, /COUNT\(DISTINCT r\.id\)=8/);
  assert.match(workflow, /COUNT\(i\.id\)=40/);
  assert.match(workflow, /SUM\(i\.passed\)=40/);
});
