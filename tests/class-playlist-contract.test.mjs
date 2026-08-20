import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("class waiting playlists stay local to each visitor", () => {
  const route = read("app/api/classrooms/[code]/playlist/route.ts");
  const room = read("components/live-class-room-client.tsx");
  const player = read("components/ClassPlaylistPlayer.tsx");
  const manager = read("components/LiveClassPlaylistManager.tsx");
  const config = read("wrangler.cloudflare.jsonc");

  assert.match(route, /env\.CLASS_FILES/);
  assert.match(config, /"binding":\s*"CLASS_FILES"/);
  assert.match(room, /ClassPlaylistPlayer/);
  assert.match(room, /enabled=\{playlistEnabled\s*&&\s*!humanStreamActive(?:\s*&&\s*!humanStreamSeen)?\}/);
  assert.doesNotMatch(room, /const mayRelay=active/);
  assert.match(room, /shouldAutoJoinClassRoom/);
  assert.match(player, /data-local-playlist="true"/);
  assert.match(player, /playlistLimitReached/);
  assert.match(player, /PLAYLIST_MAX_ACTIVE_MS/);
  assert.doesNotMatch(player, /playlist-waiting-toggle/);
  assert.doesNotMatch(player, /RealtimeKit|WebRTC|livestream|captureStream|enableVideo|enableAudio/);
  assert.doesNotMatch(manager, /Group calls do not use a playlist|小组通话模式不使用播放列表/);
  assert.match(manager, /each visitor plays|每位访客/);

  const stylePath = [
    "app/classes/classes.css",
    "app/[lang]/classrooms/classrooms.css",
  ].find((path) => fs.existsSync(new URL("../" + path, import.meta.url)));
  assert.ok(stylePath);
  assert.match(read(stylePath), /class-local-playlist/);
});
