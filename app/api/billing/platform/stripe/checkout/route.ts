import { getDatabase, getSessionUser } from "@/lib/auth";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { platformProduct } from "@/lib/platform-commerce";
import { runtimeValue, stripeRequest } from "@/lib/stripe";
import { stripeCommerceConfigured } from "@/lib/stripe-runtime";

const CHECKOUT_SECONDS = 35 * 60;

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
    const limited = await consumeAccountRequestLimit({ request, scope: "platform-stripe-checkout", userId: user.id, limit: 10, windowSeconds: 60, unavailableMessage: "Payment protection is temporarily unavailable." });
    if (limited) return limited;
    const body = await boundedJsonBody<{ productId?: unknown; locale?: unknown; returnTo?: unknown }>(request, 8 * 1024);
    const product = platformProduct(body.productId);
    if (!product) return Response.json({ error: "Choose a valid product" }, { status: 400 });
    if (!await runtimeValue("STRIPE_SECRET_KEY") || !await stripeCommerceConfigured()) return Response.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
    const now = Math.floor(Date.now() / 1_000);
    const database = getDatabase();
    await database.prepare("UPDATE smartlingo_platform_checkout_intents SET status='expired',updated_at=? WHERE user_id=? AND status='pending' AND expires_at<=?")
      .bind(now, user.id, now).run();
    const pending = await database.prepare(`SELECT id,product_id AS productId,checkout_url AS checkoutUrl,expires_at AS expiresAt
      FROM smartlingo_platform_checkout_intents WHERE user_id=? AND status='pending' LIMIT 1`)
      .bind(user.id).first<{ id: string; productId: string; checkoutUrl: string | null; expiresAt: number }>();
    if (pending && pending.productId !== product.id) return Response.json({ error: "A different checkout is already open" }, { status: 409 });
    if (pending?.checkoutUrl && pending.expiresAt > now) return Response.json({ url: pending.checkoutUrl, reused: true });
    const intentId = pending?.id || crypto.randomUUID();
    const expiresAt = now + CHECKOUT_SECONDS;
    if (!pending) await database.prepare(`INSERT INTO smartlingo_platform_checkout_intents
      (id,user_id,provider,product_id,amount_cents,currency,idempotency_key,status,expires_at,created_at,updated_at)
      VALUES(?,?,'stripe',?,?,'usd',?,'pending',?,?,?)`)
      .bind(intentId, user.id, product.id, product.usdCents, `smartlingo-platform-v1-${intentId}`, expiresAt, now, now).run();
    const locale = String(body.locale || user.preferredLanguage || "en").replace(/[^a-z-]/gi, "").slice(0, 12) || "en";
    const origin = new URL(request.url).origin;
    const requestedReturnTo = String(body.returnTo || "");
    const returnTo = /^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(requestedReturnTo) ? requestedReturnTo : `/${locale}/pricing`;
    const paymentPage = `/${locale}/pricing/pay/${product.id}?returnTo=${encodeURIComponent(returnTo)}`;
    const form = new URLSearchParams({
      mode: "payment",
      success_url: `${origin}${paymentPage}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${paymentPage}&checkout=cancelled`,
      client_reference_id: user.id,
      customer_email: user.email,
      "payment_method_types[0]": "card",
      "payment_method_types[1]": "us_bank_account",
      "wallet_options[link][display]": "never",
      customer_creation: "if_required",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(product.usdCents),
      "line_items[0][price_data][product_data][name]": product.kind === "max" ? `SmartLingo Max · ${product.months} months` : "SmartLingo AIGC Credits · 1,000",
      "line_items[0][price_data][product_data][description]": product.kind === "max" ? "One-time fixed-term Max access. No automatic renewal." : "One-time prepaid AIGC credit refill.",
      "metadata[scope]": "platform_product",
      "metadata[user_id]": user.id,
      "metadata[intent_id]": intentId,
      "metadata[product_id]": product.id,
      "payment_intent_data[metadata][scope]": "platform_product",
      "payment_intent_data[metadata][user_id]": user.id,
      "payment_intent_data[metadata][intent_id]": intentId,
      "payment_intent_data[metadata][product_id]": product.id,
      expires_at: String(expiresAt),
    });
    const session = await stripeRequest<{ id: string; url: string; expires_at?: number }>("/checkout/sessions", {
      method: "POST",
      headers: { "idempotency-key": `smartlingo-platform-v1-${intentId}`, "stripe-version": "2025-04-30.basil" },
      body: form,
    });
    if (!/^https:\/\/checkout\.stripe\.com\//.test(session.url)) throw new Error("STRIPE_CHECKOUT_UNAVAILABLE");
    await database.prepare("UPDATE smartlingo_platform_checkout_intents SET provider_session_id=?,checkout_url=?,expires_at=?,updated_at=? WHERE id=?")
      .bind(session.id, session.url, Number(session.expires_at || expiresAt), now, intentId).run();
    return Response.json({ url: session.url });
  } catch (error) {
    if (error instanceof Response) return error;
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "STRIPE_NOT_CONFIGURED" : "STRIPE_CHECKOUT_UNAVAILABLE" }, { status: unavailable ? 503 : 502 });
  }
}
