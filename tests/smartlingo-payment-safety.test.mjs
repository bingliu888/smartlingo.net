import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartLingo starts a server-recorded free month without charging", async () => {
  const [classes, enrollment, component] = await Promise.all([
    source("app/api/classes/route.ts"),
    source("app/api/classes/[classId]/enroll/route.ts"),
    source("components/ClassStudio.tsx"),
  ]);

  assert.match(classes, /paymentMode: "monthly_subscription"/);
  assert.match(classes, /fixedPlatformPricing: true/);
  assert.match(enrollment, /charged: false/);
  assert.match(enrollment, /firstMonthFree: true/);
  assert.match(enrollment, /smartlingo_course_subscriptions/);
  assert.match(component, /第一个月免费/);
  assert.doesNotMatch(`${classes}\n${enrollment}`, /stripe\.checkout|PaymentIntent|destination_charge/i);
});

test("member-created class orders cannot produce introducer points", async () => {
  const [commerce, claim, referral] = await Promise.all([
    source("lib/smartlingo-commerce.ts"),
    source("app/api/classes/referrals/claim/route.ts"),
    source("app/api/classes/[classId]/referrals/route.ts"),
  ]);

  assert.match(commerce, /payment\.source !== "platform_subscription"/);
  assert.match(claim, /points: 0/);
  assert.match(referral, /rewardPoints: 0/);
  assert.doesNotMatch(`${claim}\n${referral}`, /INSERT|UPDATE|smartlingo_bacc_ledger/i);
});
