import { getSessionUser } from "@/lib/auth";
import { fulfillPlatformProduct } from "@/lib/platform-entitlements";
import { platformProduct, type SmartLingoPlatformProductId } from "@/lib/platform-commerce";
import { stripeRequest } from "@/lib/stripe-course-subscription";

type Session = { id: string; status: string; payment_status?: string; mode: string; client_reference_id?: string; amount_total?: number; currency?: string; payment_intent?: string | { id?: string }; metadata?: Record<string, string> };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: string } | null;
  const sessionId = String(body?.sessionId || "");
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) return Response.json({ error: "Invalid checkout return" }, { status: 400 });
  try {
    const session = await stripeRequest<Session>(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`);
    const metadata = session.metadata || {};
    const product = platformProduct(metadata.product_id);
    const paymentReference = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || session.id;
    if (session.status !== "complete" || session.payment_status !== "paid" || session.mode !== "payment" || session.client_reference_id !== user.id
      || metadata.scope !== "platform_product" || metadata.user_id !== user.id || !product || session.amount_total !== product.usdCents
      || String(session.currency || "").toLowerCase() !== "usd") return Response.json({ error: "Checkout does not match this account" }, { status: 403 });
    return Response.json(await fulfillPlatformProduct({ userId: user.id, productId: product.id as SmartLingoPlatformProductId, provider: "stripe", providerReference: paymentReference, amountCents: product.usdCents, checkoutIntentId: metadata.intent_id || null }));
  } catch {
    return Response.json({ error: "Unable to verify Stripe checkout" }, { status: 502 });
  }
}
