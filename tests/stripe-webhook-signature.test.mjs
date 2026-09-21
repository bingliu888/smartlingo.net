import assert from "node:assert/strict";
import test from "node:test";
import { validStripeSignature } from "../lib/stripe-webhook.ts";

async function signature(secret, timestamp, body) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`))).toString("hex");
}

test("Stripe webhook accepts only a current matching v1 signature", async () => {
  const secret = "whsec_inert_smartlingo_test";
  const body = JSON.stringify({ id: "evt_inert", type: "checkout.session.completed" });
  const timestamp = 1_800_000_000;
  const digest = await signature(secret, timestamp, body);
  assert.equal(await validStripeSignature(body, `t=${timestamp},v1=${digest}`, secret, timestamp * 1_000), true);
  assert.equal(await validStripeSignature(`${body}x`, `t=${timestamp},v1=${digest}`, secret, timestamp * 1_000), false);
  assert.equal(await validStripeSignature(body, `t=${timestamp - 301},v1=${digest}`, secret, timestamp * 1_000), false);
});
