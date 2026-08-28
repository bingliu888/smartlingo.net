import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("course Supervisor attribution is independent, immutable, and payment-scoped",()=>{
  const migration=read("../drizzle/0174_course_subscription_supervisor.sql");
  const purchase=read("../lib/course-package-purchase.ts");
  const claim=read("../app/api/course-subscriptions/[subscriptionId]/supervisor/route.ts");
  assert.match(migration,/supervisor_user_id TEXT REFERENCES users/);
  assert.match(migration,/smartlingo_course_subscription_supervisor_update_guard/);
  assert.match(migration,/OLD\.supervisor_user_id IS NOT NULL/);
  assert.match(migration,/NEW\.supervisor_user_id=NEW\.user_id/);
  assert.match(migration,/smartlingo_course_supervisor_reward_events/);
  assert.doesNotMatch(migration,/smartlingo_introducer_reward_ledger/);
  assert.match(purchase,/eligibleCourseSupervisorByRefId/);
  assert.match(purchase,/SELF_SUPERVISION_NOT_ALLOWED/);
  assert.match(purchase,/COALESCE\(smartlingo_course_subscriptions\.supervisor_user_id,excluded\.supervisor_user_id\)/);
  assert.match(purchase,/reward_amount_cents,status/);
  assert.match(claim,/WHERE id=\? AND user_id=\? AND supervisor_user_id IS NULL/);
  assert.match(claim,/Invalid Supervisor RefID/);
});

test("course Supervisor links survive card, crypto, and authentication boundaries",()=>{
  const page=read("../app/[lang]/classes/[classId]/page.tsx");
  const card=read("../app/api/billing/card/checkout/route.ts");
  const crypto=read("../components/CryptoCheckout.tsx");
  const menu=read("../components/HeaderAccount.tsx");
  assert.match(page,/returnQuery\.set\("supervisor",supervisorRefId\)/);
  assert.match(card,/metadata\[supervisor_ref_id\]/);
  assert.match(card,/payment_intent_data\[metadata\]\[supervisor_ref_id\]/);
  assert.match(crypto,/supervisorRefId/);
  assert.match(menu,/my-students/);
});

test("all twelve interface languages have Supervisor UI copy",()=>{
  const locale=read("../lib/course-supervisor-locale.ts");
  for(const code of ["en","zh","ja","ko","es","fr","de","ru","it","pt","ar","hi"])assert.match(locale,new RegExp(`\\b${code}:`));
});

test("database guards accept a valid Supervisor once and reject reassignment or self-supervision",()=>{
  const database=new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  database.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE smartlingo_language_classes(id TEXT PRIMARY KEY);
    CREATE TABLE smartpay_ref_ids(user_id TEXT PRIMARY KEY REFERENCES users(id),ref_id TEXT NOT NULL UNIQUE);
    CREATE TABLE smartlingo_course_package_purchases(id TEXT PRIMARY KEY);
    INSERT INTO users VALUES('vip'),('learner'),('other');
    INSERT INTO smartlingo_language_classes VALUES('course');
    INSERT INTO smartpay_ref_ids VALUES('vip','ABC234'),('other','XYZ789');`);
  for(const statement of read("../drizzle/0174_course_subscription_supervisor.sql").split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))database.exec(statement);
  const insert=database.prepare(`INSERT INTO smartlingo_course_subscriptions
    (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,supervisor_user_id,supervisor_ref_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
  insert.run("sub","course","learner","active",3000,1,2,3,"vip","ABC234",1,1);
  assert.equal(database.prepare("SELECT supervisor_ref_id FROM smartlingo_course_subscriptions WHERE id='sub'").get().supervisor_ref_id,"ABC234");
  assert.throws(()=>database.exec("UPDATE smartlingo_course_subscriptions SET supervisor_user_id='other',supervisor_ref_id='XYZ789' WHERE id='sub'"),/immutable or invalid course supervisor/);
  assert.throws(()=>insert.run("self","course","vip","active",3000,1,2,3,"vip","ABC234",1,1),/invalid course supervisor/);
  database.close();
});
