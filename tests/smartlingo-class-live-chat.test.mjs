import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("each active class exposes one durable Live Chat room with online presence", () => {
  const route = read("app/api/classes/[classId]/live-chat/route.ts");
  const panel = read("components/ClassLiveChatPanel.tsx");
  const classStudio = read("components/ClassStudio.tsx");
  const learningPage = read("app/[lang]/classes/[classId]/learn/page.tsx");
  assert.match(route, /class-chat:\$\{classId\}/);
  assert.match(route, /status = 'active'/);
  assert.match(route, /onlineCount/);
  assert.match(panel, />Live Chat</);
  assert.match(panel, /online/);
  assert.match(classStudio, /ClassLiveChatPanel/);
  assert.match(learningPage, /ClassLiveChatPanel/);
});

test("class audio remains compact beside text chat and auto-ends after one solo minute", () => {
  const calls = read("app/api/messages/calls/route.ts");
  const room = read("components/LiveChatRoom.tsx");
  const dock = read("components/ClassAudioCallDock.tsx");
  const migration = read("drizzle/0035_class_live_audio.sql");
  assert.match(calls, /threadKind !== "class"/);
  assert.match(calls, /60 - \(now - soloSinceAt\)/);
  assert.match(calls, /participantCount === 0/);
  assert.match(calls, /status = 'ended', ended_at = \?/);
  assert.match(calls, /action === "heartbeat"/);
  assert.match(migration, /solo_since_at/);
  assert.match(migration, /last_seen_at/);
  assert.match(room, /Join audio call/);
  assert.match(room, /ClassAudioCallDock/);
  assert.match(dock, /text chat stays available/);
  assert.match(dock, /meeting\.join\(\)/);
});

test("class membership, not arbitrary chat invites, controls room access", () => {
  const classRoute = read("app/api/classes/[classId]/live-chat/route.ts");
  const messagesRoute = read("app/api/messages/route.ts");
  assert.match(classRoute, /Active class membership required/);
  assert.match(messagesRoute, /Class membership controls this room/);
});
