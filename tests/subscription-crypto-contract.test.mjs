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
  for (const marker of ["2_000", "10_000", "30_000", "Beginner", "初期课程"]) assert.match(packages, new RegExp(marker));
  assert.match(footer, /\/programs/);
  assert.doesNotMatch(footer, /\/pricing/);
  assert.match(pricing, /redirect\(`\/\$\{lang\}\/programs`\)/);
  for (const marker of [
    "Connect wallet", "connectEvmWallet", "SMARTPAY3_ABI", "prepared.refId",
    "eth_sendTransaction", "Refresh balances & gas", "Transaction hash", "lockedCourseId",
  ]) assert.ok(checkout.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(checkout, /GreatLoveAutoSwapOnboard|greatlove-onboard|WalletConnect QR|@walletconnect\/ethereum-provider/);
  assert.match(actions, /Pay by credit card/);
  assert.match(actions, /Connect wallet to pay crypto/);
  assert.match(actions, /classes\/\$\{encodeURIComponent\(classId\)\}\/pay\/crypto/);
  assert.match(verify, /claimSmartLingoCoursePayment/);
  assert.match(verify, /classId:String\(body\?\.classId/);
  assert.match(card, /mode: "subscription"/);
  assert.match(card, /trial_period_days/);
  assert.match(card, /metadata\[class_id\]/);
  assert.doesNotMatch(`${checkout}\n${card}`, /SmartAICert|SmartMeeting|smartmeeting\.club/);
});

test("site-isolated admin rails and SmartPay3 claims grant only the selected annual course", async () => {
  const [migration, admin, settings, presets, claim, stripe, records, status] = await Promise.all([
    read("../drizzle/0172_smartpay3_course_refid.sql"),
    read("../components/SmartPayAdminConsole.tsx"),
    read("../app/api/admin/crypto-settings/route.ts"),
    read("../lib/smartpay3-presets.ts"),
    read("../lib/smartlingo-smartpay-claim.ts"),
    read("../lib/stripe-course-subscription.ts"),
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
  assert.match(presets, /cryptoSubscriptionIdsForCourse/);
  assert.match(presets, /ANNUAL_MONTHS/);
  assert.match(claim, /INSERT INTO smartlingo_course_subscriptions/);
  assert.match(claim, /INSERT INTO smartlingo_language_class_members/);
  assert.match(claim, /periodStart \+ YEAR_SECONDS/);
  assert.match(records, /smartPay3LatestTransactions/);
  assert.match(status, /smartpay3_payment_claims/);
  assert.doesNotMatch(stripe, /INSERT INTO subscriptions/);
  for (const source of [migration, admin, settings, presets, claim, stripe, records, status]) {
    assert.doesNotMatch(source, /SmartMeeting|smartmeeting\.club|SmartAICert/);
  }
});
