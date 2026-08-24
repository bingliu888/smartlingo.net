import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Ask Guru text stays public while microphone access requires sign-in", async () => {
  const [assistant, page] = await Promise.all([
    readFile(new URL("../components/AssistantClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[lang]/assistant/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(assistant, /SpeechRecognition \|\| speechWindow\.webkitSpeechRecognition/);
  assert.match(assistant, /instance\.lang = speechLocale \|\| \(zh \? "zh-CN" : "en-US"\)/);
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

test("signed-in dashboard exposes joined-language cards for the four requested learning features", async () => {
  const [dashboard, hub] = await Promise.all([
    readFile(new URL("../app/[lang]/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DashboardLearningHub.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /<DashboardLearningHub/);
  assert.match(hub, /courses: DashboardJoinedCourse\[\]/);
  assert.match(hub, /Smart Card Practice/);
  assert.match(hub, /Smart Card Challenge/);
  assert.match(hub, /Everyday speaking/);
  assert.match(hub, /Courses/);
  assert.doesNotMatch(hub, /assistant\?language|Ask AI|咨询AI/);
  assert.match(hub, /生活口语/);
  assert.match(hub, /智慧卡练习/);
});
