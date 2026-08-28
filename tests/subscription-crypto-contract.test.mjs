import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("SmartLingo keeps seven-day app sessions", async () => {
  const auth = await read("../lib/auth.ts");
  assert.match(auth, /SESSION_SECONDS = 60 \* 60 \* 24 \* 7/);
  assert.match(auth, /Max-Age=\$\{SESSION_SECONDS\}/);
});

test("course prices, public catalog, and course-scoped wallet checkout stay aligned", async () => {
  const [packages, pricing, footer, checkout, actions, card, verify] = await Promise.all([
    read("../lib/smartlingo-course-packages.ts"),
    read("../app/[lang]/pricing/page.tsx"),
    read("../components/SiteFooter.tsx"),
    read("../components/CryptoCheckout.tsx"),
    read("../components/CoursePaymentActions.tsx"),
    read("../app/api/billing/card/checkout/route.ts"),
    read("../app/api/billing/crypto/verify/route.ts"),
  ]);
  for (const marker of ["3_000", "5_000", "8_000", "6_000", "10_000", "16_000", "12_000", "20_000", "32_000", "Beginner", "初期课程"]) assert.match(packages, new RegExp(marker));
  assert.match(footer, /\/programs/);
  assert.doesNotMatch(footer, /\/pricing/);
  assert.match(pricing, /redirect\(`\/\$\{lang\}\/programs`\)/);
  for (const marker of [
    "Connect wallet", "connectEvmWallet", "SMARTPAY3_ABI", "prepared.refId",
    "eth_sendTransaction", "Refresh balances & gas", "Transaction hash", "lockedCourseId",
  ]) assert.ok(checkout.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(checkout, /GreatLoveAutoSwapOnboard|greatlove-onboard|WalletConnect QR|@walletconnect\/ethereum-provider/);
  assert.match(actions, /Pay once by card/);
  assert.match(actions, /Pay 3 months with Polygon USDT or GLC/);
  assert.match(actions, /classes\/\$\{encodeURIComponent\(classId\)\}\/pay\/crypto/);
  assert.match(verify, /claimSmartLingoCoursePayment/);
  assert.match(verify, /classId:String\(body\?\.classId/);
  assert.match(card, /mode: "payment"/);
  assert.match(card, /metadata\[class_id\]/);
  assert.match(card, /metadata\[target_language\]/);
  assert.match(card, /metadata\[duration_months\]/);
  assert.doesNotMatch(card, /trial_period_days|mode: "subscription"/);
  assert.doesNotMatch(`${checkout}\n${card}`, /SmartAICert|SmartMeeting|smartmeeting\.club/);
});

test("site-isolated rails grant only the selected language and three-month crypto package", async () => {
  const [migration, packageMigration, admin, settings, presets, optionsRoute, checkout, claim, purchase, records, status] = await Promise.all([
    read("../drizzle/0172_smartpay3_course_refid.sql"),
    read("../drizzle/0173_course_subscription_packages.sql"),
    read("../components/SmartPayAdminConsole.tsx"),
    read("../app/api/admin/crypto-settings/route.ts"),
    read("../lib/smartpay3-presets.ts"),
    read("../app/api/billing/crypto/smartpay/options/route.ts"),
    read("../components/CryptoCheckout.tsx"),
    read("../lib/smartlingo-smartpay-claim.ts"),
    read("../lib/course-package-purchase.ts"),
    read("../app/api/billing/crypto/smartpay/records/route.ts"),
    read("../app/api/billing/status/route.ts"),
  ]);
  for (const marker of ["smartpay3_contract", "smartpay3_usdt_percent", "smartpay3_payment_claims", "smartpay_source_publications"]) {
    assert.match(migration, new RegExp(marker));
  }
  assert.match(admin, /Deploy or import contract/);
  assert.match(admin, /W1–W5/);
  assert.match(settings, /isPermanentAdmin/);
  assert.match(settings, /crypto_payment_admin_audit/);
  assert.match(settings, /2000,10000,30000/);
  assert.doesNotMatch(settings, /basic_amount_cents=3000/);
  assert.match(presets, /cryptoSubscriptionRuleIds/);
  assert.match(presets, /months: 3/);
  assert.match(presets, /chainId !== 137/);
  assert.doesNotMatch(presets, /for \(const languageCode|LANGUAGES|classId/);
  assert.match(optionsRoute, /isSmartLingoCommunityLanguage/);
  assert.match(optionsRoute, /currentSmartPayCheckoutOptions\(undefined, language\)/);
  assert.match(checkout, /smartpay\/options\?language=\$\{encodeURIComponent\(initialLanguageCode\)\}/);
  assert.match(claim, /record\.secondId/);
  assert.match(claim, /fixedCourseId\(languageCode, plan\)/);
  assert.match(claim, /recordCoursePackagePurchase/);
  assert.match(purchase, /INSERT INTO smartlingo_course_subscriptions/);
  assert.match(purchase, /INSERT INTO smartlingo_language_class_members/);
  assert.match(purchase, /addCourseSubscriptionMonths/);
  for (const packageId of ["basic_3m", "basic_6m", "basic_12m", "intermediate_3m", "intermediate_6m", "intermediate_12m", "advanced_3m", "advanced_6m", "advanced_12m"]) assert.match(packageMigration, new RegExp(packageId));
  for (const tokenAmount of ["'30'", "'60'", "'120'", "'30000000'", "'60000000'", "'120000000'"]) assert.match(packageMigration, new RegExp(tokenAmount));
  assert.match(records, /smartPay3LatestTransactions/);
  assert.match(status, /smartpay3_payment_claims/);
  for (const source of [migration, packageMigration, admin, settings, presets, optionsRoute, checkout, claim, purchase, records, status]) {
    assert.doesNotMatch(source, /SmartMeeting|smartmeeting\.club|SmartAICert/);
  }
});
