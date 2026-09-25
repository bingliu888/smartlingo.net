import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("lone media disconnects without ejecting a member from the course room", async () => {
  const room = await readFile(new URL("../components/live-class-room-client.tsx", import.meta.url), "utf8");
  assert.match(room, /onlineMembers\.length<2/);
  assert.match(room, /void disconnect\(true\)\.then/);
  assert.match(room, /},9000\)/);
  assert.match(room, /!joined\|\|mic\|\|camera\|\|hasAnyPublisher\|\|playlistEnabled/);
  assert.match(room, /disconnect\(true\),15000\)/);
  assert.doesNotMatch(room, /LoneParticipantGuard|MediaActivityGuard/);
});

test("unknown pages recover to the home page", async () => {
  const source = await readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8");
  assert.match(source, /window\.location\.replace\("\/"\)/);
});
