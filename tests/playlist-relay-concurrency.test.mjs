import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../app/api/classrooms/[code]/join/route.ts",import.meta.url),"utf8");

test("only one visitor can claim an idle playlist relay",()=>{
  assert.match(source,/playlistRequested/);
  assert.match(source,/UPDATE live_class_rooms SET stream_active=2/);
  assert.match(source,/playlistRelay=Number\(claim\.meta\?\.changes\|\|0\)>0/);
  assert.match(source,/!providerMeetingId&&playlistRequested&&!playlistRelay/);
  assert.match(source,/stream_active=2 AND updated_at</);
});
