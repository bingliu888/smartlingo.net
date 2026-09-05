import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const media = fs.readFileSync(new URL("../app/api/classrooms/[code]/media/route.ts", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../components/live-class-room-client.tsx", import.meta.url), "utf8");

test("a publisher leaving keeps silent viewers and the provider generation alive", () => {
  const leave = media.match(/if \(action === "leave"\) \{[\s\S]*?return Response\.json\(\{ ok: true \}\);\n  \}/)?.[0] || "";
  assert.match(leave, /revokeParticipantSession/);
  assert.match(leave, /Silent viewers and moderators keep the provider generation alive/);
  assert.doesNotMatch(leave, /queueClassProviderTeardown|provider_meeting_id=NULL|stream_active=0/);
  assert.match(client, /livestream\.stop\(\)/);
  assert.match(client, /wasPublishing\s*=\s*Boolean\(\s*client\?\.self\.audioEnabled\s*\|\|\s*client\?\.self\.videoEnabled,?\s*\)/);
  assert.ok(client.indexOf("wasPublishing = Boolean") < client.indexOf("client?.self.disableAudio()"));
  assert.ok(client.indexOf("client.livestream.stop()") > client.indexOf("client?.self.disableAudio()"));
  assert.match(client, /humanStreamSeen/);
  assert.match(client, /enabled=\{playlistEnabled\s*&&\s*!humanStreamActive\s*&&\s*!humanStreamSeen\}/);
  assert.match(client, /humanStreamActive/);
  assert.match(client, /<LoneParticipantGuard/);
  assert.match(client, /confirmStillAlone=\{confirmStillAlone\}/);
  assert.match(client, /return !state\.hasOtherParticipants/);
  assert.match(media, /classMediaIdentityProjection\(identity, access\.manager\)/);
  assert.match(media, /hasOtherParticipants: activeUsers\.some/);
  assert.match(media, /isManager: Boolean\(userId && managerIds\.has\(userId\)\)/);
});

test("participant reservation trusts persisted D1 state and failed clients release provisional leases", () => {
  const sessions = fs.readFileSync(new URL("../lib/class-participant-session.ts", import.meta.url), "utf8");
  assert.match(sessions, /activeSessionAfterMutation/);
  assert.match(sessions, /inserted\?\.active && inserted\.tokenHash === tokenHash/);
  assert.match(client, /let provisionalSessionToken = ""/);
  assert.match(client, /sessionToken: provisionalSessionToken/);
  assert.match(client, /provisionalSessionToken = data\.sessionToken \|\| ""/);
  assert.match(client, /setSessionToken\(provisionalSessionToken\)/);
  const join = fs.readFileSync(new URL("../app/api/classrooms/[code]/join/route.ts", import.meta.url), "utf8");
  assert.match(join, /recoverableJoinFailure\(error, reserved\?\.token\)/);
  assert.match(client, /keepalive: true/);
});

test("webinar promotion keeps the viewer connected until device permission is ready", () => {
  const permission = client.indexOf("navigator.mediaDevices.getUserMedia({");
  const reconnect = client.indexOf("await connect({", permission);
  assert.ok(permission >= 0);
  assert.ok(reconnect > permission);
  assert.match(client, /preparedAudioTrack:\s*permission\.getAudioTracks\(\)\[0\]/);
  assert.match(client, /preparedVideoTrack:\s*permission\.getVideoTracks\(\)\[0\]/);
});

test("viewer-to-publisher rotation reports the replaced presence before joining again", () => {
  const connect = client.match(/const connect = useCallback\([\s\S]*?\n    \[client, disconnect,/)?.[0] || "";
  assert.match(connect, /if \(client && joined\) await disconnect\(true\)/);
  assert.doesNotMatch(connect, /if \(client && joined\) await disconnect\(false\)/);
  assert.ok(connect.indexOf("await disconnect(true)") < connect.indexOf("fetch(`/api/classrooms/${room.code}/join`"));
});
