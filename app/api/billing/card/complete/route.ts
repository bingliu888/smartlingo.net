import { getSessionUser } from "@/lib/auth";
import { recordCoursePackagePurchase } from "@/lib/course-package-purchase";
import { courseSubscriptionPackage, normalizeCourseDurationMonths, type SmartLingoPackageTier } from "@/lib/smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";
import { stripeRequest } from "@/lib/stripe-course-subscription";

type CheckoutSession = {
  id: string; status: string; payment_status?: string; mode: string; client_reference_id: string;
  amount_total?: number | null; currency?: string | null; payment_intent?: string | { id?: string } | null;
  metadata?: { scope?: string; class_id?: string; user_id?: string; package_tier?: string; target_language?: string;
    duration_months?: string; package_id?: string };
};

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: string; classId?: string } | null;
  const sessionId = String(body?.sessionId || "");
  const classId = String(body?.classId || "");
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId) || !/^course_[a-z]{2}_(?:basic|intermediate|advanced)$/.test(classId)) return Response.json({ error: "Invalid checkout return" }, { status: 400 });
  try {
    const session = await stripeRequest<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`);
    const metadata=session.metadata||{};
    const months=normalizeCourseDurationMonths(metadata.duration_months);
    const tier=metadata.package_tier as SmartLingoPackageTier;
    const targetLanguage=String(metadata.target_language||"");
    const selectedPackage=months&&["basic","intermediate","advanced"].includes(tier)?courseSubscriptionPackage(tier,months):null;
    const paymentIntentId=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id||"";
    if (session.status !== "complete" || session.payment_status !== "paid" || session.mode !== "payment"
      || session.client_reference_id !== user.id || metadata.scope!=="course_package" || metadata.class_id !== classId
      || metadata.user_id !== user.id || !isSmartLingoCommunityLanguage(targetLanguage) || !selectedPackage
      || metadata.package_id!==selectedPackage.id || session.amount_total!==selectedPackage.priceCents
      || String(session.currency||"").toLowerCase()!=="usd" || !paymentIntentId) {
      return Response.json({ error: "Checkout does not match this signed-in course package" }, { status: 403 });
    }
    const result=await recordCoursePackagePurchase({userId:user.id,classId,targetLanguage,packageTier:tier,durationMonths:months!,
      priceCents:selectedPackage.priceCents,provider:"stripe",providerReference:paymentIntentId});
    return Response.json({ synced: true, classId,targetLanguage,package:selectedPackage,currentPeriodEnd:result.accessEndsAt,alreadyRecorded:result.alreadyRecorded });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to verify credit-card checkout" }, { status: unavailable ? 503 : 502 });
  }
}
