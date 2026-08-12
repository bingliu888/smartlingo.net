import test from "node:test";
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
  assert.match(source("../components/ClassAccessManagers.tsx"),/Co-hosts/);
  assert.match(source("../components/ClassAccessManagers.tsx"),/Subscribers/);
});
