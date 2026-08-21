import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("English and Chinese routes use matching content", async () => {
  const [home, choices, assistant, live] = await Promise.all([
    readFile(new URL("../app/[lang]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/HomeLearningChoices.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assistant/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assistant/live/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(home, /en:\s*\{/);
  assert.match(home, /zh:\s*\{/);
  assert.match(home, /Twelve languages, one connected learning loop/);
  assert.match(home, /十二种语言，同一套完整学习闭环/);
  assert.match(home, /Build vocabulary, read, write, listen, and hold real dialogue/);
  assert.match(home, /练词汇、做阅读、写作、听力和真实对话/);
  assert.match(home, /Choose the depth of training that fits your goal/);
  assert.match(home, /三级课程/);
  assert.match(home, /Three point types stay separate and auditable/);
  assert.match(home, /三类积分独立记账、可追溯/);
  assert.match(home, /Verified SmartCard challenge points can offset only a SmartLingo course month/);
  assert.match(home, /经验证的 SmartCard 挑战积分只能抵 SmartLingo 课程月费/);
  for (const label of ["Everyday speaking", "生活口语", "Learn through play", "边玩边学", "Choose a course", "选择课程", "Ask AI", "咨询AI"]) assert.match(choices, new RegExp(label));
  assert.match(home, /Messages & Live Chat/);
  assert.match(home, /AI Guru & live audio/);
  assert.match(home, /人工智能导师与实时语音/);
  assert.match(home, /Your first month is free/);
  assert.match(home, /第一个月免费/);
  assert.match(assistant, /Chinese, English, Spanish, Japanese, Korean, French, German, Russian, Italian, Portuguese, Arabic, and Hindi/);
  for (const skill of ["vocabulary", "reading", "writing", "listening", "dialogue"]) {
    assert.match(assistant, new RegExp(skill));
    assert.match(live, new RegExp(skill));
  }
  assert.doesNotMatch(home, /BACC|Gold|Platinum|21-day|21 天/);
});

test("Guru launcher is icon-only and public", async () => {
  const floating = await readFile(new URL("../components/FloatingAssistant.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/[lang]/assistant/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(floating, /<b>/);
  assert.doesNotMatch(page, /redirect\(/);
});
