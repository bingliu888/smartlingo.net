import test from "node:test";
import assert from "node:assert/strict";
import {
  createLocalMediaHealthMonitor,
  publishedLocalTrackIsLive,
} from "../lib/local-media-health.ts";

test("published local track health prefers a live producer and safely falls back to self media", () => {
  assert.equal(
    publishedLocalTrackIsLive(
      {
        audioEnabled: true,
        audioTrack: { readyState: "ended" },
        producers: [
          { kind: "audio", closed: false, track: { readyState: "live" } },
        ],
      },
      "audio",
    ),
    true,
  );
  assert.equal(
    publishedLocalTrackIsLive(
      { videoEnabled: true, videoTrack: { readyState: "ended" } },
      "video",
    ),
    false,
  );
  assert.equal(
    publishedLocalTrackIsLive(
      {
        audioEnabled: true,
        audioTrack: { readyState: "live" },
        producers: [],
      },
      "audio",
    ),
    false,
    "a local capture alone is not proof that RealtimeKit is publishing it",
  );
});

test("local controls update immediately but dead publishers clear only after a stable grace period", async () => {
  let now = 0;
  const health = [];
  const stale = [];
  let snapshot = {
    audio: { expected: true, live: false },
    video: { expected: true, live: true },
  };
  const monitor = createLocalMediaHealthMonitor({
    snapshot: () => snapshot,
    onHealth: (value) => health.push(value),
    onStale: async (kinds) => stale.push(...kinds),
    now: () => now,
  });
  await monitor.reconcile();
  assert.equal(health.at(-1).audio.live, false);
  now = 5_999;
  await monitor.reconcile();
  assert.deepEqual(stale, []);
  snapshot = {
    audio: { expected: true, live: true },
    video: { expected: true, live: true },
  };
  await monitor.reconcile();
  snapshot.audio.live = false;
  now = 6_000;
  await monitor.reconcile();
  now = 12_000;
  await monitor.reconcile();
  assert.deepEqual(stale, ["audio"]);
});
