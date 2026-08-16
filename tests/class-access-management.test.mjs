import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("live classrooms persist co-host and subscriber access independently", () => {
  const migration=source("../drizzle/0109_class_cohosts_subscribers.sql");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS live_class_cohosts/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS live_class_subscriptions/);
});

test("co-hosts share management authority inside a classroom", () => {
  const managers=source("../lib/class-managers.ts"),classes=source("../lib/live-classrooms.ts");
  assert.match(managers,/isClassCoHost\(room\.id,user\)/);
  assert.match(classes,/canManageClass\(room,user\)/);
  assert.match(source("../app/api/classrooms/[code]/playlist/route.ts"),/canManageClass/);
});

test("paid trial access is seven days and subscriber aware", () => {
  const managers=source("../lib/class-managers.ts"),classes=source("../lib/live-classrooms.ts");
  assert.match(managers,/7\*24\*60\*60/);
  assert.match(managers,/current\?\.status==="active"/);
  assert.match(classes,/paidClassAccess\(room,user,startTrial\)/);
});

test("classroom item exposes edit, co-host and subscriber controls", () => {
  const detail=source("../components/class-detail-experience.tsx");
  assert.match(detail,/ClassEditDialog/);
  assert.match(detail,/showSubscribers=\{room\.tuitionCents>0\}/);
  assert.match(source("../components/ClassAccessManagers.tsx"),/Co-teachers/);
});

test("creating a course automatically creates its private Webinar A/V classroom", () => {
  const route = source("../app/api/classes/route.ts");
  const helper = source("../lib/course-classrooms.ts");
  assert.match(route, /ensureCourseClassroom/);
  assert.match(helper, /'private','video','webinar'/);
  assert.match(helper, /smartlingo_course_classrooms/);
});

test("course membership authorizes the embedded classroom", () => {
  const access=source("../lib/live-classrooms.ts");
  assert.match(access,/smartlingo_course_classrooms/);
  assert.match(access,/m\.status='active'/);
  assert.match(source("../components/class-detail-experience.tsx"), /timeZone:"America\/Los_Angeles"/);
});

test("standalone classroom creation and directory runtime are removed", () => {
  assert.equal(existsSync(new URL("../components/live-class-directory.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../components/live-class-create-form.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/api/classrooms/route.ts", import.meta.url)), false);
  assert.match(source("../app/[lang]/classrooms/page.tsx"), /redirect\(`\/\$\{locale\}\/classes`/);
});
