import { getDatabase } from "@/lib/auth";
import { boundedRequestBody } from "@/lib/bounded-request-body";
import { fulfillPlatformProduct } from "@/lib/platform-entitlements";
import { platformProduct, type SmartLingoPlatformProductId } from "@/lib/platform-commerce";
import { stripeCommerceEnvironment } from "@/lib/stripe-runtime";
import { validStripeSignature } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 256 * 1_024;

type StripeEvent = { id?: string; type?: string; created?: number; data?: { object?: {
  id?: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  payment_intent?: string;
  amount_total?: number;
  currency?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
} } };

export async function POST(request: Request) {
  try {
    const secret = (await stripeCommerceEnvironment()).STRIPE_WEBHOOK_SECRET?.trim();
    const raw = await boundedRequestBody(request, MAX_BODY_BYTES);
    const body = new TextDecoder().decode(raw);
    const signature = request.headers.get("stripe-signature") || "";
    if (!secret || !await validStripeSignature(body, signature, secret)) return new Response("Invalid signature", { status: 400 });

    let event: StripeEvent;
    try { event = JSON.parse(body) as StripeEvent; } catch { return new Response("Invalid event", { status: 400 }); }
    const session = event.data?.object;
    if (!event.id || !event.type || !Number.isSafeInteger(event.created) || !session?.id) return new Response("Invalid event", { status: 400 });

    const database = getDatabase();
    const eventId = `stripe:${event.id}`;
    if (await database.prepare("SELECT id FROM processed_webhooks WHERE id=? LIMIT 1").bind(eventId).first()) return new Response("ok");

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const status = event.type === "checkout.session.expired" ? "expired" : "cancelled";
      const now = Math.floor(Date.now() / 1_000);
      await database.batch([
        database.prepare("UPDATE smartlingo_platform_checkout_intents SET status=?,updated_at=? WHERE provider_session_id=? AND status='pending'")
          .bind(status, now, session.id),
        database.prepare("INSERT OR IGNORE INTO processed_webhooks(id,provider,processed_at) VALUES(?,'stripe',?)")
          .bind(eventId, now),
      ]);
      return new Response("ok");
    }

    const paidEvent = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
    if (!paidEvent || session.payment_status !== "paid") return new Response("ok");
    const metadata = session.metadata || {};
    const product = platformProduct(metadata.product_id);
    const intent = await database.prepare(`SELECT id,user_id AS userId,product_id AS productId,amount_cents AS amountCents,currency
      FROM smartlingo_platform_checkout_intents WHERE id=? AND provider_session_id=? LIMIT 1`)
      .bind(metadata.intent_id || "", session.id)
      .first<{ id: string; userId: string; productId: string; amountCents: number; currency: string }>();
    if (session.mode !== "payment" || metadata.scope !== "platform_product" || !product || !intent
      || metadata.user_id !== intent.userId || session.client_reference_id !== intent.userId || intent.productId !== product.id
      || intent.amountCents !== product.usdCents || session.amount_total !== product.usdCents
      || String(intent.currency || "").toLowerCase() !== "usd" || String(session.currency || "").toLowerCase() !== "usd") {
      return new Response("Checkout does not match the saved order", { status: 422 });
    }
    const paymentReference = session.payment_intent || session.id;
    await fulfillPlatformProduct({
      userId: intent.userId,
      productId: product.id as SmartLingoPlatformProductId,
      provider: "stripe",
      providerReference: paymentReference,
      amountCents: product.usdCents,
      paidAt: event.created,
      checkoutIntentId: intent.id,
    });
    await database.prepare("INSERT OR IGNORE INTO processed_webhooks(id,provider,processed_at) VALUES(?,'stripe',?)")
      .bind(eventId, Math.floor(Date.now() / 1_000)).run();
    return new Response("ok");
  } catch (error) {
    if (error instanceof Response) return error;
    console.warn("Stripe webhook failed", error instanceof Error ? error.name : "unknown");
    return new Response("Webhook processing failed", { status: 500 });
  }
}
