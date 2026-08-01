import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("legacy subscription and PayPal webhook endpoints are inert 410 routes", async () => {
  const [subscribe, webhook] = await Promise.all([
    read("../app/api/billing/subscribe/route.ts"),
    read("../app/api/paypal/webhook/route.ts"),
  ]);

  for (const source of [subscribe, webhook]) {
    assert.match(source, /LEGACY_PAYMENT_RETIRED/);
    assert.match(source, /status:\s*410/);
    assert.match(source, /cache-control.*no-store/);
    assert.doesNotMatch(source, /getDb|getDatabase|\.insert\(|\.update\(|\.delete\(|fetch\(|request\.json\(/);
  }
  assert.match(subscribe, /charged:\s*false/);
  assert.match(webhook, /processed:\s*false/);
});

test("PayPal implementation module is removed and source has no live PayPal integration", async () => {
  await assert.rejects(read("../lib/paypal.ts"), error => error?.code === "ENOENT");
  const [subscribe, webhook, scanner] = await Promise.all([
    read("../app/api/billing/subscribe/route.ts"),
    read("../app/api/paypal/webhook/route.ts"),
    read("../scripts/scan-sensitive-data.mjs"),
  ]);
  assert.doesNotMatch(`${subscribe}\n${webhook}\n${scanner}`, /PAYPAL_CLIENT|PAYPAL_SECRET|api-m\.paypal\.com/);
});
