import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { playLanguageLinks } from "../lib/play-language-links.ts";

test("Play keeps one selected target language across every language-dependent activity link", () => {
  assert.deepEqual(playLanguageLinks("zh", "ja"), {
    smartcards: "/zh/smartcards?language=ja",
    challenge: "/zh/play/challenge?language=ja",
    rankings: "/zh/play/rankings?language=ja",
  });
  assert.deepEqual(playLanguageLinks("en"), {
    smartcards: "/en/smartcards",
    challenge: "/en/play/challenge",
    rankings: "/en/play/rankings",
  });
});

test("Play renders the shared twelve-language picker after all six activity tiles", () => {
  const source = readFileSync(new URL("../app/[lang]/play/page.tsx", import.meta.url), "utf8");
  assert.match(source, /<section className="game-tiles">[\s\S]*<GameLanguagePicker/);
  assert.match(source, /PlayDailySprintPicker lang=\{lang\} initialLanguage=\{selectedLanguage\}/);
  assert.match(source, /PlayFreeTrialPicker[^>]*initialLanguage=\{selectedLanguage\}/);
});
