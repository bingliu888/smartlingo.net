import { getSessionUser } from "@/lib/auth";
import { stripeRequest, syncStripeCourseSubscription, type StripeSubscription } from "@/lib/stripe-course-subscription";

type CheckoutSession = { id: string; status: string; mode: string; client_reference_id: string; metadata?: { class_id?: string; user_id?: string }; subscription: string | StripeSubscription };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: string; classId?: string } | null;
  const sessionId = String(body?.sessionId || "");
  const classId = String(body?.classId || "");
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId) || !/^course_[a-z]{2}_(?:basic|intermediate|advanced)$/.test(classId)) return Response.json({ error: "Invalid checkout return" }, { status: 400 });
  try {
    const session = await stripeRequest<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`);
    if (session.status !== "complete" || session.mode !== "subscription" || session.client_reference_id !== user.id || session.metadata?.class_id !== classId || session.metadata?.user_id !== user.id) {
      return Response.json({ error: "Checkout does not match this signed-in course member" }, { status: 403 });
    }
    const subscription = typeof session.subscription === "string"
      ? await stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(session.subscription)}`)
      : session.subscription;
    const result = await syncStripeCourseSubscription(user.id, classId, subscription);
    return Response.json({ synced: true, classId, ...result });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to verify credit-card checkout" }, { status: unavailable ? 503 : 502 });
  }
}
