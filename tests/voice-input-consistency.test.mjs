import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assistantReplyShouldSpeak, clearStaleAssistantDraft, createAssistantVoiceTurn } from "../lib/assistant-voice-turn.ts";

test("Ask Guru text stays public while microphone access requires sign-in", async () => {
  const [assistant, page] = await Promise.all([
    readFile(new URL("../components/AssistantClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[lang]/assistant/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(assistant, /SpeechRecognition \|\| speechWindow\.webkitSpeechRecognition/);
  assert.match(assistant, /instance\.lang = speechLocale \|\| \(zh \? "zh-CN" : "en-US"\)/);
  assert.match(assistant, /instance\.continuous = false/);
  assert.match(assistant, /instance\.interimResults = true/);
  assert.match(assistant, /event\.results\[index\]\[0\]\.transcript/);
  assert.match(assistant, /createAssistantVoiceTurn\(draftRef\.current\)/);
  assert.match(assistant, /assistantReplyShouldSpeak\(source\)/);
  assert.match(assistant, /readAnswer\(data\.reply, withReply\.length - 1\)/);
  assert.match(assistant, /silenceRecognition\(instance, stop\)/);
  assert.match(assistant, /instance\.start\(\)/);
  assert.match(assistant, /recognition\.current\?\.stop\(\)/);
  assert.match(assistant, /Listening…/);
  assert.match(assistant, /Voice input is not supported in this browser/);
  assert.match(assistant, /useUser\(\)/);
  assert.match(assistant, /if\s*\(!isSignedIn\)/);
  assert.match(assistant, /window\.location\.assign\(`\/\$\{lang\}\/auth\/login\?returnTo=/);
  assert.match(assistant, /encodeURIComponent\(`\/\$\{lang\}\/assistant`\)/);
  assert.match(assistant, /disabled=\{busy\}/);
  assert.match(assistant, /composerCopy\.startVoice/);
  assert.match(assistant, /composerCopy\.stopVoice/);
  assert.doesNotMatch(page, /requestUser|signedIn|auth\/login/);
});

test("one-shot voice turns expose interim text and consume one non-empty final transcript exactly once", () => {
  const turn = createAssistantVoiceTurn("Please correct");
  assert.deepEqual(turn.applyResults([{ transcript: "I am fine", isFinal: false }]), {
    draft: "Please correct I am fine",
    finalContent: null,
  });
  assert.deepEqual(turn.applyResults([{ transcript: "I’m fine, thank you.", isFinal: true }]), {
    draft: "Please correct I’m fine, thank you.",
    finalContent: "Please correct I’m fine, thank you.",
  });
  assert.equal(turn.finish(), null);
  assert.equal(turn.applyResults([{ transcript: "late duplicate", isFinal: true }]), null);
});

test("interim-only, empty-final, failed, and cancelled voice turns never auto-send", () => {
  const interim = createAssistantVoiceTurn();
  assert.equal(interim.applyResults([{ transcript: "still listening", isFinal: false }])?.finalContent, null);
  assert.equal(interim.finish(), null);

  const emptyFinal = createAssistantVoiceTurn();
  assert.equal(emptyFinal.applyResults([{ transcript: "   ", isFinal: true }])?.finalContent, null);
  assert.equal(emptyFinal.finish(), null);

  const failed = createAssistantVoiceTurn();
  failed.applyResults([{ transcript: "do not send", isFinal: false }]);
  failed.fail();
  assert.equal(failed.finish(), null);
  assert.equal(failed.applyResults([{ transcript: "late final", isFinal: true }]), null);

  const cancelled = createAssistantVoiceTurn();
  cancelled.cancel();
  assert.equal(cancelled.applyResults([{ transcript: "late final", isFinal: true }]), null);
  assert.equal(cancelled.finish(), null);
});

test("reply cleanup removes only the submitted revision and preserves any newer draft", () => {
  assert.equal(clearStaleAssistantDraft("same question", "same question", 7, 7), "");
  assert.equal(clearStaleAssistantDraft("next question", "same question", 7, 8), "next question");
  assert.equal(clearStaleAssistantDraft("same question", "same question", 7, 8), "same question");
});

test("only a voice-originated AI reply requests automatic speech", () => {
  assert.equal(assistantReplyShouldSpeak("voice"), true);
  assert.equal(assistantReplyShouldSpeak("typed"), false);
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
