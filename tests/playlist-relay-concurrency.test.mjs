import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const join=fs.readFileSync(new URL("../app/api/classrooms/[code]/join/route.ts",import.meta.url),"utf8");
const media=fs.readFileSync(new URL("../app/api/classrooms/[code]/media/route.ts",import.meta.url),"utf8");

test("only one visitor can claim an idle playlist relay",()=>{
  assert.match(join,/playlistRequested/);
  assert.match(join,/class_playlist_relay_claims/);
  assert.match(join,/playlistRelay=Number\(claim\.meta\?\.changes\|\|0\)>0/);
  assert.match(join,/!providerMeetingId&&playlistRequested&&!playlistRelay/);
  assert.doesNotMatch(join,/stream_active=2/);
  assert.match(media,/DELETE FROM class_playlist_relay_claims/);
});
