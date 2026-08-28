import { stripeRequest, runtimeValue, syncStripeCourseSubscription, type StripeSubscription } from "@/lib/stripe-course-subscription";
import { markCoursePackagePaymentStatus, recordCoursePackagePurchase } from "@/lib/course-package-purchase";
import { courseSubscriptionPackage, normalizeCourseDurationMonths, type SmartLingoPackageTier } from "@/lib/smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifiedPayload(request: Request) {
  const secret = await runtimeValue("STRIPE_WEBHOOK_SECRET");
  if (!secret) return null;
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const values = Object.fromEntries(signature.split(",").map(item => item.split("=", 2)));
  const timestamp = Number(values.t);
  if (!Number.isInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 || !values.v1) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  if (!safeEqual(expected, values.v1)) return null;
  return JSON.parse(payload) as { type?: string; data?: { object?: Record<string, unknown> } };
}

export async function POST(request: Request) {
  let event: Awaited<ReturnType<typeof verifiedPayload>>;
  try { event = await verifiedPayload(request); } catch { event = null; }
  if (!event) return Response.json({ error: "Invalid Stripe signature" }, { status: 400 });
  try {
    if(event.type==="charge.refunded"||event.type==="charge.dispute.created"){
      const object=event.data?.object as{payment_intent?:string}|undefined;
      if(object?.payment_intent){const status=event.type==="charge.refunded"?"refunded":"disputed";await markCoursePackagePaymentStatus(object.payment_intent,status);}
      return Response.json({received:true});
    }
    let subscription: StripeSubscription | null = null;
    if (event.type === "checkout.session.completed") {
      const object = event.data?.object as ({ subscription?: string;payment_intent?:string|{id?:string};amount_total?:number;currency?:string;
        mode?:string;status?:string;payment_status?:string;metadata?:{user_id?:string;scope?:string;class_id?:string;package_tier?:string;target_language?:string;duration_months?:string;package_id?:string} }) | undefined;
      if(object?.mode==="payment"&&object.status==="complete"&&object.payment_status==="paid"&&object.metadata?.scope==="course_package"
        &&object.metadata.user_id&&object.metadata.class_id){
        const tier=object.metadata.package_tier as SmartLingoPackageTier;
        const months=normalizeCourseDurationMonths(object.metadata.duration_months);
        const language=String(object.metadata.target_language||"");
        const selectedPackage=months&&["basic","intermediate","advanced"].includes(tier)?courseSubscriptionPackage(tier,months):null;
        const paymentIntentId=typeof object.payment_intent==="string"?object.payment_intent:object.payment_intent?.id||"";
        if(!selectedPackage||!isSmartLingoCommunityLanguage(language)||object.metadata.package_id!==selectedPackage.id
          ||object.amount_total!==selectedPackage.priceCents||String(object.currency||"").toLowerCase()!=="usd"||!paymentIntentId)throw new Error("STRIPE_SCOPE_MISMATCH");
        await recordCoursePackagePurchase({userId:object.metadata.user_id,classId:object.metadata.class_id,targetLanguage:language,
          packageTier:tier,durationMonths:months!,priceCents:selectedPackage.priceCents,provider:"stripe",providerReference:paymentIntentId});
        return Response.json({received:true});
      }
      if (object?.subscription) subscription = await stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(object.subscription)}`);
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(String(event.type))) {
      subscription = event.data?.object as unknown as StripeSubscription;
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const object = event.data?.object as { subscription?: string } | undefined;
      if (object?.subscription) subscription = await stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(object.subscription)}`);
    }
    const userId = subscription?.metadata?.user_id;
    const classId = subscription?.metadata?.class_id;
    if (subscription && userId && classId) {
      await syncStripeCourseSubscription(userId, classId, subscription);
    }
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Stripe event could not be synchronized" }, { status: 502 });
  }
}
