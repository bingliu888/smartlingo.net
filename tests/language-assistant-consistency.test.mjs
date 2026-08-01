import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("English and Chinese routes use matching content", async () => {
  const home = await readFile(new URL("../app/[lang]/page.tsx", import.meta.url), "utf8");
  assert.match(home, /en:\s*\{/);
  assert.match(home, /zh:\s*\{/);
  assert.match(home, /Seven languages, one connected learning loop/);
  assert.match(home, /七种语言，同一套完整学习闭环/);
  assert.match(home, /Create a class\. Coordinate learners\. Build a real community/);
  assert.match(home, /会员自主开班/);
  assert.match(home, /Introducer rewards apply only to platform subscriptions/);
  assert.match(home, /介绍人积分只来自平台订阅付款/);
  assert.match(home, /Messages & Live Chat/);
  assert.match(home, /AI Guru & live audio/);
  assert.match(home, /人工智能导师与实时语音/);
  assert.match(home, /The class owner earns 70%\. The platform receives 30%/);
  assert.match(home, /班主获得 70%，平台获得 30%/);
  assert.doesNotMatch(home, /BACC|Gold|Platinum|21-day|21 天/);
});

test("Guru launcher is icon-only and public", async () => {
  const floating = await readFile(new URL("../components/FloatingAssistant.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/[lang]/assistant/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(floating, /<b>/);
  assert.doesNotMatch(page, /redirect\(/);
});
