import assert from "node:assert/strict";
import test from "node:test";
import {
  SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES,
  addCourseSubscriptionMonths,
  courseSubscriptionMainId,
  courseSubscriptionPackageForMainId,
  fixedCourseId,
} from "../lib/smartlingo-course-packages.ts";

const expected = [
  ["basic_3m", "basic", 3, 3_000],
  ["basic_6m", "basic", 6, 5_000],
  ["basic_12m", "basic", 12, 8_000],
  ["intermediate_3m", "intermediate", 3, 6_000],
  ["intermediate_6m", "intermediate", 6, 10_000],
  ["intermediate_12m", "intermediate", 12, 16_000],
  ["advanced_3m", "advanced", 3, 12_000],
  ["advanced_6m", "advanced", 6, 20_000],
  ["advanced_12m", "advanced", 12, 32_000],
];

test("the canonical course catalog contains exactly the nine approved packages", () => {
  assert.deepEqual(
    SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES.map(item => [item.id, item.tier, item.months, item.priceCents]),
    expected,
  );
});

test("SmartPay package IDs encode level and duration while second IDs remain languages", () => {
  assert.equal(courseSubscriptionMainId("basic", 3), "smartlingo_course_basic_3m");
  assert.deepEqual(courseSubscriptionPackageForMainId("smartlingo_course_advanced_3m"), {
    id: "advanced_3m", tier: "advanced", months: 3, priceCents: 12_000,
  });
  assert.equal(courseSubscriptionPackageForMainId("smartlingo_course_annual"), null);
  assert.equal(fixedCourseId("it", "intermediate"), "course_it_intermediate");
});

test("course access adds calendar months without overflowing month-end dates", () => {
  const january31 = Date.UTC(2024, 0, 31, 12, 34, 56) / 1000;
  const april30 = Date.UTC(2024, 3, 30, 12, 34, 56) / 1000;
  assert.equal(addCourseSubscriptionMonths(january31, 3), april30);
  const leapDay = Date.UTC(2024, 1, 29, 8, 0, 0) / 1000;
  const nextYearFebruary28 = Date.UTC(2025, 1, 28, 8, 0, 0) / 1000;
  assert.equal(addCourseSubscriptionMonths(leapDay, 12), nextYearFebruary28);
});
