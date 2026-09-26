import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { joinedLanguageCodes, tutorLearningLanguage } = await tsImport("../lib/learning-language-codes.ts", import.meta.url);
const { localizedPath } = await tsImport("../components/InterfaceLanguageMenu.tsx", import.meta.url);

test("learning language is independent of the website language", () => {
  const recentFirst = joinedLanguageCodes(["ja", "en", "ja", "invalid"]);
  assert.deepEqual(recentFirst, ["ja", "en"]);
  assert.equal(tutorLearningLanguage(undefined, recentFirst), "ja");
  assert.equal(tutorLearningLanguage("en", recentFirst), "en");
  assert.equal(tutorLearningLanguage("invalid", recentFirst), "ja");
  assert.equal(tutorLearningLanguage(undefined, []), null);
});

test("switching site language keeps the current learning-language route and selection", () => {
  assert.equal(localizedPath("/en/max/tutor", "zh", "?language=ja", "#practice"), "/zh/max/tutor?language=ja#practice");
  assert.equal(localizedPath("/en/programs/ja", "fr", "?path=max", ""), "/fr/programs/ja?path=max");
});
