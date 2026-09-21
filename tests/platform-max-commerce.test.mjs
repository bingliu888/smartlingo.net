import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { SMARTLINGO_PLATFORM_PRODUCTS } from "../lib/platform-commerce.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("platform catalog has exactly two fixed-term Max offers and one credit pack", () => {
  assert.deepEqual(SMARTLINGO_PLATFORM_PRODUCTS, [
    { id: "max_6m", kind: "max", months: 6, credits: 0, usdCents: 11_900, displayPrice: "$119" },
    { id: "max_12m", kind: "max", months: 12, credits: 0, usdCents: 19_900, displayPrice: "$199" },
    { id: "aigc_1000", kind: "aigc", months: 0, credits: 1_000, usdCents: 1_000, displayPrice: "$10" },
  ]);
});

test("public plans follow the status, two Max cards, credit band, and verified payment-choice hierarchy", async () => {
  const [page, plans, chooser, paymentPage, css, footer] = await Promise.all([
    read("../app/[lang]/pricing/page.tsx"),
    read("../components/PlatformPlans.tsx"),
    read("../components/PaymentMethodChooser.tsx"),
    read("../app/[lang]/pricing/pay/[product]/page.tsx"),
    read("../app/globals.css"),
    read("../components/SiteFooter.tsx"),
  ]);
  assert.match(page, /<PlatformPlans/);
  assert.match(footer, /\/pricing/);
  for (const marker of ["platform-status-card", "platform-max-card", "aigc-credit-card", "Choose payment method", "pricing/pay/"]) assert.match(plans, new RegExp(marker));
  for (const marker of ["Credit card or US bank account", "Crypto", "SmartPay5", "payment-method-grid"]) assert.match(chooser, new RegExp(marker));
  assert.match(paymentPage, /stripeCommerceConfigured\(\)/);
  assert.match(plans, /every Beginner course stays free with ads/i);
  assert.match(plans, /7-day Max trial/);
  assert.match(plans, /platform-free-card/);
  assert.match(css, /\.platform-plan-grid\{[^}]*repeat\(3/);
});

test("member dashboard reuses the Konectible plan and credit summary pattern", async () => {
  const [panel, css] = await Promise.all([
    read("../components/MembershipPanel.tsx"),
    read("../app/globals.css"),
  ]);
  assert.match(panel, /dashboard-creator-summary dashboard-platform-summary/);
  assert.match(panel, /MAX MEMBERSHIP/);
  assert.match(panel, /AIGC TOKEN CREDIT/);
  assert.match(panel, /\$\{lang\}\/pricing#aigc-credits/);
  assert.match(css, /\.dashboard-creator-summary\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:720px\)\{\.dashboard-creator-summary\{grid-template-columns:1fr\}/);
});

test("Stripe and SmartPay complete the same server-authoritative products", async () => {
  const [checkout, complete, webhook, runtime, workflow, fulfillment, presets, options, claim] = await Promise.all([
    read("../app/api/billing/platform/stripe/checkout/route.ts"),
    read("../app/api/billing/platform/stripe/complete/route.ts"),
    read("../app/api/billing/platform/stripe/webhook/route.ts"),
    read("../lib/stripe-runtime.ts"),
    read("../.github/workflows/deploy-cloudflare.yml"),
    read("../lib/platform-entitlements.ts"),
    read("../lib/smartpay5-presets.ts"),
    read("../app/api/billing/crypto/smartpay/options/route.ts"),
    read("../lib/smartlingo-smartpay-claim.ts"),
  ]);
  assert.match(checkout, /payment_method_types\[0\].*card/s);
  assert.match(checkout, /payment_method_types\[1\].*us_bank_account/s);
  assert.match(checkout, /mode: "payment"/);
  assert.match(checkout, /idempotency-key/);
  assert.doesNotMatch(checkout, /mode: "subscription"|recurring/);
  assert.match(complete, /fulfillPlatformProduct/);
  assert.match(runtime, /STRIPE_SECRET_KEY\?\.trim\(\) && env\.STRIPE_WEBHOOK_SECRET\?\.trim\(\)/);
  assert.match(webhook, /validStripeSignature/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
  assert.match(webhook, /fulfillPlatformProduct/);
  assert.match(workflow, /wrangler secret put STRIPE_SECRET_KEY/);
  assert.match(workflow, /wrangler secret put STRIPE_WEBHOOK_SECRET/);
  assert.match(fulfillment, /addAigcCredits/);
  assert.match(fulfillment, /cadence='max'/);
  assert.match(presets, /SMARTLINGO_PLATFORM_PRODUCTS/);
  assert.match(options, /option\.plan === product/);
  assert.match(claim, /fulfillPlatformProduct/);
});

test("AIGC credits use an idempotent non-negative ledger and debit only completed media", async () => {
  const [migration, ledger, costs, image, audio, studio] = await Promise.all([
    read("../drizzle/0185_platform_max_aigc_credits.sql"),
    read("../lib/aigc-credits.ts"),
    read("../lib/platform-commerce.ts"),
    read("../app/api/referral-media/route.ts"),
    read("../app/api/aigc/audio/route.ts"),
    read("../components/ShareStudio.tsx"),
  ]);
  for (const marker of ["smartlingo_platform_checkout_intents", "smartlingo_aigc_credit_accounts", "smartlingo_aigc_credit_ledger", "smartlingo_platform_smartpay_claims"]) assert.match(migration, new RegExp(marker));
  assert.match(migration, /balance INTEGER NOT NULL DEFAULT 0 CHECK\(balance>=0\)/);
  assert.match(migration, /provider_reference TEXT NOT NULL UNIQUE/);
  assert.match(ledger, /AIGC_CREDITS_REQUIRED/);
  assert.match(costs, /image: 20, audio: 10, video: 200/);
  assert.match(image, /consumeAigcCredits/);
  assert.match(audio, /refundAigcCredits/);
  assert.match(image, /if \(debited\) await refundAigcCredits/);
  assert.match(audio, /if \(debited\) await refundAigcCredits/);
  assert.ok(studio.indexOf("new Blob(chunks") < studio.indexOf('fetch("/api/aigc/credits"'), "video is charged only after a non-empty recording exists");
});
