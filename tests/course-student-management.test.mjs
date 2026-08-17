import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("course managers see course-scoped Trial and Subscribers controls", async () => {
  const [studio, manager] = await Promise.all([
    read("../components/ClassStudio.tsx"),
    read("../components/CourseStudentManager.tsx"),
  ]);
  assert.match(studio, /detail\.canManage && <CourseStudentManager/);
  for (const marker of ["Trial", "Subscribers", "Enable Subscription", "Disable Subscription", "Registered member email"]) {
    assert.match(manager, new RegExp(marker));
  }
  assert.match(manager, /\+ \{t\.add\}/);
  assert.match(manager, /window\.confirm/);
  assert.match(manager, /only to this course/);
});

test("manual subscription actions preserve accounts and platform roles", async () => {
  const route = await read("../app/api/classes/[classId]/students/route.ts");
  assert.match(route, /isAdminUser\(user\)/);
  assert.match(route, /live_class_cohosts/);
  assert.match(route, /class_kind='official_course'/);
  assert.match(route, /subscription\.status IN \('trialing','active'\)/);
  assert.match(route, /course_subscription\.manual_disable/);
  assert.match(route, /SET status='cancelled'/);
  assert.match(route, /SET status='paused'/);
  assert.match(route, /platform_admin_audit/);
  assert.match(route, /ON CONFLICT\(class_id,user_id\)/);
  assert.doesNotMatch(route, /DELETE FROM users|DELETE FROM smartlingo_language_class_members/);
  assert.doesNotMatch(route, /platform_member_access|INSERT INTO subscriptions|UPDATE subscriptions/);
});
