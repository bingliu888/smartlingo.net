import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the live production plan fixes the default anonymous and free-subscriber matrix", async () => {
  const plan = await readFile(new URL("../docs/live-production-user-acceptance-plan.md", import.meta.url), "utf8");
  for (const value of [
    "Interface language: Chinese",
    "Target language: English",
    "official Beginner / Basic course",
    "Anonymous visitor suite",
    "Free-month subscriber suite",
    "AN-07",
    "SUB-03",
    "SUB-06",
    "SUB-07",
    "SUB-15",
  ]) assert.match(plan, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(plan, /fix, rebuild, redeploy, and rerun/);
  assert.match(plan, /336 published words across 12 target languages/);
  assert.match(plan, /target-language phonetics, English sound guidance, and Chinese sound guidance/);
  assert.match(plan, /create no authenticated API write, cookie-based learner record, localStorage, sessionStorage, or IndexedDB progress/);
  assert.doesNotMatch(plan, /password\s*[:=]|secret\s*[:=]|token\s*[:=]/i);
});
