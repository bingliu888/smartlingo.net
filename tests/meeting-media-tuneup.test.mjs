import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("waiting playlist keeps local controls and bounded continuation cycles", () => {
  const player = read("components/ClassPlaylistPlayer.tsx");
  assert.match(player, /<video[\s\S]*controls/);
  assert.doesNotMatch(player, /playlist-waiting-toggle/);
  assert.match(player, /PLAYLIST_CONTINUE_SECONDS/);
  assert.match(player, /defaultMuted = false/);
});

test("course media joins only for an actual publisher or active share", () => {
  const room = read("components/live-class-room-client.tsx");
  const join = read("app/api/classrooms/[code]/join/route.ts");
  assert.match(room, /shouldAutoJoinClassRoom/);
  assert.match(join, /body\.publish/);
  assert.match(join, /room\.realtimeMode === "group_call"/);
  assert.doesNotMatch(join, /\(body\.start \|\| body\.publish\)/);
});

test("media state is authorized before capture state is published", () => {
  const room = read("components/live-class-room-client.tsx");
  const media = read("app/api/classrooms/[code]/media/route.ts");
  assert.match(room, /authorizeOnly: true/);
  assert.match(media, /if \(body\.authorizeOnly\) return Response\.json/);
  assert.match(media, /mic_on=COALESCE/);
});

test("share lifecycle restores camera and remote video grids omit empty tiles", () => {
  const room = read("components/live-class-room-client.tsx");
  const share = read("components/class-screen-share.tsx");
  assert.match(share, /cameraWasOn/);
  assert.match(share, /if\(restore\)await onMedia\(mic,true\)/);
  assert.match(room, /peer\.videoEnabled \|\| peer\.videoTrack/);
  assert.match(room, /data-layout=\{mediaGridLayout\(tileCount\)\}/);
});

test("solo and activity guards recheck authoritative attendance", () => {
  const room = read("components/live-class-room-client.tsx");
  assert.match(room, /<LoneParticipantGuard/);
  assert.match(room, /confirmStillAlone=\{confirmStillAlone\}/g);
});
