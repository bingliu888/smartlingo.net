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

test("home routes Play to its full hub while the three detailed panels and dashboard remain language-aware", async () => {
  const [home, choices, dashboard, dashboardHub, header, assistant, assistantRoute] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../components/HomeLearningChoices.tsx"),
    read("../app/[lang]/dashboard/page.tsx"),
    read("../components/DashboardLearningHub.tsx"),
    read("../components/SiteHeader.tsx"),
    read("../components/AssistantClient.tsx"),
    read("../app/api/assistant/route.ts"),
  ]);
  for (const label of ["生活口语", "边玩边学", "选择课程", "咨询AI"]) {
    assert.match(header, new RegExp(label));
  }
  for (const label of ["生活口语", "选择课程", "咨询AI"]) assert.match(choices, new RegExp(label));
  assert.match(home, /href=\{`\/\$\{lang\}\/play\?language=\$\{lang\}`\}/);
  assert.doesNotMatch(choices, /area: "play"/);
  assert.match(home, /HomeLearningChoices/);
  assert.match(choices, /SMARTLINGO_EVERYDAY_SCENARIOS/);
  assert.match(choices, /SMARTLINGO_LANGUAGE_COMMUNITIES/);
  assert.match(choices, /scrollBy/);
  assert.match(dashboard, /DashboardLearningHub/);
  assert.match(dashboard, /smartlingo_language_class_members/);
  for (const path of ["play/everyday", "play/challenge", "classes", "assistant"]) assert.match(dashboardHub, new RegExp(path));
  assert.match(assistant, /targetLanguage/);
  assert.match(assistantRoute, /targetInstruction/);
});
