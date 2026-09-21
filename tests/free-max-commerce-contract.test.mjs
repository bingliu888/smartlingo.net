import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { SMARTLINGO_PLATFORM_PRODUCTS } from "../lib/platform-commerce.ts";
import { smartPay5GlcDisplayAmountForUsdCents } from "../lib/smartpay5-price-mapping.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("SmartLingo commerce exposes only two Max terms and one independent AIGC credit pack", async () => {
  assert.deepEqual(SMARTLINGO_PLATFORM_PRODUCTS, [
    { id: "max_6m", kind: "max", months: 6, credits: 0, usdCents: 11_900, displayPrice: "$119" },
    { id: "max_12m", kind: "max", months: 12, credits: 0, usdCents: 19_900, displayPrice: "$199" },
    { id: "aigc_1000", kind: "aigc", months: 0, credits: 1_000, usdCents: 1_000, displayPrice: "$10" },
  ]);
  assert.equal(smartPay5GlcDisplayAmountForUsdCents(11_900), "120000000");
  assert.equal(smartPay5GlcDisplayAmountForUsdCents(19_900), "200000000");
  assert.equal(smartPay5GlcDisplayAmountForUsdCents(1_000), "10000000");
  const [plans, presets, options, stripeCheckout, claim] = await Promise.all([
    read("../lib/subscription-plans.ts"), read("../lib/smartpay5-presets.ts"),
    read("../app/api/billing/crypto/smartpay/options/route.ts"),
    read("../app/api/billing/platform/stripe/checkout/route.ts"), read("../lib/smartlingo-smartpay-claim.ts"),
  ]);
  for (const id of ["max_6m", "max_12m", "aigc_1000"]) assert.match(`${plans}\n${presets}`, new RegExp(id));
  assert.match(options, /platformProduct\(product\)/);
  assert.match(stripeCheckout, /payment_method_types\[1\].*us_bank_account/s);
  assert.match(claim, /fulfillPlatformProduct/);
  assert.doesNotMatch(`${plans}\n${presets}\n${options}`, /smartlingo_course_(?:basic|intermediate|advanced)_3m/);
});

test("all class-level checkout and redemption routes are absent", async () => {
  for (const path of [
    "../app/api/billing/card/checkout/route.ts", "../app/api/billing/card/complete/route.ts",
    "../app/api/billing/card/webhook/route.ts", "../app/api/billing/credits/redeem/route.ts",
    "../components/CoursePaymentActions.tsx", "../lib/course-package-purchase.ts",
  ]) await assert.rejects(access(new URL(path, import.meta.url)), error => error?.code === "ENOENT");
  const packages = await read("../lib/smartlingo-course-packages.ts");
  assert.match(packages, /SMARTLINGO_COURSE_PACKAGES/);
  assert.doesNotMatch(packages, /SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES|PACKAGE_PRICES|startingPriceCents/);
});

test("migration retires nine legacy products and grandfathers paid access into Max", async () => {
  const migration = await read("../drizzle/0186_free_max_course_access.sql");
  assert.match(migration, /cadence='max'/);
  assert.match(migration, /INSERT INTO subscriptions/);
  assert.match(migration, /smartlingo_course_packages SET status='retired'/);
  assert.match(migration, /smartpay5_payment_item_states[\s\S]*enabled=0/);
  assert.match(migration, /WHEN id LIKE '%_basic' THEN 'Free Beginner course/);
  assert.match(migration, /7-day Max trial, then active Max/);
  assert.match(migration, /official courses are curriculum levels governed by Free and Max/);
});

test("Beginner is free while higher levels receive one bounded Max trial before payment", async () => {
  const [entitlements, accessSource, enroll, classroom, roster] = await Promise.all([
    read("../lib/platform-entitlements.ts"), read("../lib/smartlingo-learning-access.ts"),
    read("../app/api/classes/[classId]/enroll/route.ts"), read("../app/api/classes/[classId]/classroom/route.ts"),
    read("../app/api/classes/[classId]/students/route.ts"),
  ]);
  assert.match(entitlements, /hasActiveMaxSubscription/);
  assert.match(entitlements, /MAX_TRIAL_SECONDS = 7 \* 24 \* 60 \* 60/);
  assert.match(entitlements, /trial_ends_at IS NULL/);
  assert.match(entitlements, /tier === "basic"/);
  assert.match(accessSource, /hasCourseTierAccess/);
  assert.match(enroll, /MAX_REQUIRED/);
  assert.match(enroll, /startMaxTrial: course\.packageTier !== "basic"/);
  assert.match(classroom, /hasCourseTierAccess/);
  assert.match(roster, /LEFT JOIN subscriptions/);
  assert.match(roster, /Course-level subscriptions have been retired/);
  assert.doesNotMatch(`${enroll}\n${classroom}\n${roster}`, /INSERT INTO smartlingo_course_subscriptions/);
});
