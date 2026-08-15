import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("waiting playback never claims or publishes a realtime relay", () => {
  const client = read("components/live-class-room-client.tsx");
  const player = read("components/ClassPlaylistPlayer.tsx");

  assert.match(client, /if\(mediaState\?\.streamActive&&!joined&&!joining\.current\)void connect\(\)/);
  assert.doesNotMatch(client, /const mayRelay=active/);
  assert.doesNotMatch(client, /playlistRelay&&playlistEnabled\?<LiveClassPlaylistBroadcaster/);
  assert.match(client, /ClassPlaylistPlayer/);
  assert.match(player, /<video/);
  assert.doesNotMatch(player, /RealtimeKit|livestream|captureStream|enableAudio|enableVideo/);
});

test("local waiting state survives the idle-room timeout", () => {
  const client = read("components/live-class-room-client.tsx");
  assert.match(client, /if\(joined\|\|playlistEnabled\)\{idleSince\.current=null;return\}/);
  assert.match(client, /navigator\.sendBeacon/);
});
