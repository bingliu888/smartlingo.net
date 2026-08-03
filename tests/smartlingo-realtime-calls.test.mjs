import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("RealtimeKit credentials stay server-side and participant tokens are ephemeral", () => {
  const route = read("app/api/messages/calls/route.ts");
  const client = read("components/RealtimeCallStage.tsx");
  const config = read("wrangler.cloudflare.jsonc");
  assert.match(route, /CLOUDFLARE_REALTIME_API_TOKEN/);
  assert.match(route, /NOT_PARTICIPANT/);
  assert.match(route, /Only the caller can end this call/);
  assert.doesNotMatch(client, /CLOUDFLARE_REALTIME_API_TOKEN|REALTIMEKIT_APP_ID/);
  assert.doesNotMatch(config, /apiToken|CLOUDFLARE_REALTIME_API_TOKEN/);
  assert.doesNotMatch(route, /auth_token|authToken[^\n]*INSERT/i);
});

test("standard calls use a video-capable preset with camera off by default and durable invite state", () => {
  const provider = read("lib/realtimekit.ts");
  const room = read("components/LiveChatRoom.tsx");
  const migration = read("drizzle/0031_yielding_lady_bullseye.sql");
  assert.match(provider, /preset_name: config\.videoPreset/);
  assert.match(provider, /payload\?\.data \?\? payload\?\.result/);
  assert.match(provider, /title: "SmartLingo member call"/);
  assert.doesNotMatch(provider, /record_on_start|session_keep_alive_time_in_secs/);
  assert.match(room, /call\("start", "audio"\)/);
  assert.match(room, /call\("start", "video"\)/);
  assert.match(room, /call\("join", invite\.mode, invite\.id\)/);
  assert.match(migration, /CREATE TABLE `message_calls`/);
  assert.match(migration, /CREATE TABLE `message_call_participants`/);
  assert.match(migration, /WHERE "message_calls"\."status" = 'active'/);
});

test("persistent calls survive route navigation, expose mic state, and enforce silence and camera limits", () => {
  const provider = read("components/PersistentCallProvider.tsx");
  const layout = read("app/[lang]/layout.tsx");
  const route = read("app/api/messages/calls/route.ts");
  const migration = read("drizzle/0036_numerous_madame_masque.sql");
  assert.match(layout, /PersistentCallProvider/);
  assert.match(provider, /floating-active-call/);
  assert.match(provider, /Mic off|麦克风已关/);
  assert.match(provider, /audioActivity/);
  assert.match(provider, /camera_on/);
  assert.match(route, /60 - \(now - lastAudioAt\)/);
  assert.match(route, /cameraCount >= 4/);
  assert.match(route, /input\.action === "camera_on"/);
  assert.match(migration, /last_audio_at/);
  assert.match(migration, /microphone_on/);
  assert.match(migration, /camera_on/);
});
