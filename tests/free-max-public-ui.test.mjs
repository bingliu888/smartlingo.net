import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("home ends with Free and Max subscription tiles and no legacy course pricing section", async () => {
  const [home, plans, css, layout, locale] = await Promise.all([
    read("../app/[lang]/page.tsx"), read("../components/PlatformPlans.tsx"), read("../app/globals.css"),
    read("../app/[lang]/layout.tsx"), read("../lib/interface-locale.ts"),
  ]);
  assert.match(home, /<PlatformPlans lang=\{locale\} compact\/>[\s\S]*<SiteFooter/);
  assert.match(plans, /FREE PLAN/);
  assert.match(plans, /Every Beginner course stays free with ads/);
  assert.match(plans, /7-day Max trial/);
  assert.match(plans, /every Beginner, Intermediate, and Advanced course/);
  assert.match(plans, /\$0/);
  assert.match(plans, /\$59|displayPrice/);
  assert.match(plans, /AIGC TOKEN CREDIT/);
  assert.doesNotMatch(home, /Nine packages|九个套餐|30 \/ 50 \/ 80|60 \/ 100 \/ 160|120 \/ 200 \/ 320/);
  assert.match(css, /platform-pricing-compact/);
  assert.match(layout, /Free and Max plans/);
  assert.match(locale, /免费与 Max/);
});

test("language pages show three learning levels without payment buttons", async () => {
  const [detail, catalog, classes, admin] = await Promise.all([
    read("../app/[lang]/programs/[language]/page.tsx"), read("../components/LanguageSubscriptionCatalog.tsx"),
    read("../components/ClassStudio.tsx"), read("../app/[lang]/admin/language-classes/page.tsx"),
  ]);
  assert.match(detail, /learning levels, not separate payment products/);
  assert.match(catalog, /THREE COURSE LEVELS · ONE MAX PLAN/);
  assert.match(catalog, /SMARTLINGO_COURSE_PACKAGES\.map/);
  assert.match(catalog, /See Free and Max/);
  assert.match(classes, /Open this free Beginner course/);
  assert.match(classes, /7-day Max trial has started automatically/);
  assert.match(admin, /Course payment items/);
  assert.match(admin, /Course payment items", "课程付款项目"\)\}: 0/);
  assert.doesNotMatch(`${catalog}\n${classes}`, /billing\/card\/checkout|Pay once by card|Pay 3 months/);
});

test("public and legal copy describes Free, Max, and non-cash rewards truthfully", async () => {
  const [terms, refunds, tutorial, smartcards] = await Promise.all([
    read("../app/[lang]/terms/page.tsx"), read("../app/[lang]/refund-policy/page.tsx"),
    read("../app/[lang]/smartcards/tutorial/page.tsx"), read("../components/SmartCardStudio.tsx"),
  ]);
  assert.match(terms, /Every Beginner course is free with ads/);
  assert.match(terms, /7-day Max trial/);
  assert.match(terms, /Max is a one-time six-month or annual purchase/);
  assert.match(refunds, /Refunds must reverse Max access/);
  assert.match(tutorial, /Redeem digital rewards/);
  assert.match(smartcards, /not cash, course-fee credit, or a tradable asset/);
  assert.doesNotMatch(`${terms}\n${refunds}`, /one-time 3-, 6-, or 12-month packages|一次性支付的 3、6 或 12 个月套餐/);
});
