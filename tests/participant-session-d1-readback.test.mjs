import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../lib/class-participant-session.ts", import.meta.url),
  "utf8",
);

test("participant reservations trust the exact newly persisted session before D1 metadata", () => {
  const batch = source.indexOf("const results = await db.batch(statements)");
  const sessionRead = source.indexOf("const inserted = await db.prepare", batch);
  const metadataCheck = source.indexOf("Number(results[results.length - 1]?.meta?.changes || 0) !== 1", sessionRead);
  assert.ok(batch >= 0);
  assert.ok(sessionRead > batch);
  assert.ok(metadataCheck > sessionRead);
  assert.match(source.slice(sessionRead, metadataCheck), /inserted\?\.active && inserted\.tokenHash === tokenHash/);
});

test("critical participant-session mutations recover from D1 change-count false negatives", () => {
  assert.match(source, /async function activeSessionAfterMutation/);
  assert.ok((source.match(/activeSessionAfterMutation\(/g) || []).length >= 5);
  assert.match(source, /persisted\?\.providerMeetingId === providerMeetingId/);
  assert.match(source, /persisted\?\.publisherReserved !== 1/);
  assert.match(source, /persisted\?\.companionReserved !== 1/);
  assert.match(source, /persisted\.companionPublisherReserved !== \(publisher \? 1 : 0\)/);
  assert.match(source, /persisted\.lastSeenAt < now/);
});
