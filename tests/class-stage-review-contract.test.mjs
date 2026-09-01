import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync("components/live-class-room-client.tsx", "utf8");
const route = readFileSync("app/api/classrooms/[code]/media/route.ts", "utf8");

test("webinar stage review separates the host session identity from the target participant", () => {
  assert.match(client, /identity,\s*targetIdentity: request\.identity,/);
  assert.match(route, /targetIdentity\?: unknown/);
  assert.match(route, /const targetIdentity = String\(body\.targetIdentity \|\| ""\)/);
  assert.doesNotMatch(route, /const targetIdentity = identity;/);
});

test("stage review surfaces rejected moderation requests", () => {
  assert.match(client, /if \(!response\.ok\)/);
  assert.match(client, /Unable to review stage request/);
});
