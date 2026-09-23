import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/classes/[classId]/route.ts", import.meta.url), "utf8");
const studio = readFileSync(new URL("../components/ClassStudio.tsx", import.meta.url), "utf8");

test("course detail uses the deployed course-classroom schema", () => {
  assert.match(route, /smartlingo_course_classrooms WHERE course_id=\?/);
  assert.match(route, /smartlingo_course_classrooms cc WHERE cc\.course_id=\?/);
  assert.doesNotMatch(route, /smartlingo_course_classrooms(?: cc)? WHERE (?:cc\.)?class_id=\?/);
});

test("course detail loading failures are visible instead of spinning forever", () => {
  assert.match(studio, /aria-live="polite"/);
  assert.match(studio, /notice && <p className="class-notice">/);
});

test("reading a course detail cannot consume the one-time Max trial", () => {
  const enroll = readFileSync(new URL("../app/api/classes/[classId]/enroll/route.ts", import.meta.url), "utf8");
  assert.match(route, /hasCourseTierAccess\(user, detail\.packageTier\)/);
  assert.doesNotMatch(route, /startMaxTrial/);
  assert.match(route, /trialAvailable/);
  assert.match(enroll, /startMaxTrial: course\.packageTier !== "basic" && startMaxTrial/);
  assert.match(studio, /Start my 7-day Max trial/);
  assert.match(studio, /does not renew or charge automatically/);
  assert.match(studio, /JSON\.stringify\(\{ startMaxTrial \}\)/);
});
