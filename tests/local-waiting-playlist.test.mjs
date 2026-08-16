import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("waiting playback stays local and the retired relay has no runtime path", () => {
  const client = read("components/live-class-room-client.tsx");
  const join = read("app/api/classrooms/[code]/join/route.ts");
  const media = read("app/api/classrooms/[code]/media/route.ts");
  const player = read("components/ClassPlaylistPlayer.tsx");

  assert.match(client, /mediaState\?\.streamActive && !joined && !joining\.current/);
  assert.match(client, /ClassPlaylistPlayer/);
  assert.doesNotMatch(client + join + media, /playlistRelay|class_playlist_relay_claims|LiveClassPlaylistBroadcaster/);
  assert.match(player, /<video/);
  assert.doesNotMatch(player, /RealtimeKit|livestream|captureStream|enableAudio|enableVideo/);
});

test("local waiting state survives the idle-room timeout", () => {
  const client = read("components/live-class-room-client.tsx");
  assert.match(client, /if \(joined \|\| playlistEnabled\)/);
  assert.match(client, /navigator\.sendBeacon/);
});
