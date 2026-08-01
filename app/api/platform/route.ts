import { and, desc, eq, sum } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  lingoIntroducerRewardLedger,
  lingoPlatformSubscriptionPayments,
  notificationPreferences,
  referralCodes,
  referrals,
  subscriptions,
  users,
} from "../../../db/schema";
import { createId } from "../../../lib/auth";
import { requestUser } from "../../../lib/request-user";

function newReferralCode() {
  return `SL${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

async function ensureReferralCode(userId: string) {
  const db = getDb();
  const [existing] = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
  if (existing) return existing;
  const now = Math.floor(Date.now() / 1000);
  await db.insert(referralCodes).values({ id: createId(), userId, code: newReferralCode(), createdAt: now }).onConflictDoNothing();
  const [created] = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
  if (!created) throw new Error("Unable to create referral code");
  return created;
}

export async function GET(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const db = getDb();
  const referralCode = await ensureReferralCode(user.id);
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);
  const [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, user.id)).limit(1);
  const [points] = await db.select({ value: sum(lingoIntroducerRewardLedger.points) })
    .from(lingoIntroducerRewardLedger)
    .where(and(
      eq(lingoIntroducerRewardLedger.introducerUserId, user.id),
      eq(lingoIntroducerRewardLedger.status, "earned"),
    ));
  const joined = await db.select({
    id: users.id,
    displayName: users.displayName,
    status: referrals.status,
    joinedAt: referrals.createdAt,
    memberSince: users.createdAt,
  }).from(referrals)
    .innerJoin(users, eq(referrals.referredUserId, users.id))
    .where(eq(referrals.referralCodeId, referralCode.id))
    .orderBy(desc(referrals.createdAt))
    .limit(50);
  const rewardHistory = await db.select({
    id: lingoIntroducerRewardLedger.id,
    points: lingoIntroducerRewardLedger.points,
    status: lingoIntroducerRewardLedger.status,
    createdAt: lingoIntroducerRewardLedger.createdAt,
    paymentId: lingoIntroducerRewardLedger.subscriptionPaymentId,
    paidAt: lingoPlatformSubscriptionPayments.paidAt,
  }).from(lingoIntroducerRewardLedger)
    .innerJoin(
      lingoPlatformSubscriptionPayments,
      eq(lingoIntroducerRewardLedger.subscriptionPaymentId, lingoPlatformSubscriptionPayments.id),
    )
    .where(eq(lingoIntroducerRewardLedger.introducerUserId, user.id))
    .orderBy(desc(lingoIntroducerRewardLedger.createdAt))
    .limit(50);
  const origin = new URL(request.url).origin;
  return Response.json({
    subscription: subscription ?? null,
    referral: {
      code: referralCode.code,
      url: `${origin}/r/${referralCode.code}?lang=${user.preferredLanguage}`,
      joined,
      count: joined.length,
    },
    points: Number(points.value ?? 0),
    rewardHistory,
    rewardRule: "platform_subscription_invoice_paid_only",
    classPaymentsCreateIntroducerPoints: false,
    notifications: preference ?? {
      language: user.preferredLanguage,
      marketingEmail: false,
      productEmail: true,
      reminderEmail: true,
    },
  });
}

export async function POST(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const payload = await request.json() as {
    action?: string;
    language?: string;
    marketingEmail?: boolean;
    productEmail?: boolean;
    reminderEmail?: boolean;
  };
  if (payload.action) {
    return Response.json({ error: "Reward points cannot be transferred or created by a client action" }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  const values = {
    userId: user.id,
    language: payload.language === "en" ? "en" : "zh",
    marketingEmail: Boolean(payload.marketingEmail),
    productEmail: payload.productEmail !== false,
    reminderEmail: payload.reminderEmail !== false,
    updatedAt: now,
  };
  await getDb().insert(notificationPreferences).values(values).onConflictDoUpdate({
    target: notificationPreferences.userId,
    set: values,
  });
  return Response.json({ ok: true, notifications: values });
}
