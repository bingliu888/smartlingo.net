import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the production acceptance plan has the required anonymous Play and signed-in Dashboard parts", async () => {
  const plan = await readFile(new URL("../docs/live-production-user-acceptance-plan.md", import.meta.url), "utf8");

  assert.equal((plan.match(/^## Part \d+ —/gm) || []).length, 2);
  for (const value of [
    "Part 1 — anonymous user: test all six Play tiles",
    "Part 2 — signed-in test user: test every Dashboard tile",
    "Chinese interface (`zh`) learning Japanese (`ja`)",
    "English interface (`en`) learning Italian (`it`)",
    "Today’s Sprint",
    "Smart Card Practice",
    "Smart Card Challenge",
    "Rankings",
    "Redeem",
    "Free Beginner Course / Free Trial",
    "Everyday speaking",
    "Subscribed courses",
    "AN-08",
    "MEM-09",
  ]) assert.match(plan, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(plan, /lowest difficulty and then highest frequency/);
  assert.match(plan, /feedback advances automatically after six seconds/);
  assert.match(plan, /records three attempts, shows an individual score for each attempt/);
  assert.match(plan, /refresh and timer extension resume from the anonymous HttpOnly cookie checkpoint/);
  assert.match(plan, /resume durable learning status from D1 for the same member/);
  assert.match(plan, /each tile must display the specific selected language before navigation/);
  assert.match(plan, /Every learning item lists the member’s already subscribed language sections/);
  assert.match(plan, /Choose another language or subscribe action/);
  assert.match(plan, /fix, rebuild, redeploy, and rerun/);
  assert.match(plan, /336 published words across 12 target languages/);
  assert.doesNotMatch(plan, /password\s*[:=]|secret\s*[:=]|token\s*[:=]/i);
});
