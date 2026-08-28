import { getDatabase, getSessionUser } from "@/lib/auth";
import { courseSubscriptionPackage, fixedCourseId, normalizeCourseDurationMonths, type SmartLingoPackageTier } from "@/lib/smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";
import { stripeRequest } from "@/lib/stripe-course-subscription";
import { eligibleCourseSupervisorByRefId } from "@/lib/course-supervisors";

type Course = { id: string; title: string; packageTier: SmartLingoPackageTier; targetLanguage: string };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { classId?: string; targetLanguage?: string; months?: unknown; lang?: string; supervisorRefId?: unknown } | null;
  const classId = String(body?.classId || "");
  const targetLanguage = String(body?.targetLanguage || "");
  const months = normalizeCourseDurationMonths(body?.months);
  const lang = body?.lang === "zh" ? "zh" : "en";
  const supervisor = body?.supervisorRefId ? await eligibleCourseSupervisorByRefId(body.supervisorRefId) : null;
  if (body?.supervisorRefId && (!supervisor || supervisor.userId===user.id)) return Response.json({ error: "Invalid Supervisor RefID" }, { status: 422 });
  if (!months || !isSmartLingoCommunityLanguage(targetLanguage)) return Response.json({ error: "Choose a learning language and package" }, { status: 400 });
  const database = getDatabase();
  const course = await database.prepare(`SELECT id,title,package_tier AS packageTier,target_language AS targetLanguage
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' AND visibility='public' LIMIT 1`)
    .bind(classId).first<Course>();
  if (!course || !["basic", "intermediate", "advanced"].includes(course.packageTier)
    || course.targetLanguage !== targetLanguage || fixedCourseId(targetLanguage, course.packageTier) !== classId) {
    return Response.json({ error: "Course language does not match the selected package" }, { status: 404 });
  }
  const selectedPackage = courseSubscriptionPackage(course.packageTier, months);
  if (!selectedPackage) return Response.json({ error: "Package not found" }, { status: 404 });
  const origin = new URL(request.url).origin;
  const detailQuery=new URLSearchParams({language:targetLanguage,months:String(months)});
  if(supervisor)detailQuery.set("supervisor",supervisor.refId);
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/${lang}/classes/${encodeURIComponent(classId)}/pay/card/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${lang}/classes/${encodeURIComponent(classId)}?${detailQuery}`,
    client_reference_id: user.id,
    customer_email: user.email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(selectedPackage.priceCents),
    "line_items[0][price_data][product_data][name]": `${course.title} · ${months} months`,
    "metadata[scope]": "course_package",
    "metadata[class_id]": classId,
    "metadata[user_id]": user.id,
    "metadata[package_tier]": course.packageTier,
    "metadata[target_language]": targetLanguage,
    "metadata[duration_months]": String(months),
    "metadata[package_id]": selectedPackage.id,
    ...(supervisor?{"metadata[supervisor_ref_id]":supervisor.refId}:{}),
    "payment_intent_data[metadata][scope]": "course_package",
    "payment_intent_data[metadata][class_id]": classId,
    "payment_intent_data[metadata][user_id]": user.id,
    "payment_intent_data[metadata][package_tier]": course.packageTier,
    "payment_intent_data[metadata][target_language]": targetLanguage,
    "payment_intent_data[metadata][duration_months]": String(months),
    "payment_intent_data[metadata][package_id]": selectedPackage.id,
    ...(supervisor?{"payment_intent_data[metadata][supervisor_ref_id]":supervisor.refId}:{}),
  });
  try {
    const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", { method: "POST", body: form });
    return Response.json({ url: session.url, sessionId: session.id, package: selectedPackage, targetLanguage });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to start credit-card checkout" }, { status: unavailable ? 503 : 502 });
  }
}
