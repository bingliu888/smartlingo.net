import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { buildEverydaySpeakingDeck, SMARTLINGO_EVERYDAY_SCENARIOS } from "../lib/smartlingo-everyday-speaking.ts";
import { SMARTLINGO_COMMUNITY_LANGUAGE_CODES } from "../lib/smartlingo-language-communities.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("everyday speaking provides twelve illustrated three-level scenarios with vocabulary and practical dialogue", async () => {
  assert.equal(SMARTLINGO_EVERYDAY_SCENARIOS.length, 12);
  assert.equal(SMARTLINGO_COMMUNITY_LANGUAGE_CODES.length, 12);
  for (const scene of SMARTLINGO_EVERYDAY_SCENARIOS) {
    await access(new URL(`../public/everyday-speaking/${scene.id}.jpg`, import.meta.url));
    for (const language of SMARTLINGO_COMMUNITY_LANGUAGE_CODES) {
      for (const level of ["beginner", "intermediate", "advanced"]) {
        const deck = buildEverydaySpeakingDeck(language, scene.id, level);
        assert.ok(deck.length >= 24, `${language}/${scene.id}/${level}`);
        assert.ok(deck.some(slide => slide.kind === "word"));
        const dialogue = deck.filter(slide => slide.kind === "sentence");
        assert.equal(dialogue.length, 20, `${language}/${scene.id}/${level} dialogue turns`);
        assert.equal(new Set(dialogue.map(slide => slide.pairIndex)).size, 10);
        for (let pair = 0; pair < 10; pair += 1) {
          const turns = dialogue.filter(slide => slide.pairIndex === pair);
          assert.deepEqual(turns.map(slide => slide.role), ["staff", "learner"]);
        }
        for (const slide of deck) {
          assert.ok(slide.form.trim());
          assert.ok(slide.meaningZh.trim());
          assert.ok(slide.meaningEn.trim());
        }
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

test("the player includes three scored attempts, two speeds, explicit continuation, replay, and quit", async () => {
  const player = await read("../components/EverydaySpeakingPlayer.tsx");
  for (const marker of ["speechSynthesis", "SpeechRecognition", "MediaRecorder", "getUserMedia", "scoreSmartCardPronunciation", "开始真实场景对话", "再玩一次", "第一张", "上一张", "下一张", "最后一张", "暂停", "退出", "正常语速", "慢速", "三次跟读", "Continue", "真实对话", "VocabularyPicture"]) assert.match(player, new RegExp(marker));
  assert.match(player, /slides\.length/);
  assert.match(player, /move\(0\)/);
  assert.match(player, /move\(slides\.length - 1\)/);
  assert.match(player, /useState\(false\).*repeatAfterMe|repeatAfterMe, setRepeatAfterMe/s);
  assert.match(player, /开启三次跟读与评分/);
  assert.match(player, /attemptScores/);
  assert.match(player, /readyToContinue/);
  assert.match(player, /smartlingo_everyday_/);
  assert.match(player, /document\.cookie/);
  assert.match(player, /level: "beginner" \| "intermediate" \| "advanced"/);
  assert.match(player, /\/api\/everyday-speaking\/speech/);
  assert.match(player, /watchdog = window\.setTimeout/);
  assert.doesNotMatch(player, />🎙 \{listening \?/);
});

test("everyday speaking has a validated multilingual server transcription fallback", async () => {
  const route = await read("../app/api/everyday-speaking/speech/route.ts");
  for (const marker of ["isSmartLingoCommunityLanguage", "isSmartLingoEverydayScenario", "buildEverydaySpeakingDeck", "transcribeSmartAiSpeech", "scoreSmartCardPronunciation", "MAX_AUDIO_BYTES"]) assert.match(route, new RegExp(marker));
});

test("the scene page falls back to prebuilt dialogue when D1 or Luna is unavailable", async () => {
  const page = await read("../app/[lang]/play/everyday/page.tsx");
  assert.match(page, /buildEverydaySpeakingDeckFromDatabase/);
  assert.match(page, /catch \{[\s\S]*buildEverydaySpeakingDeck\(language, scene\.id, level\)/);
});

test("mobile header never displays the separate account icon beside the hamburger", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.site-header \.header-actions \{ display: none; \}[\s\S]*?\.site-header \.hamburger-button \{ display: inline-grid;/);
  assert.doesNotMatch(css, /@media\(max-width:1100px\)[\s\S]{0,300}\.site-header \.header-actions\{display:flex\}/);
});
