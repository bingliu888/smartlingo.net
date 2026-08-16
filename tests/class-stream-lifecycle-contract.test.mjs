import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const media = fs.readFileSync(new URL("../app/api/classrooms/[code]/media/route.ts", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../components/live-class-room-client.tsx", import.meta.url), "utf8");

test("the final manager publisher closes streaming even while viewers remain", () => {
  assert.match(media, /activePublishers/);
  assert.match(media, /access\.manager\s*&&\s*Number\(activePublishers\?\.count\s*\|\|\s*0\)\s*===\s*0/);
  assert.match(client, /livestream\.stop\(\)/);
  assert.match(client, /wasPublishing\s*=\s*Boolean\(\s*client\?\.self\.audioEnabled\s*\|\|\s*client\?\.self\.videoEnabled,?\s*\)/);
  assert.ok(client.indexOf("wasPublishing = Boolean") < client.indexOf("client?.self.disableAudio()"));
  assert.ok(client.indexOf("client.livestream.stop()") > client.indexOf("client?.self.disableAudio()"));
  assert.match(client, /humanStreamSeen/);
  assert.match(client, /enabled=\{playlistEnabled\s*&&\s*!humanStreamActive\s*&&\s*!humanStreamSeen\}/);
  assert.match(client, /humanStreamActive/);
  assert.match(client, /room\.realtimeMode === "livestream" \|\| hasAudience/);
  assert.match(client, /window\.setTimeout\(leave, 60000\)/);
  assert.match(client, /user\.identity !== identity && !user\.isManager/);
  assert.match(media, /isManager: Boolean\(userId && managerIds\.has\(userId\)\)/);
});

test("webinar promotion keeps the viewer connected until device permission is ready", () => {
  const permission = client.indexOf("navigator.mediaDevices.getUserMedia({");
  const reconnect = client.indexOf("await connect({", permission);
  assert.ok(permission >= 0);
  assert.ok(reconnect > permission);
  assert.match(client, /preparedAudioTrack:\s*permission\?\.getAudioTracks\(\)\[0\]/);
  assert.match(client, /preparedVideoTrack:\s*permission\?\.getVideoTracks\(\)\[0\]/);
});
