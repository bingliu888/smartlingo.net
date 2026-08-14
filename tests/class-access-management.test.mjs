import test from "node:test";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("live classrooms persist co-host and subscriber access independently", () => {
  const migration=source("../drizzle/0109_class_cohosts_subscribers.sql");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS live_class_cohosts/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS live_class_subscriptions/);
  assert.match(migration,/CHECK\s*\(status IN \('trial','active','cancelled','expired'\)\)/);
});

test("co-hosts share management authority and can find managed classes", () => {
  const managers=source("../lib/class-managers.ts"),classes=source("../lib/live-classrooms.ts");
  assert.match(managers,/isClassCoHost\(room\.id,user\)/);
  assert.match(classes,/LEFT JOIN live_class_cohosts/);
  assert.match(classes,/if \(!user\) return \[\]/);
  assert.match(source("../app/api/classrooms/[code]/playlist/route.ts"),/canManageClass/);
  assert.match(source("../app/api/classrooms/[code]/route.ts"),/UPDATE live_class_rooms/);
});

test("paid trial access is seven days and subscriber aware", () => {
  const managers=source("../lib/class-managers.ts"),classes=source("../lib/live-classrooms.ts");
  assert.match(managers,/7\*24\*60\*60/);
  assert.match(managers,/current\?\.status==="active"/);
  assert.match(managers,/reason:"PAYMENT_REQUIRED"/);
  assert.match(classes,/paidClassAccess\(room,user,startTrial\)/);
});

test("class item exposes badges, edit, co-host and conditional subscriber controls", () => {
  const detail=source("../components/class-detail-experience.tsx");
  assert.match(detail,/class-entry-badges/);
  assert.match(detail,/ClassEditDialog/);
  assert.match(detail,/showSubscribers=\{room\.tuitionCents>0\}/);
  assert.match(source("../components/ClassAccessManagers.tsx"),/Co-teachers/);
  assert.match(source("../components/ClassAccessManagers.tsx"),/Subscribers/);
});

test("admin Users section exposes paid Teachers and add-teacher access", () => {
  const pageCandidates = ["../app/admin/members/page.tsx", "../app/[lang]/admin/members/page.tsx"];
  const pagePath = pageCandidates.find(item => existsSync(new URL(item, import.meta.url)));
  assert.ok(pagePath);
  const page = source(pagePath);
  const actions = source("../components/AdminMemberActions.tsx");
  const api = source("../app/api/admin/members/route.ts");
  assert.match(page, /teachers/);
  assert.match(page, /Teachers|教师/);
  assert.match(page, /subscriber_override/);
  assert.match(actions, /grant-teacher/);
  assert.match(actions, /Add Teacher|添加教师/);
  assert.match(api, /grant-teacher/);
  assert.match(api, /subscriber_override=1/);
  assert.doesNotMatch(api, /INSERT INTO platform_user_roles/);
  assert.doesNotMatch(actions, /grant-admin/);
});

test("only Teachers and platform administrators can create classrooms", () => {
  const routeCandidates = ["../app/api/classrooms/route.ts", "../app/api/classes/route.ts"];
  const routePath = routeCandidates.find(item => existsSync(new URL(item, import.meta.url)));
  assert.ok(routePath);
  const route = source(routePath);
  assert.match(route, /if\(!await isTeacherUser\(user\)\)/);
  assert.match(route, /Teacher or administrator access required/);
  const access = source("../lib/admin-access.ts");
  assert.match(access, /isTeacherUser/);
  assert.match(access, /subscriber_override/);
});

test("live class directory uses Teacher terminology without changing its export", () => {
  const directory = source("../components/live-class-directory.tsx");
  assert.match(directory, /export function LiveClassDirectory/);
  assert.match(directory, /Teacher class quota/);
  assert.match(directory, /Teachers and Co-teachers/);
  assert.doesNotMatch(directory, /Director class quota|Directors and Co-directors/);
});
