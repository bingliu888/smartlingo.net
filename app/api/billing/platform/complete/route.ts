import { getSessionUser } from "@/lib/auth";
import { stripeRequest } from "@/lib/stripe-course-subscription";
import { loadPlatformStripeSubscription, syncStripePlatformSubscription } from "@/lib/stripe-platform-subscription";

type CheckoutSession = { status: string; mode: string; client_reference_id: string; metadata?: { user_id?: string; cadence?: string; scope?: string }; subscription: string | { id?: string } };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: string } | null;
  const sessionId = String(body?.sessionId || "");
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) return Response.json({ error: "Invalid checkout return" }, { status: 400 });
  try {
    const session = await stripeRequest<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`);
    if (session.status !== "complete" || session.mode !== "subscription" || session.client_reference_id !== user.id || session.metadata?.user_id !== user.id || session.metadata?.cadence !== "coordinator" || session.metadata?.scope !== "platform") return Response.json({ error: "Checkout does not match this member" }, { status: 403 });
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : String(session.subscription?.id || "");
    if (!subscriptionId) return Response.json({ error: "Subscription is unavailable" }, { status: 502 });
    const result = await syncStripePlatformSubscription(user.id, await loadPlatformStripeSubscription(subscriptionId));
    return Response.json({ synced: true, ...result });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to verify checkout" }, { status: unavailable ? 503 : 502 });
  }
}
