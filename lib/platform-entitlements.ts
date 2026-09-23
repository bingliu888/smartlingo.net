import { getDatabase, type SessionUser } from "./auth";
import { isAdminUser, isPermanentAdmin } from "./admin-access";
import { addAigcCredits } from "./aigc-credits";
import { platformProduct, type SmartLingoPlatformProductId } from "./platform-commerce";

export type SmartLingoCourseTier = "basic" | "intermediate" | "advanced";
export const MAX_TRIAL_SECONDS = 7 * 24 * 60 * 60;

function addUtcMonths(startSeconds: number, months: number) {
  const date = new Date(startSeconds * 1_000);
  date.setUTCMonth(date.getUTCMonth() + months);
  return Math.floor(date.getTime() / 1_000);
}

export class AdminMaxSubscriptionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Admin and paid Max share the canonical subscriptions row; only real payments enter the payment ledger. */
export async function changeAdminMaxSubscription(input: {
  actor: SessionUser;
  userId: string;
  action: "grant" | "revoke";
  months?: 6 | 12;
  requestId: string;
  now?: number;
}) {
  if (!isPermanentAdmin(input.actor)) throw new AdminMaxSubscriptionError(403, "Administrator access required");
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId)
    || !["grant", "revoke"].includes(input.action)
    || (input.action === "grant" && input.months !== 6 && input.months !== 12)) {
    throw new AdminMaxSubscriptionError(400, "Invalid Max subscription request");
  }
  const database = getDatabase();
  const now = input.now ?? Math.floor(Date.now() / 1_000);
  const action = `max.${input.action}`;
  const replay = await database.prepare("SELECT admin_user_id AS adminId,target_user_id AS targetId,action FROM platform_admin_audit WHERE id=? LIMIT 1")
    .bind(input.requestId).first<{ adminId: string; targetId: string; action: string }>();
  if (replay) {
    if (replay.adminId !== input.actor.id || replay.targetId !== input.userId || replay.action !== action) {
      throw new AdminMaxSubscriptionError(409, "Request already used");
    }
    const row = await database.prepare("SELECT current_period_ends_at AS expiresAt FROM subscriptions WHERE user_id=? LIMIT 1")
      .bind(input.userId).first<{ expiresAt: number | null }>();
    return { changed: false, expiresAt: Number(row?.expiresAt || 0) || null };
  }
  const current = await database.prepare(`SELECT cadence,status,trial_ends_at AS trialEndsAt,
    current_period_ends_at AS expiresAt FROM subscriptions WHERE user_id=? LIMIT 1`)
    .bind(input.userId).first<{ cadence: string; status: string; trialEndsAt: number | null; expiresAt: number | null }>();
  if (input.action === "grant") {
    const trialOnly = Number(current?.trialEndsAt || 0) > 0
      && Number(current?.trialEndsAt || 0) === Number(current?.expiresAt || 0);
    const base = trialOnly ? now : Math.max(now, Number(current?.expiresAt || 0));
    const expiresAt = addUtcMonths(base, input.months!);
    await database.batch([
      database.prepare(`INSERT INTO subscriptions
        (id,user_id,cadence,status,current_period_ends_at,cancel_at_period_end,created_at,updated_at)
        VALUES(?,?,'max','active',?,1,?,?)
        ON CONFLICT(user_id) DO UPDATE SET cadence='max',status='active',current_period_ends_at=excluded.current_period_ends_at,
          cancel_at_period_end=1,updated_at=excluded.updated_at`)
        .bind(crypto.randomUUID(), input.userId, expiresAt, now, now),
      database.prepare(`INSERT INTO platform_member_access
        (user_id,status,subscriber_override,updated_by_user_id,created_at,updated_at)
        VALUES(?,'active',1,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET status='active',subscriber_override=1,
          updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`)
        .bind(input.userId, input.actor.id, now, now),
      database.prepare("INSERT INTO platform_admin_audit(id,admin_user_id,target_user_id,action,created_at) VALUES(?,?,?,?,?)")
        .bind(input.requestId, input.actor.id, input.userId, action, now),
    ]);
    return { changed: true, expiresAt };
  }
  const access = await database.prepare("SELECT subscriber_override AS subscriberOverride FROM platform_member_access WHERE user_id=? LIMIT 1")
    .bind(input.userId).first<{ subscriberOverride: number }>();
  if (access?.subscriberOverride !== 1 || current?.cadence !== "max" || current.status !== "active") {
    throw new AdminMaxSubscriptionError(409, "No active admin-granted Max subscription");
  }
  const paid = await database.prepare("SELECT 1 AS paid FROM smartlingo_platform_subscription_payments WHERE subscriber_user_id=? AND status='paid' LIMIT 1")
    .bind(input.userId).first<{ paid: number }>();
  if (paid) throw new AdminMaxSubscriptionError(409, "Paid Max access cannot be revoked here");
  await database.batch([
    database.prepare("UPDATE subscriptions SET status='cancelled',current_period_ends_at=?,updated_at=? WHERE user_id=?")
      .bind(now, now, input.userId),
    database.prepare("UPDATE platform_member_access SET subscriber_override=-1,updated_by_user_id=?,updated_at=? WHERE user_id=?")
      .bind(input.actor.id, now, input.userId),
    database.prepare("INSERT INTO platform_admin_audit(id,admin_user_id,target_user_id,action,created_at) VALUES(?,?,?,?,?)")
      .bind(input.requestId, input.actor.id, input.userId, action, now),
  ]);
  return { changed: true, expiresAt: now };
}

