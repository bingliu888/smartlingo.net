import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { buildEverydaySpeakingDeck, SMARTLINGO_EVERYDAY_SCENARIOS } from "../lib/smartlingo-everyday-speaking.ts";
import { SMARTLINGO_COMMUNITY_LANGUAGE_CODES } from "../lib/smartlingo-language-communities.ts";
import { dialogueAnswerChoices } from "../lib/smartlingo-dialogue-choices.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("everyday speaking provides twelve illustrated three-level scenarios with vocabulary and practical dialogue", async () => {
  assert.equal(SMARTLINGO_EVERYDAY_SCENARIOS.length, 12);
  assert.equal(SMARTLINGO_COMMUNITY_LANGUAGE_CODES.length, 12);
  for (const scene of SMARTLINGO_EVERYDAY_SCENARIOS) {
    await access(new URL(`../public/everyday-speaking/${scene.id}.jpg`, import.meta.url));
    for (const language of SMARTLINGO_COMMUNITY_LANGUAGE_CODES) {
      for (const level of ["beginner", "intermediate", "advanced"]) {
        const deck = buildEverydaySpeakingDeck(language, scene.id, level);
        const hasAuthoredDialogue = language === "en" || language === "zh" || (language === "ja" && (scene.id === "cafe" || scene.id === "grocery") && level === "beginner");
        assert.ok(deck.length >= (hasAuthoredDialogue ? 24 : 4), `${language}/${scene.id}/${level}`);
        assert.ok(deck.some(slide => slide.kind === "word"));
        const dialogue = deck.filter(slide => slide.kind === "sentence");
        assert.equal(dialogue.length, hasAuthoredDialogue ? 20 : 0, `${language}/${scene.id}/${level} authored dialogue turns`);
        assert.equal(new Set(dialogue.map(slide => slide.pairIndex)).size, hasAuthoredDialogue ? 10 : 0);
        for (let pair = 0; pair < (hasAuthoredDialogue ? 10 : 0); pair += 1) {
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

test("every authored staff question offers one answer and two distinct distractors across all scenes", () => {
  let tested = 0;
  for (const scene of SMARTLINGO_EVERYDAY_SCENARIOS) {
    for (const language of SMARTLINGO_COMMUNITY_LANGUAGE_CODES) {
      for (const level of ["beginner", "intermediate", "advanced"]) {
        if (language !== "en" && language !== "zh" && !(language === "ja" && (scene.id === "cafe" || scene.id === "grocery") && level === "beginner")) continue;
        const deck = buildEverydaySpeakingDeck(language, scene.id, level);
        for (const [index, slide] of deck.entries()) {
          if (slide.kind !== "sentence" || slide.role !== "staff") continue;
          const challenge = dialogueAnswerChoices(deck, index);
          assert.ok(challenge, `${scene.id}/${language}/${level}/${slide.pairIndex}`);
          assert.equal(challenge.choices.length, 3);
          assert.equal(new Set(challenge.choices.map(choice => choice.form)).size, 3);
          assert.equal(challenge.choices.filter(choice => choice.id === challenge.answerId).length, 1);
          assert.equal(challenge.answer.id, deck[index + 1].id);
          tested += 1;
        }
      }
    }
  }
  assert.equal(tested, 740, "English/Chinese source pairs plus twenty offline Japanese beginner pairs");
});

test("unreviewed locales never receive the unrelated find-the-venue sentence bank as dialogue", async () => {
  const source = await read("../lib/smartlingo-everyday-dialogues.ts");
  assert.doesNotMatch(source, /buildCourseSentenceBank/);
  assert.doesNotMatch(source, /FALLBACK_QUESTIONS/);
  assert.match(source, /if \(!lines\) throw new Error\("Everyday dialogue localization is unavailable"\)/);
  assert.match(source, /cached\?\.sourceType === "gpt-6-luna"/);
  assert.match(source, /validatedDialogueLines\(lines, base, input\.language\)/);
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
  assert.match(player, /languageName\} · \{levelName\} ·/);
  assert.match(player, /aria-pressed=\{modelRate > \.7\}/);
  assert.match(player, /aria-pressed=\{modelRate <= \.7\}/);
  assert.match(player, /当前语速：慢速 0\.42×/);
});

test("everyday levels start with visibly distinct vocabulary and level stages", () => {
  for (const scene of SMARTLINGO_EVERYDAY_SCENARIOS) {
    for (const language of SMARTLINGO_COMMUNITY_LANGUAGE_CODES) {
      const decks = ["beginner", "intermediate", "advanced"].map(level => buildEverydaySpeakingDeck(language, scene.id, level));
      assert.equal(new Set(decks.map(deck => deck[0]?.form)).size, 3, `${language}/${scene.id} first word per level`);
      assert.deepEqual(decks.map(deck => deck[0]?.stageEn.split(" · ")[0]), ["Beginner", "Intermediate", "Advanced"]);
    }
  }
});

test("everyday speaking has a validated multilingual server transcription fallback", async () => {
  const route = await read("../app/api/everyday-speaking/speech/route.ts");
  for (const marker of ["isSmartLingoCommunityLanguage", "isSmartLingoEverydayScenario", "buildEverydaySpeakingDeck", "transcribeSmartAiSpeech", "scoreSmartCardPronunciation", "MAX_AUDIO_BYTES"]) assert.match(route, new RegExp(marker));
});

test("the scene page never teaches mismatched fallback dialogue when localization is unavailable", async () => {
  const page = await read("../app/[lang]/play/everyday/page.tsx");
  assert.match(page, /buildEverydaySpeakingDeckFromDatabase/);
  assert.match(page, /language === "en" \|\| language === "zh"/);
  assert.match(page, /这组对话还没有准备好/);
  assert.match(page, /buildEverydaySpeakingDeck\(language, scene\.id, level\)/);
});

test("responsive header keeps the language icon beside hamburger and moves only overflow navigation", async () => {
  const [header, css] = await Promise.all([read("../components/SiteHeader.tsx"), read("../app/globals.css")]);
  assert.match(header, /const hiddenLinks = links\.slice\(visibleLinkCount\)/);
  assert.match(header, /className="header-controls"[\s\S]*?<InterfaceLanguageMenu lang=\{lang\}\/?>[\s\S]*?hamburger-button/);
  assert.match(css, /\.header-controls\{display:flex;align-items:center;justify-content:flex-end;gap:8px\}/);
  assert.match(css, /\.site-header \.hamburger-button\{[^}]*display:inline-grid/);
});
