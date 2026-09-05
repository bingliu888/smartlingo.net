import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { COURSE_SUBSCRIPTION_WINDOW_CTES } from "../lib/course-subscription-window.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("SmartLingo authorizes through the current Clerk session and expires compatibility cookies", async () => {
  const [auth, logout] = await Promise.all([
    read("../lib/auth.ts"),
    read("../app/api/auth/logout/route.ts"),
  ]);
  assert.match(auth, /const clerkUser = await currentUser\(\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(auth, /SESSION_SECONDS|FROM sessions|INSERT INTO sessions/);
  assert.match(auth, /return `\$\{COOKIE_NAME\}=;[^`]*Max-Age=0`/);
  assert.match(logout, /clearSessionCookie\(\)/);
});

test("course prices, public catalog, and language or course-scoped wallet checkout stay aligned", async () => {
  const [packages, pricing, footer, checkout, catalog, languageCrypto, actions, card, verify] = await Promise.all([
    read("../lib/smartlingo-course-packages.ts"),
    read("../app/[lang]/pricing/page.tsx"),
    read("../components/SiteFooter.tsx"),
    read("../components/CryptoCheckout.tsx"),
    read("../components/LanguageSubscriptionCatalog.tsx"),
    read("../app/[lang]/programs/[language]/pay/crypto/page.tsx"),
    read("../components/CoursePaymentActions.tsx"),
    read("../app/api/billing/card/checkout/route.ts"),
    read("../app/api/billing/crypto/verify/route.ts"),
  ]);
  for (const marker of ["3_000", "5_000", "8_000", "6_000", "10_000", "16_000", "12_000", "20_000", "32_000", "Beginner", "初期课程"]) assert.match(packages, new RegExp(marker));
  assert.match(footer, /\/programs/);
  assert.doesNotMatch(footer, /\/pricing/);
  assert.match(pricing, /redirect\(`\/\$\{lang\}\/programs`\)/);
  for (const marker of [
    "Connect wallet", "connectEvmWallet", "SMARTPAY5_ABI", "prepared.refId",
    "eth_sendTransaction", "Refresh balances & gas", "Transaction hash", "lockedCourseId",
  ]) assert.ok(checkout.includes(marker), `missing ${marker}`);
  assert.match(checkout, /activeCourseId = selectedOption\?\.classId/);
  assert.match(checkout, /smartPayOptionsForLanguage/);
  assert.match(catalog, /Use crypto payment/);
  assert.match(catalog, /billing\/card\/checkout/);
  assert.match(languageCrypto, /CryptoCheckout/);
  assert.doesNotMatch(checkout, /GreatLoveAutoSwapOnboard|greatlove-onboard|WalletConnect QR|@walletconnect\/ethereum-provider/);
  assert.match(actions, /Pay once by card/);
  assert.match(actions, /Pay 3 months with Polygon USDT or GLC/);
  assert.match(actions, /classes\/\$\{encodeURIComponent\(classId\)\}\/pay\/crypto/);
  assert.match(verify, /claimSmartLingoCoursePayment/);
  assert.match(verify, /classId:\s*String\(body(?:\?)?\.classId/);
  assert.match(card, /mode: "payment"/);
  assert.match(card, /metadata\[class_id\]/);
  assert.match(card, /metadata\[target_language\]/);
  assert.match(card, /metadata\[duration_months\]/);
  assert.doesNotMatch(card, /trial_period_days|mode: "subscription"/);
  assert.doesNotMatch(`${checkout}\n${card}`, /SmartAICert|SmartMeeting|smartmeeting\.club/);
});

test("site-isolated rails grant only the selected language and three-month crypto package", async () => {
  const [migration, packageMigration, admin, settings, presets, checkoutServer, optionsRoute, checkout, claim, claimRoute, findPayment, verify, purchase, records, status, accountLookup, verification] = await Promise.all([
    Promise.all([read("../drizzle/0172_smartpay3_course_refid.sql"), read("../drizzle/0178_smartpay4_payer_identity.sql"), read("../drizzle/0179_smartpay5_fee_token_support.sql")]).then(parts => parts.join("\n")),
    read("../drizzle/0173_course_subscription_packages.sql"),
    read("../components/SmartPayAdminConsole.tsx"),
    read("../app/api/admin/crypto-settings/route.ts"),
    read("../lib/smartpay5-presets.ts"),
    read("../lib/smartpay-checkout-server.ts"),
    read("../app/api/billing/crypto/smartpay/options/route.ts"),
    read("../components/CryptoCheckout.tsx"),
    read("../lib/smartlingo-smartpay-claim.ts"),
    read("../app/api/billing/crypto/smartpay/claim/route.ts"),
    read("../app/api/billing/crypto/find-payment/route.ts"),
    read("../app/api/billing/crypto/verify/route.ts"),
    read("../lib/course-package-purchase.ts"),
    read("../app/api/billing/crypto/smartpay/records/route.ts"),
    read("../app/api/billing/status/route.ts"),
    read("../components/SmartPayAccountLookup.tsx"),
    read("../lib/crypto-payment-verification.ts"),
  ]);
  for (const marker of ["smartpay5_contract", "smartpay5_usdt_percent", "smartpay5_payment_claims", "smartpay_source_publications"]) {
    assert.match(migration, new RegExp(marker));
  }
  assert.match(admin, /Deploy or import contract/);
  assert.match(admin, /W1–W5/);
  assert.match(settings, /isPermanentAdmin/);
  assert.match(settings, /crypto_payment_admin_audit/);
  assert.match(settings, /2000,10000,30000/);
  assert.doesNotMatch(settings, /basic_amount_cents=3000/);
  assert.match(presets, /cryptoSubscriptionRuleIds/);
  assert.match(checkoutServer, /smartPay5SettingsForContract/);
  assert.match(checkoutServer, /smartPay5SettingsForContract\(settings, scope\.chainId, contractAddress\)/);
  assert.match(presets, /months: 3/);
  assert.match(presets, /chainId !== 137/);
  assert.doesNotMatch(presets, /for \(const languageCode|LANGUAGES|classId/);
  assert.match(optionsRoute, /isSmartLingoCommunityLanguage/);
  assert.match(optionsRoute, /currentSmartPayCheckoutOptions\(undefined, language\)/);
  assert.match(checkout, /smartpay\/options\?language=\$\{encodeURIComponent\(initialLanguageCode\)\}/);
  assert.match(claim, /record\.secondId/);
  assert.match(claim, /fixedCourseId\(languageCode, plan\)/);
  assert.match(claim, /recordCoursePackagePurchase/);
  assert.match(claim, /smartPay5SettingsForContract/);
  assert.doesNotMatch(claim, /PAYMENT_AMOUNT_MISMATCH|primaryTokenAmount\s*[!=]==?|secondaryTokenAmount\s*[!=]==?/);
  assert.doesNotMatch(claim, /record\.wallet.*(?:actor|target|profile)|wallet_address/);
  assert.match(claimRoute, /transactionId: String\(body\.paymentId \|\| ""\)/);
  assert.doesNotMatch(claimRoute, /body\.(?:txHash|transactionId)/);
  assert.doesNotMatch(claimRoute, /emailVerified/);
  assert.match(findPayment, /boundedJsonBody/);
  assert.match(findPayment, /consumeAccountRequestLimit/);
  assert.match(findPayment, /getTransactionsByPayerID|payerId,/);
  assert.match(findPayment, /record\.primaryTokenAddress\.toLowerCase\(\) === option\.smartPay5Offer\.primaryTokenAddress\.toLowerCase\(\)/);
  assert.match(findPayment, /record\.secondaryTokenAddress\.toLowerCase\(\) === option\.smartPay5Offer\.secondaryTokenAddress\.toLowerCase\(\)/);
  assert.doesNotMatch(findPayment, /record\.(?:primary|secondary)TokenAmount\s*[!=]==?/);
  assert.doesNotMatch(findPayment, /txHash:\s*record\.transactionId/);
  assert.match(verify, /smartPay5TransactionIdFromReceipt/);
  assert.doesNotMatch(verify, /emailVerified/);
  assert.match(verification, /Math\.min\(4, Math\.max\(1, requestedAttempts\)\)/);
  assert.match(purchase, /INSERT INTO smartlingo_course_subscriptions/);
  assert.match(purchase, /INSERT INTO smartlingo_language_class_members/);
  assert.match(purchase, /COURSE_SUBSCRIPTION_WINDOW_CTES/);
  for (const packageId of ["basic_3m", "basic_6m", "basic_12m", "intermediate_3m", "intermediate_6m", "intermediate_12m", "advanced_3m", "advanced_6m", "advanced_12m"]) assert.match(packageMigration, new RegExp(packageId));
  for (const tokenAmount of ["'30'", "'60'", "'120'", "'30000000'", "'60000000'", "'120000000'"]) assert.match(packageMigration, new RegExp(tokenAmount));
  assert.match(records, /smartPay5LatestTransactions/);
  assert.match(records, /payerId:/);
  assert.doesNotMatch(records, /wallet_address AS wallet|Save a payer wallet/);
  assert.match(status, /smartpay5_payment_claims/);
  assert.match(status, /transaction_id AS paymentId/);
  assert.doesNotMatch(status, /transaction_id AS txHash/);
  assert.match(accountLookup, /cryptoSubscriptionPlanForIds\(row\.mainId,row\.secondId\)/);
  assert.match(accountLookup, /fixedCourseId\(row\.secondId,plan\)/);
  assert.doesNotMatch(accountLookup, /classId:row\.secondId/);
  for (const source of [migration, packageMigration, admin, settings, presets, checkoutServer, optionsRoute, checkout, claim, claimRoute, findPayment, verify, purchase, records, status, accountLookup, verification]) {
    assert.doesNotMatch(source, /SmartMeeting|smartmeeting\.club|SmartAICert/);
  }
});

test("course purchases derive and stack calendar-month access inside the atomic D1 write", async () => {
  const purchase = await read("../lib/course-package-purchase.ts");
  assert.match(purchase, /COURSE_SUBSCRIPTION_WINDOW_CTES/);
  assert.match(purchase, /purchase\.access_ends_at/);
  assert.match(purchase, /database\.batch\(statements\)/);

  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE smartlingo_course_subscriptions(
    class_id TEXT,user_id TEXT,trial_ends_at INTEGER,current_period_ends_at INTEGER,
    UNIQUE(class_id,user_id)
  );
  CREATE TABLE smartlingo_course_package_purchases(
    provider TEXT,provider_reference TEXT UNIQUE,access_starts_at INTEGER,access_ends_at INTEGER
  )`);
  const january31 = Date.UTC(2024, 0, 31, 10, 20, 30) / 1000;
  const classId = "course_es_basic";
  const userId = "member-1";
  database.prepare("INSERT INTO smartlingo_course_subscriptions VALUES(?,?,NULL,?)").run(classId, userId, january31);
  const recordPayment = reference => {
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`WITH ${COURSE_SUBSCRIPTION_WINDOW_CTES}
        INSERT INTO smartlingo_course_package_purchases(provider,provider_reference,access_starts_at,access_ends_at)
        SELECT 'smartpay5',?,start_at,access_ends_at FROM access_window`)
        .run(january31 - 100, classId, userId, 3, reference);
      database.prepare(`UPDATE smartlingo_course_subscriptions SET current_period_ends_at=(
        SELECT access_ends_at FROM smartlingo_course_package_purchases
        WHERE provider='smartpay5' AND provider_reference=?
      ) WHERE class_id=? AND user_id=?`).run(reference, classId, userId);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  };
  recordPayment("payment-1");
  recordPayment("payment-2");
  const windows = database.prepare(`SELECT access_starts_at AS startAt,access_ends_at AS accessEndsAt
    FROM smartlingo_course_package_purchases ORDER BY provider_reference`).all()
    .map(({ startAt, accessEndsAt }) => ({ startAt, accessEndsAt }));
  const april30 = Date.UTC(2024, 3, 30, 10, 20, 30) / 1000;
  const july30 = Date.UTC(2024, 6, 30, 10, 20, 30) / 1000;
  assert.deepEqual(windows, [
    { startAt: january31, accessEndsAt: april30 },
    { startAt: april30, accessEndsAt: july30 },
  ]);
  database.close();
});
