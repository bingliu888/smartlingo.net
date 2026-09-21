import { getDatabase } from "./auth";
import { addAigcCredits } from "./aigc-credits";
import { platformProduct, type SmartLingoPlatformProductId } from "./platform-commerce";

function addUtcMonths(startSeconds: number, months: number) {
  const date = new Date(startSeconds * 1_000);
  date.setUTCMonth(date.getUTCMonth() + months);
  return Math.floor(date.getTime() / 1_000);
}

export async function fulfillPlatformProduct(input: {
  userId: string;
  productId: SmartLingoPlatformProductId;
  provider: "stripe" | "smartpay5";
  providerReference: string;
  amountCents: number;
  paidAt?: number;
  checkoutIntentId?: string | null;
}) {
  const product = platformProduct(input.productId);
  if (!product || product.usdCents !== input.amountCents) throw new Error("PLATFORM_PRODUCT_MISMATCH");
  const database = getDatabase();
  const paidAt = input.paidAt || Math.floor(Date.now() / 1_000);
  if (product.kind === "aigc") {
    const balance = await addAigcCredits({
      userId: input.userId,
      credits: product.credits,
      reason: `${input.provider}_purchase`,
      providerReference: `${input.provider}:${input.providerReference}`,
      metadata: { productId: product.id, amountCents: product.usdCents },
      now: paidAt,
    });
    if (input.checkoutIntentId) await database.prepare("UPDATE smartlingo_platform_checkout_intents SET status='paid',updated_at=? WHERE id=? AND user_id=?")
      .bind(paidAt, input.checkoutIntentId, input.userId).run();
    return { productId: product.id, credits: product.credits, balance, currentPeriodEnd: null };
  }

  const existingPayment = await database.prepare("SELECT id FROM smartlingo_platform_subscription_payments WHERE provider_invoice_id=? LIMIT 1")
    .bind(`${input.provider}:${input.providerReference}`).first<{ id: string }>();
  const current = await database.prepare("SELECT current_period_ends_at AS currentPeriodEnd FROM subscriptions WHERE user_id=? LIMIT 1")
    .bind(input.userId).first<{ currentPeriodEnd: number | null }>();
  if (existingPayment) {
    return { productId: product.id, credits: 0, balance: null, currentPeriodEnd: Number(current?.currentPeriodEnd || 0) || null };
  }
  const referral = await database.prepare(`SELECT referral.id AS referralId,code.user_id AS introducerUserId
    FROM referrals referral JOIN referral_codes code ON code.id=referral.referral_code_id
    WHERE referral.referred_user_id=? AND referral.status='active' ORDER BY referral.created_at ASC LIMIT 1`)
    .bind(input.userId).first<{ referralId: string; introducerUserId: string }>();
  const base = Math.max(paidAt, Number(current?.currentPeriodEnd || 0));
  const currentPeriodEnd = addUtcMonths(base, product.months);
  const paymentId = crypto.randomUUID();
  await database.batch([
    database.prepare(`INSERT INTO smartlingo_platform_subscription_payments
      (id,provider_invoice_id,subscriber_user_id,introducer_user_id,direct_referral_id,amount_cents,currency,status,paid_at,created_at)
      VALUES(?,?,?,?,?,?,'USD','paid',?,?)`)
      .bind(paymentId, `${input.provider}:${input.providerReference}`, input.userId,
        referral?.introducerUserId || null, referral?.referralId || null, product.usdCents, paidAt, paidAt),
    database.prepare(`INSERT INTO subscriptions
      (id,user_id,cadence,status,current_period_ends_at,cancel_at_period_end,created_at,updated_at)
      VALUES(?,?,'max','active',?,1,?,?)
      ON CONFLICT(user_id) DO UPDATE SET cadence='max',status='active',current_period_ends_at=excluded.current_period_ends_at,
        cancel_at_period_end=1,updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(), input.userId, currentPeriodEnd, paidAt, paidAt),
    ...(input.checkoutIntentId ? [database.prepare("UPDATE smartlingo_platform_checkout_intents SET status='paid',updated_at=? WHERE id=? AND user_id=?")
      .bind(paidAt, input.checkoutIntentId, input.userId)] : []),
  ]);
  return { productId: product.id, credits: 0, balance: null, currentPeriodEnd };
}
