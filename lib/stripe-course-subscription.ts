import { getDatabase } from "./auth";
import {
  readBoundedExternalResponseText,
  STRIPE_REQUEST_TIMEOUT_MS,
  withExternalRequestTimeout,
} from "./external-request-timeout";

export type StripeSubscription = {
  id: string;
  status: string;
  trial_start?: number | null;
  trial_end?: number | null;
  current_period_end?: number | null;
  metadata?: { class_id?: string; user_id?: string; cadence?: string; scope?: string };
};

export async function runtimeValue(name: string) {
  const { env } = await import("cloudflare:workers");
  return String((env as unknown as Record<string, string | undefined>)[name] || "").trim();
}

export async function stripeRequest<T>(path: string, init?: RequestInit) {
  const secret = await runtimeValue("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const { response, raw } = await withExternalRequestTimeout(async (signal) => {
    const response = await fetch(`https://api.stripe.com/v1${path}`, {
      ...init,
      signal,
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/x-www-form-urlencoded", ...init?.headers },
    });
    const raw = await readBoundedExternalResponseText(response, 256 * 1024);
    return { response, raw };
  }, STRIPE_REQUEST_TIMEOUT_MS);
  if (raw.truncated) throw new Error("STRIPE_RESPONSE_TOO_LARGE");
  let data = {} as T & { error?: { message?: string } };
  try { data = JSON.parse(raw.text) as typeof data; } catch { /* invalid upstream JSON */ }
  if (!response.ok) throw new Error(data.error?.message || "STRIPE_REQUEST_FAILED");
  return data;
}

export async function syncStripeCourseSubscription(userId: string, classId: string, subscription: StripeSubscription) {
  if (subscription.metadata?.user_id !== userId || subscription.metadata?.class_id !== classId) throw new Error("STRIPE_SCOPE_MISMATCH");
  const database = getDatabase();
  const course = await database.prepare("SELECT price_cents AS priceCents FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' LIMIT 1").bind(classId).first<{ priceCents: number }>();
  if (!course) throw new Error("COURSE_NOT_FOUND");
  const now = Math.floor(Date.now() / 1000);
  const status = subscription.status === "trialing" ? "trialing" : subscription.status === "active" ? "active" : subscription.status === "past_due" || subscription.status === "unpaid" ? "past_due" : "cancelled";
  const trialStartedAt = Number(subscription.trial_start || now);
  const trialEndsAt = Number(subscription.trial_end || trialStartedAt);
  const currentPeriodEndsAt = Number(subscription.current_period_end || subscription.trial_end || now);
  const memberStatus = status === "trialing" || status === "active" ? "active" : "paused";
  await database.batch([
    database.prepare(`INSERT INTO smartlingo_course_subscriptions
      (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,provider_subscription_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(class_id,user_id) DO UPDATE SET status=excluded.status,monthly_price_cents=excluded.monthly_price_cents,
      trial_started_at=excluded.trial_started_at,trial_ends_at=excluded.trial_ends_at,current_period_ends_at=excluded.current_period_ends_at,
      provider_subscription_id=excluded.provider_subscription_id,updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(), classId, userId, status, course.priceCents, trialStartedAt, trialEndsAt, currentPeriodEndsAt, subscription.id, now, now),
    database.prepare(`INSERT INTO smartlingo_language_class_members(id,class_id,user_id,role,status,joined_at,updated_at)
      VALUES(?,?,?,'student',?,?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status=excluded.status,updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(), classId, userId, memberStatus, now, now),
  ]);
  return { status, trialEndsAt, currentPeriodEndsAt };
}
