import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("waiting playback stays local and the retired relay has no runtime path", () => {
  const client = read("components/live-class-room-client.tsx");
  const join = read("app/api/classrooms/[code]/join/route.ts");
  const media = read("app/api/classrooms/[code]/media/route.ts");
  const player = read("components/ClassPlaylistPlayer.tsx");

  assert.match(client, /shouldAutoJoinClassRoom\(mediaState\)/);
  assert.match(client, /ClassPlaylistPlayer/);
  assert.doesNotMatch(client + join + media, /playlistRelay|class_playlist_relay_claims|ClassPlaylistBroadcaster/);
  assert.match(player, /<video/);
  assert.doesNotMatch(player, /RealtimeKit|livestream|captureStream|enableAudio|enableVideo/);
});

test("local waiting state does not create an idle WebRTC room", () => {
  const client = read("components/live-class-room-client.tsx");
  assert.doesNotMatch(client, /if \(joined \|\| playlistEnabled\)/);
  assert.match(client, /enabled=\{playlistEnabled && !humanStreamActive && !humanStreamSeen\}/);
  assert.match(client, /navigator\.sendBeacon/);
});
