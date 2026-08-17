import { getDatabase, getSessionUser } from "@/lib/auth";
import { stripeRequest } from "@/lib/stripe-course-subscription";

type Course = { id: string; title: string; priceCents: number; packageTier: string; targetLanguage: string; trialDays: number };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { classId?: string; lang?: string } | null;
  const classId = String(body?.classId || "");
  const lang = body?.lang === "zh" ? "zh" : "en";
  const database = getDatabase();
  const course = await database.prepare(`SELECT id,title,price_cents AS priceCents,package_tier AS packageTier,target_language AS targetLanguage,trial_days AS trialDays
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' AND visibility='public' LIMIT 1`)
    .bind(classId).first<Course>();
  if (!course || !["basic", "intermediate", "advanced"].includes(course.packageTier)) return Response.json({ error: "Course not found" }, { status: 404 });
  const existing = await database.prepare("SELECT id FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=? LIMIT 1").bind(classId, user.id).first();
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: "subscription",
    success_url: `${origin}/${lang}/classes/${encodeURIComponent(classId)}/pay/card/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${lang}/classes/${encodeURIComponent(classId)}`,
    client_reference_id: user.id,
    customer_email: user.email,
    payment_method_collection: "always",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(course.priceCents),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": course.title,
    "metadata[class_id]": classId,
    "metadata[user_id]": user.id,
    "metadata[package_tier]": course.packageTier,
    "metadata[target_language]": course.targetLanguage,
    "subscription_data[metadata][class_id]": classId,
    "subscription_data[metadata][user_id]": user.id,
  });
  if (!existing) form.set("subscription_data[trial_period_days]", String(course.trialDays));
  try {
    const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", { method: "POST", body: form });
    return Response.json({ url: session.url, sessionId: session.id, firstMonthFree: !existing });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to start credit-card checkout" }, { status: unavailable ? 503 : 502 });
  }
}
