import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Ask Guru text stays public while microphone access requires sign-in", async () => {
  const [assistant, page] = await Promise.all([
    readFile(new URL("../components/AssistantClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[lang]/assistant/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(assistant, /SpeechRecognition \|\| speechWindow\.webkitSpeechRecognition/);
  assert.match(assistant, /instance\.lang = zh \? "zh-CN" : "en-US"/);
  assert.match(assistant, /instance\.continuous = true/);
  assert.match(assistant, /instance\.interimResults = true/);
  assert.match(assistant, /result\[0\]\.transcript/);
  assert.match(assistant, /setDraft\(`\$\{recognitionBase\.current\}\$\{interimText\}`\.trimStart\(\)\)/);
  assert.match(assistant, /instance\.start\(\)/);
  assert.match(assistant, /recognition\.current\?\.stop\(\)/);
  assert.match(assistant, /Listening…/);
  assert.match(assistant, /Voice input is not supported in this browser/);
  assert.match(assistant, /useUser\(\)/);
  assert.match(assistant, /if\s*\(!isSignedIn\)/);
  assert.match(assistant, /window\.location\.assign\(`\/\$\{lang\}\/auth\/login\?returnTo=/);
  assert.match(assistant, /encodeURIComponent\(`\/\$\{lang\}\/assistant`\)/);
  assert.doesNotMatch(page, /requestUser|signedIn|auth\/login/);
});

test("signed-in dashboard exposes a bilingual voice CTA to the existing Ask Guru page", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile(new URL("../app/[lang]/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[lang]/dashboard/dashboard-tuneup.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /voiceAction: "Live Audio AI Chat"/);
  assert.match(dashboard, /voiceAction: "实时智能语音对话"/);
  assert.match(dashboard, /className="dashboard-voice-cta" href=\{`\/\$\{lang\}\/assistant`\}/);
  assert.match(styles, /\.dashboard-voice-panel\{/);
  assert.match(styles, /@media\(max-width:760px\).*\.dashboard-voice-cta\{grid-column:1\/-1;width:100%\}/s);
});
