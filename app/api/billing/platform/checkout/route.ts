import { getSessionUser } from "@/lib/auth";
import { stripeRequest } from "@/lib/stripe-course-subscription";
import { COLLEGE_COORDINATOR_MONTHLY_CENTS } from "@/lib/stripe-platform-subscription";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { lang?: string } | null;
  const lang = body?.lang && ["zh","en","es","ja","ko","fr","de","ru","it","pt","ar","hi"].includes(body.lang) ? body.lang : "en";
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: "subscription",
    success_url: `${origin}/${lang}/colleges/mine/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${lang}/colleges/mine`,
    client_reference_id: user.id,
    customer_email: user.email,
    payment_method_collection: "always",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(COLLEGE_COORDINATOR_MONTHLY_CENTS),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": "SmartLingo College Coordinator",
    "metadata[user_id]": user.id,
    "metadata[cadence]": "coordinator",
    "metadata[scope]": "platform",
    "subscription_data[metadata][user_id]": user.id,
    "subscription_data[metadata][cadence]": "coordinator",
    "subscription_data[metadata][scope]": "platform",
  });
  try {
    const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", { method: "POST", body: form });
    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to start checkout" }, { status: unavailable ? 503 : 502 });
  }
}
