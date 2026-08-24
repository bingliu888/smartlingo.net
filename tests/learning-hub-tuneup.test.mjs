import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { vocabularyLibraryPage } from "../lib/smartlingo-learning-hub.ts";
import { repeatAfterMeEnabled } from "../components/useRepeatAfterMePreference.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("repeat after me defaults on and only an explicit off disables it", () => {
  assert.equal(repeatAfterMeEnabled(null), true);
  assert.equal(repeatAfterMeEnabled("on"), true);
  assert.equal(repeatAfterMeEnabled("off"), false);
});

test("vocabulary library pagination returns exactly twenty and clamps pages", () => {
  const words = Array.from({ length: 100 }, (_, index) => `word-${index + 1}`);
  assert.deepEqual(vocabularyLibraryPage(words, 1).items, words.slice(0, 20));
  assert.deepEqual(vocabularyLibraryPage(words, 3).items, words.slice(40, 60));
  const last = vocabularyLibraryPage(words, 99);
  assert.equal(last.page, 5);
  assert.equal(last.start, 81);
  assert.equal(last.end, 100);
  assert.equal(last.items.length, 20);
});

test("home and dashboard use canonical feature routes without duplicate home panels", async () => {
  const [home, dashboard, dashboardHub, header, assistant, assistantRoute, locale] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../app/[lang]/dashboard/page.tsx"),
    read("../components/DashboardLearningHub.tsx"),
    read("../components/SiteHeader.tsx"),
    read("../components/AssistantClient.tsx"),
    read("../app/api/assistant/route.ts"),
    read("../lib/interface-locale.ts"),
  ]);
  for (const label of ["生活口语", "边玩边学", "选择课程", "咨询AI"]) {
    assert.match(locale, new RegExp(label));
  }
  assert.match(home, /href=\{`\/\$\{locale\}\/play\?language=\$\{locale\}`\}/);
  for (const route of ["play/everyday", "programs", "colleges", "assistant"]) assert.match(home, new RegExp(route));
  assert.doesNotMatch(home, /HomeLearningChoices|home-everyday|home-courses|home-colleges|home-ai/);
  assert.match(dashboard, /DashboardLearningHub/);
  assert.match(dashboard, /smartlingo_language_class_members/);
  for (const path of ["play/everyday", "play/challenge", "classes", "assistant"]) assert.match(dashboardHub, new RegExp(path));
  for (const label of ["Smart Card Practice", "Smart Card Challenge", "Everyday speaking", "My courses"]) assert.match(dashboardHub, new RegExp(label));
  assert.match(dashboardHub, /type Area = "everyday" \| "smartcards" \| "challenge" \| "courses" \| "ai"/);
  assert.match(dashboardHub, /smartcards\/starter-\$\{language\.code\}/);
  assert.match(dashboardHub, /play\/challenge\?language=\$\{language\.code\}/);
  assert.match(dashboardHub, /Selected: \$\{language\.nameEn\}/);
  assert.match(dashboardHub, /Choose another language or subscribe/);
  assert.match(dashboardHub, /href=\{`\/\$\{lang\}\/programs`\}/);
  assert.match(assistant, /targetLanguage/);
  assert.match(assistantRoute, /targetInstruction/);
});
