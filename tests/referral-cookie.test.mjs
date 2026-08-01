import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

const authSource = await read("../lib/auth.ts");
const platformSource = await read("../app/api/platform/route.ts");
const logoutSource = await read("../app/api/auth/logout/route.ts");
const referralRouteSource = await read("../app/r/[code]/route.ts");
const bridgeSource = await read("../app/api/auth/clerk-session/route.ts");
const bridgeHandlerSource = await read("../lib/clerk-session-bridge.ts");

test("a validated platform referral survives sign-up in one secure cookie", () => {
  assert.match(referralRouteSource, /SELECT id FROM referral_codes WHERE code = \? LIMIT 1/);
  assert.match(referralRouteSource, /setReferralCookie\(normalized\)/);
  assert.match(referralRouteSource, /auth\/sign-up\?referral=recorded/);
  assert.match(referralRouteSource, /auth\/sign-up\?referral=invalid/);
  assert.match(authSource, /REFERRAL_COOKIE_NAME = "smartlingo_referral_code"/);
  assert.match(authSource, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(bridgeSource, /referralCodeFromRequest,/);
  assert.match(bridgeSource, /clearReferralCookie,/);
  assert.match(bridgeHandlerSource, /dependencies\.referralCodeFromRequest\(request\)/);
  assert.match(bridgeHandlerSource, /dependencies\.clearReferralCookie\(\)/);
  assert.match(logoutSource, /clearReferralCookie\(\)/);
});

test("first registration stores at most one direct introducer without awarding points", () => {
  assert.match(authSource, /claimPlatformReferral/);
  assert.match(authSource, /SELECT id, user_id AS userId FROM referral_codes WHERE code = \? LIMIT 1/);
  assert.match(authSource, /owner\.userId === referredUserId/);
  assert.match(authSource, /INSERT OR IGNORE INTO referrals/);
  assert.match(authSource, /'attributed', 0/);
  assert.doesNotMatch(authSource, /lingo_introducer_reward_ledger|smartlingo_bacc_ledger|qualified_referral/);
});

test("only verified platform-subscription payment records back introducer points", () => {
  assert.match(platformSource, /lingoIntroducerRewardLedger/);
  assert.match(platformSource, /lingoPlatformSubscriptionPayments/);
  assert.match(platformSource, /subscriptionPaymentId/);
  assert.match(platformSource, /rewardRule: "platform_subscription_invoice_paid_only"/);
  assert.match(platformSource, /classPaymentsCreateIntroducerPoints: false/);
  assert.match(platformSource, /Reward points cannot be transferred or created by a client action/);
  assert.doesNotMatch(platformSource, /community_tip|class_order|BACC|qualified_referral/);
});
