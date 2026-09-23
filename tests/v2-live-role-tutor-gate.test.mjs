import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("the unfinished live tutor stays closed and uses expiry-aware Max entitlement", async () => {
  const [route, usage] = await Promise.all([
    read("../app/api/assistant/live/route.ts"),
    read("../app/api/assistant/live/usage/route.ts"),
  ]);
  assert.match(route, /SMARTLINGO_MAX_ROLE_TUTOR_ENABLED !== "1"/);
  assert.match(route, /hasMaxCourseAccess\(user\)/);
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/);
  assert.doesNotMatch(route, /subscriptions\.status|status === "trialing"/);
  assert.match(usage, /hasMaxCourseAccess\(user\)/);
  assert.doesNotMatch(usage, /subscriptions\.status|status === "trialing"/);
});
