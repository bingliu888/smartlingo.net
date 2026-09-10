import test from "node:test";
import assert from "node:assert/strict";
import { createRemoteMediaRecovery } from "../lib/remote-media-recovery.ts";

test("failed subscriptions retry without a participant event; only accepted IDs are cached", async () => {
  let attempts = 0;
  const subscribed = new Set();
  const recovery = createRemoteMediaRecovery({
    peers: () => [{ id: "a", enabled: true }],
    subscribed,
    subscribe: async () => {
      if (++attempts === 1) throw Error("network");
    },
    unsubscribe: async () => {},
  });
  await recovery.reconcile();
  assert.equal(subscribed.size, 0);
  await recovery.reconcile();
  assert.equal(attempts, 2);
  assert.ok(subscribed.has("a"));
});

test("repairs a lost receiver without interrupting healthy or intentionally muted peers", async () => {
  let now = 0;
  const repaired = [];
  const requested = [];
  const recovery = createRemoteMediaRecovery({
    peers: () => [
      { id: "healthy", enabled: true, track: { readyState: "live" } },
      { id: "ended", enabled: true, track: { readyState: "ended" } },
      { id: "muted", enabled: false },
    ],
    subscribed: new Set(["healthy", "ended", "muted"]),
    now: () => now,
    subscribe: async (ids) => requested.push(...ids),
    unsubscribe: async (ids) => repaired.push(...ids),
  });
  await recovery.reconcile();
  now = 3_000;
  await recovery.reconcile();
  assert.deepEqual(repaired, []);
  now = 6_000;
  await recovery.reconcile();
  assert.deepEqual(repaired, ["ended"]);
  assert.deepEqual(requested, ["ended"]);
});

test("video-window recovery does not prune subscriptions owned by page reconciliation", async () => {
  let now = 0;
  const subscribed = new Set(["visible-ended", "other-page"]);
  const repaired = [];
  const recovery = createRemoteMediaRecovery({
    peers: () => [{ id: "visible-ended", enabled: true }],
    subscribed,
    pruneAbsent: false,
    now: () => now,
    subscribe: async () => {},
    unsubscribe: async (ids) => repaired.push(...ids),
  });
  await recovery.reconcile();
  now = 6_000;
  await recovery.reconcile();
  assert.deepEqual(repaired, ["visible-ended"]);
  assert.ok(subscribed.has("other-page"));
});

test("serializes overlapping events and stops late results after room cleanup", async () => {
  let release;
  let calls = 0;
  const subscribed = new Set();
  const recovery = createRemoteMediaRecovery({
    peers: () => [{ id: "a", enabled: true }],
    subscribed,
    subscribe: () => {
      calls += 1;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    unsubscribe: async () => {},
  });
  const pending = recovery.reconcile();
  await recovery.reconcile();
  assert.equal(calls, 1);
  recovery.stop();
  release();
  await pending;
  assert.equal(subscribed.size, 0);
  await recovery.reconcile();
  assert.equal(calls, 1);
});
