import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartLingo requires an explicit language-scoped fixed-term package", async () => {
  const [classes, enrollment, component, checkout] = await Promise.all([
    source("app/api/classes/route.ts"),
    source("app/api/classes/[classId]/enroll/route.ts"),
    source("components/CoursePaymentActions.tsx"),
    source("app/api/billing/card/checkout/route.ts"),
  ]);

  assert.match(classes, /paymentMode: "fixed_term_package"/);
  assert.match(classes, /durationsMonths: \[3,6,12\]/);
  assert.match(classes, /fixedPlatformPricing: true/);
  assert.match(enrollment, /PACKAGE_PAYMENT_REQUIRED/);
  assert.match(component, /SMARTLINGO_COURSE_DURATIONS\.map/);
  assert.match(component, /targetLanguage/);
  assert.match(component, /Pay once by card/);
  assert.match(checkout, /mode: "payment"/);
  assert.match(checkout, /metadata\[target_language\]/);
  assert.match(checkout, /metadata\[duration_months\]/);
  assert.doesNotMatch(`${classes}\n${enrollment}\n${component}\n${checkout}`, /firstMonthFree|trial_period_days|mode: "subscription"/);
});

test("member-created course orders cannot produce introducer points", async () => {
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
