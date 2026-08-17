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
  assert.match(source("../components/ClassAccessManagers.tsx"),/Co-hosts \/ speakers/);
});

test("fixed MVP courses are bulk-created with private Webinar A/V classrooms", () => {
  const migration = source("../drizzle/0119_fixed_mvp_courses.sql");
  assert.match(migration, /class_kind='official_course'/);
  assert.match(migration, /'private','video','webinar'/);
  assert.match(migration, /smartlingo_course_classrooms/);
  assert.match(migration, /CROSS JOIN tiers/);
});

test("fixed courses bulk-create free group-audio practice rooms", () => {
  const migration = source("../drizzle/0122_course_practice_rooms.sql");
  const access = source("../lib/live-classrooms.ts");
  const roomRoute = source("../app/api/classrooms/[code]/route.ts");
  assert.match(migration, /36|CROSS JOIN tiers/);
  assert.match(migration, /'private','audio','group_call'/);
  assert.match(migration, /tuition_cents,mute_all/);
  assert.match(access, /smartlingo_course_practice_rooms/);
  assert.match(roomRoute, /coursePracticeRoomLocked/);
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
