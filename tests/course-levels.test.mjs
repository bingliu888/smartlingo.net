import assert from "node:assert/strict";
import test from "node:test";
import { SMARTLINGO_COURSE_PACKAGES, fixedCourseId } from "../lib/smartlingo-course-packages.ts";

test("the curriculum keeps exactly three non-priced course levels", () => {
  assert.deepEqual(SMARTLINGO_COURSE_PACKAGES.map(item => [item.tier, item.level]), [
    ["basic", "A1"], ["intermediate", "A2"], ["advanced", "B1+"],
  ]);
  for (const item of SMARTLINGO_COURSE_PACKAGES) {
    assert.equal("priceCents" in item, false);
    assert.equal("startingPriceCents" in item, false);
  }
  assert.equal(fixedCourseId("it", "intermediate"), "course_it_intermediate");
});
