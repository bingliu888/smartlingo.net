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
  assert.match(room, /if\s*\(joined\s*\|\|\s*playlistEnabled\)/);
  assert.match(player, /data-local-playlist="true"/);
  assert.match(player, /loopsRef\.current >= 5/);
  assert.match(player, /window\.setTimeout\(finish, 300000\)/);
  assert.match(player, /playlist-waiting-toggle/);
  assert.doesNotMatch(player, /RealtimeKit|WebRTC|livestream|captureStream|enableVideo|enableAudio/);
  assert.doesNotMatch(manager, /Group calls do not use a playlist|小组通话模式不使用播放列表/);
  assert.match(manager, /each visitor plays|每位访客/);

  const stylePath = [
    "app/classrooms/classrooms.css",
    "app/[lang]/classrooms/classrooms.css",
  ].find((path) => fs.existsSync(new URL("../" + path, import.meta.url)));
  assert.ok(stylePath);
  assert.match(read(stylePath), /class-local-playlist/);
});
