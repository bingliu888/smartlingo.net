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
