import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ghost publishers get a 15-second confirmation after three idle minutes", async () => {
  const guard = await readFile(new URL("../components/MediaActivityGuard.tsx", import.meta.url), "utf8");
  const room = await readFile(new URL("../components/live-class-room-client.tsx", import.meta.url), "utf8");
  assert.match(guard, /MEDIA_IDLE_LIMIT_MS = 3 \* 60 \* 1000/);
  assert.match(guard, /MEDIA_IDLE_CONFIRM_SECONDS = 15/);
  assert.match(guard, /createMediaStreamSource/);
  assert.match(guard, /getImageData/);
  assert.match(room, /active=\{joined && localPublisherStarted\}/);
  assert.match(room, /onExpire=\{\(\) => void leave\(\)\}/);
});

test("unknown pages recover to the home page", async () => {
  const source = await readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8");
  assert.match(source, /window\.location\.replace\("\/"\)/);
});
