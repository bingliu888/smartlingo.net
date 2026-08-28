import { getDatabase, getSessionUser } from "@/lib/auth";
import { courseSubscriptionPackage, fixedCourseId, normalizeCourseDurationMonths, type SmartLingoPackageTier } from "@/lib/smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";
import { stripeRequest } from "@/lib/stripe-course-subscription";

type Course = { id: string; title: string; packageTier: SmartLingoPackageTier; targetLanguage: string };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { classId?: string; targetLanguage?: string; months?: unknown; lang?: string; departmentId?: string } | null;
  const classId = String(body?.classId || "");
  const targetLanguage = String(body?.targetLanguage || "");
  const months = normalizeCourseDurationMonths(body?.months);
  const lang = body?.lang === "zh" ? "zh" : "en";
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
  const departmentId=String(body?.departmentId||"");
  const department=departmentId?await database.prepare(`SELECT department.id,college.owner_user_id AS ownerUserId,account.provider_account_id AS accountId,
    account.onboarding_status AS onboardingStatus,account.charges_enabled AS chargesEnabled,account.payouts_enabled AS payoutsEnabled
    FROM smartlingo_college_departments department JOIN smartlingo_colleges college ON college.id=department.college_id
    JOIN smartlingo_college_department_courses mapping ON mapping.department_id=department.id AND mapping.course_id=?
    LEFT JOIN smartlingo_connected_accounts account ON account.user_id=college.owner_user_id
    WHERE department.id=? AND department.status='active' LIMIT 1`).bind(classId,departmentId).first<{id:string;ownerUserId:string;accountId:string|null;onboardingStatus:string|null;chargesEnabled:number;payoutsEnabled:number}>():null;
  if(departmentId&&!department)return Response.json({error:"Department course not found"},{status:404});
  if(department&&(!department.accountId||department.onboardingStatus!=="ready"||!department.chargesEnabled||!department.payoutsEnabled))return Response.json({error:"The college must finish payout onboarding before accepting department subscriptions"},{status:409});
  const origin = new URL(request.url).origin;
  const detailQuery=new URLSearchParams({language:targetLanguage,months:String(months)});if(departmentId)detailQuery.set("department",departmentId);
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
    "payment_intent_data[metadata][scope]": "course_package",
    "payment_intent_data[metadata][class_id]": classId,
    "payment_intent_data[metadata][user_id]": user.id,
    "payment_intent_data[metadata][package_tier]": course.packageTier,
    "payment_intent_data[metadata][target_language]": targetLanguage,
    "payment_intent_data[metadata][duration_months]": String(months),
    "payment_intent_data[metadata][package_id]": selectedPackage.id,
  });
  if(department){form.set("metadata[department_id]",department.id);form.set("payment_intent_data[metadata][department_id]",department.id);form.set("payment_intent_data[application_fee_amount]",String(selectedPackage.priceCents-Math.floor(selectedPackage.priceCents*7_000/10_000)));form.set("payment_intent_data[transfer_data][destination]",department.accountId!)}
  try {
    const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", { method: "POST", body: form });
    return Response.json({ url: session.url, sessionId: session.id, package: selectedPackage, targetLanguage });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to start credit-card checkout" }, { status: unavailable ? 503 : 502 });
  }
}
