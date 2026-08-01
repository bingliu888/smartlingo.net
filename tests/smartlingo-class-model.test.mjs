import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("class collection API lets every authenticated member create a private teacher or coordinator class", async () => {
  const route = await read("../app/api/classes/route.ts");

  assert.match(route, /getSessionUser/);
  assert.match(route, /status: 401/);
  assert.match(route, /input\.ownerRole === "teacher"/);
  assert.match(route, /input\.ownerRole === "coordinator"/);
  assert.match(route, /smartlingo_language_paths WHERE id = \? AND status = 'published'/);
  assert.match(route, /smartlingo_language_classes/);
  assert.match(route, /'open', 'private'/);
  assert.match(route, /smartlingo_language_class_members/);
  assert.match(route, /'owner', 'active'/);
  assert.match(route, /quoteClassOrder/);
  assert.match(route, /charged: false/);
  assert.doesNotMatch(route, /licenseKey|assertClassCreationAllowed|membershipTier|Platinum|Gold/);
});

test("class API keeps class commerce separate from subscription referral rewards", async () => {
  const [route, commerce, schema, migration, claim, enrollment, referrals, licenses, deepLink] = await Promise.all([
    read("../app/api/classes/route.ts"),
    read("../lib/smartlingo-commerce.ts"),
    read("../db/schema.ts"),
    read("../drizzle/0017_smartlingo_language_marketplace.sql"),
    read("../app/api/classes/referrals/claim/route.ts"),
    read("../app/api/classes/[classId]/enroll/route.ts"),
    read("../app/api/classes/[classId]/referrals/route.ts"),
    read("../app/api/classes/licenses/route.ts"),
    read("../app/r/class/[code]/route.ts"),
  ]);

  assert.match(route, /classPaymentsCreateIntroducerRewards: false/);
  assert.match(commerce, /payment\.source !== "platform_subscription"/);
  assert.match(commerce, /payment\.eventType !== "invoice\.paid"/);
  assert.match(schema, /smartlingo_language_class_orders/);
  assert.match(schema, /smartlingo_platform_subscription_payments/);
  assert.match(schema, /smartlingo_introducer_reward_ledger/);
  assert.match(migration, /smartlingo_language_class_order_split_ck/);
  assert.match(migration, /smartlingo_introducer_reward_ledger_subscription_payment_id_unique/);
  assert.doesNotMatch(migration, /(?:^|\n)\s*(?:DROP|DELETE)\b/i);
  for (const legacyRoute of [claim, enrollment, referrals, licenses, deepLink]) {
    assert.match(legacyRoute, /status: 410/);
    assert.doesNotMatch(legacyRoute, /INSERT|UPDATE|smartlingo_bacc_ledger/i);
  }
  assert.match(claim, /points: 0/);
  assert.match(referrals, /rewardPoints: 0/);
});

test("Class Studio is bilingual and exposes the approved class economics without tier gates", async () => {
  const [component, page] = await Promise.all([
    read("../components/ClassStudio.tsx"),
    read("../app/[lang]/classes/page.tsx"),
  ]);

  for (const copy of [
    "每位已登录的 SmartLingo 会员都可作为教师或协调员创建私有语言班",
    "同一学员首次支付本班费用可享受八五折",
    "优惠后税前金额的 70% 归班级开办人",
    "班级付款永不产生介绍人积分",
    "Stripe Connect 入驻",
  ]) assert.match(component, new RegExp(copy));
  assert.match(component, /quoteClassOrder/);
  assert.match(component, /initialClassId/);
  assert.match(component, /signInUrl/);
  assert.doesNotMatch(component, /铂金|黄金|licenseKey|BACC/);
  assert.match(page, /SiteHeader/);
  assert.match(page, /SiteFooter/);
});
