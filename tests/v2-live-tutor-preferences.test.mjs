import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { maxLiveTutorInstructions } = await tsImport("../lib/smartlingo-live-tutor-instructions.ts", import.meta.url);

test("live tutor responds in the learning language with bounded, switchable pace and length", () => {
  const base = { learningLanguage: "Japanese", learningNativeName: "日本語", supportLanguage: "English",
    level: "beginner", useCase: "travel" };
  const short = maxLiveTutorInstructions({ ...base, slowSpeed: true, shortAnswer: true });
  assert.match(short, /When a separate start-of-call instruction arrives, greet and welcome the learner once/);
  assert.match(short, /Do not repeat the introduction in later turns/);
  assert.match(short, /Speak in Japanese, not English/);
  assert.match(short, /at most 12 spoken words/);
  assert.match(short, /noticeably slow/);
  const normal = maxLiveTutorInstructions({ ...base, slowSpeed: false, shortAnswer: false });
  assert.match(normal, /under 30 spoken words total/);
  assert.match(normal, /natural conversational pace/);
  assert.match(normal, /Understand speech in any language/);
  assert.match(normal, /explicitly asks to speak or receive an explanation in another language/);
});

test("Max tutor opens directly on tutor choices and greets once after Start", () => {
  const page = readFileSync(new URL("../app/[lang]/max/tutor/page.tsx", import.meta.url), "utf8");
  const owner = readFileSync(new URL("../components/MaxVoiceTutor.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/MaxLiveTutorCall.tsx", import.meta.url), "utf8");
  const preferences = readFileSync(new URL("../app/api/assistant/live/preferences/route.ts", import.meta.url), "utf8");
  assert.match(page, /selected \? <h1 className="max-live-tutor-sr-only"/);
  assert.match(owner, /<MaxLiveTutorCall sessionId=\{sessionId\} prepareSession=\{prepareSession\}/);
  assert.doesNotMatch(owner, /Start open conversation|role-tutor-message/);
  assert.match(client, /navigator\.mediaDevices\.getUserMedia[\s\S]*sessionId \|\| await prepareSession\(\)/);
  assert.match(client, /item\.type === "session\.started"[\s\S]*The learner just pressed Start/);
  assert.match(client, /introduce yourself as \$\{selectedPortrait\.nameEn\}/);
  assert.match(preferences, /if \(!sessionId && !await maxLiveTutorDailyLimit\(user\)\)/);
});

test("live tutor exposes scrollable bilingual transcript and updates preferences without restart", () => {
  const client = readFileSync(new URL("../components/MaxLiveTutorCall.tsx", import.meta.url), "utf8");
  const owner = readFileSync(new URL("../components/MaxVoiceTutor.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/[lang]/assistant/role-tutor/role-tutor.css", import.meta.url), "utf8");
  const translation = readFileSync(new URL("../app/api/assistant/tutor-translation/route.ts", import.meta.url), "utf8");
  assert.match(client, /type: "session\.instructions\.append"/);
  assert.doesNotMatch(client, /conversation\.item\.input_audio_transcription\.completed/);
  assert.match(client, /session\.output_transcript\.delta/);
  assert.match(client, /className="max-live-tutor-transcript" role="region" tabIndex=\{showTranscript \? 0 : -1\} hidden=\{!showTranscript\}/);
  assert.match(client, /showSupport && line\.supportText/);
  assert.match(css, /\.max-live-tutor-transcript\{[^}]*overflow-y:auto/);
  assert.match(owner, /checked=\{slowSpeed\}/);
  assert.match(owner, /checked=\{showSupport\}/);
  assert.match(owner, /checked=\{shortAnswer\}/);
  assert.match(owner, /showSupport=\{showSupport\}/);
  assert.match(translation, /maxLiveTutorDailyLimit\(user\)/);
  assert.match(translation, /Return ONLY a JSON object/);
});
