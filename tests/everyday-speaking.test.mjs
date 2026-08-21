import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { buildEverydaySpeakingDeck, SMARTLINGO_EVERYDAY_SCENARIOS } from "../lib/smartlingo-everyday-speaking.ts";
import { SMARTLINGO_COMMUNITY_LANGUAGE_CODES } from "../lib/smartlingo-language-communities.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("everyday speaking provides twelve illustrated scenarios and twelve slides in every target language", async () => {
  assert.equal(SMARTLINGO_EVERYDAY_SCENARIOS.length, 12);
  assert.equal(SMARTLINGO_COMMUNITY_LANGUAGE_CODES.length, 12);
  for (const scene of SMARTLINGO_EVERYDAY_SCENARIOS) {
    await access(new URL(`../public/everyday-speaking/${scene.id}.jpg`, import.meta.url));
    for (const language of SMARTLINGO_COMMUNITY_LANGUAGE_CODES) {
      const deck = buildEverydaySpeakingDeck(language, scene.id);
      assert.equal(deck.length, 12, `${language}/${scene.id}`);
      for (const slide of deck) {
        assert.ok(slide.form.trim());
        assert.ok(slide.pronunciation.trim());
        assert.ok(slide.meaningZh.trim());
        assert.ok(slide.meaningEn.trim());
      }
    }
  }
});

test("course details replace the back button with language-preserving everyday speaking", async () => {
  const page = await read("../app/[lang]/programs/[language]/page.tsx");
  assert.match(page, /play\/everyday\?language=\$\{language\}/);
  assert.match(page, /生活口语/);
  assert.match(page, /Everyday Speaking/);
  assert.doesNotMatch(page, /返回选择课程|Back to courses/);
});

test("the player includes autoplay, speech scoring, complete navigation controls, replay, and quit", async () => {
  const player = await read("../components/EverydaySpeakingPlayer.tsx");
  for (const marker of ["speechSynthesis", "SpeechRecognition", "scoreSmartCardPronunciation", "开始自动课程", "再玩一次", "第一张", "上一张", "下一张", "最后一张", "暂停", "退出"]) assert.match(player, new RegExp(marker));
  assert.match(player, /slides\.length/);
  assert.match(player, /move\(0\)/);
  assert.match(player, /move\(slides\.length - 1\)/);
});

test("mobile header never displays the separate account icon beside the hamburger", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.site-header \.header-actions \{ display: none; \}[\s\S]*?\.site-header \.hamburger-button \{ display: inline-grid;/);
  assert.doesNotMatch(css, /@media\(max-width:1100px\)[\s\S]{0,300}\.site-header \.header-actions\{display:flex\}/);
});
