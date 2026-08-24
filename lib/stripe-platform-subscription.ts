import { createId, getDatabase } from "./auth";
import { stripeRequest, type StripeSubscription } from "./stripe-course-subscription";

export const COLLEGE_COORDINATOR_MONTHLY_CENTS = 10_000;

type PlatformStripeSubscription = StripeSubscription & {
  customer?: string | { id?: string } | null;
  cancel_at_period_end?: boolean;
  metadata?: { user_id?: string; cadence?: string; scope?: string };
};

export async function syncStripePlatformSubscription(userId: string, subscription: PlatformStripeSubscription) {
  if (subscription.metadata?.user_id !== userId || subscription.metadata?.cadence !== "coordinator" || subscription.metadata?.scope !== "platform") throw new Error("STRIPE_SCOPE_MISMATCH");
  const now = Math.floor(Date.now() / 1000);
  const status = subscription.status === "trialing" ? "trialing" : subscription.status === "active" ? "active" : subscription.status === "past_due" || subscription.status === "unpaid" ? "past_due" : "cancelled";
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null;
  const currentPeriodEndsAt = Number(subscription.current_period_end || now);
  await getDatabase().prepare(`INSERT INTO subscriptions
    (id,user_id,cadence,status,current_period_ends_at,cancel_at_period_end,stripe_subscription_id,stripe_customer_id,created_at,updated_at)
    VALUES(?,?,'coordinator',?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET cadence='coordinator',status=excluded.status,
      current_period_ends_at=excluded.current_period_ends_at,cancel_at_period_end=excluded.cancel_at_period_end,
      stripe_subscription_id=excluded.stripe_subscription_id,stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at`)
    .bind(createId(), userId, status, currentPeriodEndsAt, subscription.cancel_at_period_end ? 1 : 0, subscription.id, customerId, now, now).run();
  return { status, currentPeriodEndsAt };
}

export async function loadPlatformStripeSubscription(subscriptionId: string) {
  return stripeRequest<PlatformStripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}
