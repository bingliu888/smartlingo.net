import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const join=fs.readFileSync(new URL("../app/api/classrooms/[code]/join/route.ts",import.meta.url),"utf8");
const media=fs.readFileSync(new URL("../app/api/classrooms/[code]/media/route.ts",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../components/live-class-room-client.tsx",import.meta.url),"utf8");

test("leaving waits for server cleanup and abandoned relay state self-recovers",()=>{
  assert.match(client,/const leave=useCallback\(async\(\)=>\{await disconnect\(true\)/);
  assert.match(client,/navigator\.sendBeacon/);
  assert.match(client,/participants\.subscribe\(ids,\["audio","video"\]\)/);
  assert.match(client,/setViewMode\.call\(client\.participants,"MANUAL"\)/);
  assert.match(client,/return <video ref=\{ref\} autoPlay playsInline hidden\/>/);
  assert.match(client,/playlistEnabled&&!playlistRelay\?<PlaylistViewer/);
  assert.match(media,/SELECT 1 AS active FROM live_class_media_presence/);
  assert.match(media,/updated_at<=\?/);
  assert.match(media,/streamActive=false/);
});

test("only one visitor can claim an idle playlist relay",()=>{
  assert.match(join,/playlistRequested/);
  assert.match(join,/class_playlist_relay_claims/);
  assert.match(join,/playlistRelay=Number\(claim\.meta\?\.changes\|\|0\)>0/);
  assert.match(join,/!providerMeetingId&&playlistRequested&&!playlistRelay/);
  assert.doesNotMatch(join,/stream_active=2/);
  assert.match(media,/DELETE FROM class_playlist_relay_claims/);
});