export async function hasActiveMaxSubscription(userId: string, now = Math.floor(Date.now() / 1_000)) {
  const row = await getDatabase().prepare(`SELECT 1 AS active FROM subscriptions
    WHERE user_id=? AND cadence='max' AND status='active' AND current_period_ends_at>? LIMIT 1`)
    .bind(userId, now).first<{ active: number }>();
  return Boolean(row?.active);
}

export async function hasMaxCourseAccess(user: SessionUser | null) {
  if (!user) return false;
  return await isAdminUser(user) || await hasActiveMaxSubscription(user.id);
}

export async function ensureSevenDayMaxTrial(userId: string, now = Math.floor(Date.now() / 1_000)) {
  const database = getDatabase();
  const current = await database.prepare(`SELECT cadence,status,trial_ends_at AS trialEndsAt,
    current_period_ends_at AS currentPeriodEndsAt FROM subscriptions WHERE user_id=? LIMIT 1`)
    .bind(userId).first<{ cadence: string; status: string; trialEndsAt: number | null; currentPeriodEndsAt: number | null }>();
  if (current?.cadence === "max" && current.status === "active" && Number(current.currentPeriodEndsAt || 0) > now) {
    return { active: true, trialStarted: false, trialEndsAt: current.trialEndsAt };
  }
  if (current?.trialEndsAt != null) return { active: false, trialStarted: false, trialEndsAt: current.trialEndsAt };

  const trialEndsAt = now + MAX_TRIAL_SECONDS;
  await database.prepare(`INSERT INTO subscriptions
    (id,user_id,cadence,status,trial_ends_at,current_period_ends_at,cancel_at_period_end,created_at,updated_at)
    VALUES(?,?,'max','active',?,?,1,?,?)
    ON CONFLICT(user_id) DO UPDATE SET cadence='max',status='active',trial_ends_at=excluded.trial_ends_at,
      current_period_ends_at=excluded.current_period_ends_at,cancel_at_period_end=1,updated_at=excluded.updated_at
    WHERE subscriptions.trial_ends_at IS NULL
      AND NOT (subscriptions.cadence='max' AND subscriptions.status='active' AND subscriptions.current_period_ends_at>?)`)
    .bind(crypto.randomUUID(), userId, trialEndsAt, trialEndsAt, now, now, now).run();
  const granted = await database.prepare(`SELECT trial_ends_at AS trialEndsAt,current_period_ends_at AS currentPeriodEndsAt,
    cadence,status FROM subscriptions WHERE user_id=? LIMIT 1`).bind(userId)
    .first<{ trialEndsAt: number | null; currentPeriodEndsAt: number | null; cadence: string; status: string }>();
  const active = granted?.cadence === "max" && granted.status === "active" && Number(granted.currentPeriodEndsAt || 0) > now;
  return { active, trialStarted: active && Number(granted?.trialEndsAt || 0) === trialEndsAt, trialEndsAt: granted?.trialEndsAt ?? null };
}

export async function hasCourseTierAccess(
  user: SessionUser | null,
  tier: SmartLingoCourseTier | null,
  options: { startMaxTrial?: boolean } = {},
) {
  if (!user) return { allowed: false, maxActive: false, trialStarted: false, trialEndsAt: null as number | null };
  if (await isAdminUser(user)) return { allowed: true, maxActive: true, trialStarted: false, trialEndsAt: null as number | null };
  if (tier === "basic") return { allowed: true, maxActive: await hasActiveMaxSubscription(user.id), trialStarted: false, trialEndsAt: null as number | null };
  if (await hasActiveMaxSubscription(user.id)) return { allowed: true, maxActive: true, trialStarted: false, trialEndsAt: null as number | null };
  if (!options.startMaxTrial) return { allowed: false, maxActive: false, trialStarted: false, trialEndsAt: null as number | null };
  const trial = await ensureSevenDayMaxTrial(user.id);
  return { allowed: trial.active, maxActive: trial.active, trialStarted: trial.trialStarted, trialEndsAt: trial.trialEndsAt };
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
