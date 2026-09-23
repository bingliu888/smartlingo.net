import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("saving a learning plan or quick course cannot start the Max trial", () => {
  const quickCourse = read("../app/api/quick-courses/route.ts");
  const planner = read("../components/LearningPathPlanner.tsx");
  assert.match(quickCourse, /hasCourseTierAccess\(user, tier\)/);
  assert.doesNotMatch(quickCourse, /startMaxTrial: level !== "beginner"/);
  assert.match(planner, /if \(chosenLevel !== "beginner"\)/);
  assert.match(planner, /window\.location\.assign\(`\/\$\{lang\}\/classes\/\$\{encodeURIComponent\(payload\.path\.classId\)\}`\)/);
  assert.doesNotMatch(planner, /starts one 7-day Max trial automatically/);
});

test("only an explicit course-detail trial action requests trial activation", () => {
  const enrollment = read("../app/api/classes/[classId]/enroll/route.ts");
  const studio = read("../components/ClassStudio.tsx");
  assert.match(enrollment, /body\.startMaxTrial === true/);
  assert.match(enrollment, /startMaxTrial && request\.headers\.get\("origin"\)/);
  assert.match(enrollment, /startMaxTrial: course\.packageTier !== "basic" && startMaxTrial/);
  assert.match(studio, /joinCourse\(item\.id, Boolean\(detail\.courseAccess\?\.trialAvailable && !accessAllowed\)\)/);
  assert.match(studio, /Start my 7-day Max trial/);
});
