import { getDatabase, getSessionUser } from "@/lib/auth";
import { stripeRequest } from "@/lib/stripe-course-subscription";

type Course = { id: string; title: string; priceCents: number; packageTier: string; targetLanguage: string; trialDays: number };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { classId?: string; lang?: string; departmentId?: string } | null;
  const classId = String(body?.classId || "");
  const lang = body?.lang === "zh" ? "zh" : "en";
  const database = getDatabase();
  const course = await database.prepare(`SELECT id,title,price_cents AS priceCents,package_tier AS packageTier,target_language AS targetLanguage,trial_days AS trialDays
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' AND visibility='public' LIMIT 1`)
    .bind(classId).first<Course>();
  if (!course || !["basic", "intermediate", "advanced"].includes(course.packageTier)) return Response.json({ error: "Course not found" }, { status: 404 });
  const departmentId=String(body?.departmentId||"");
  const department=departmentId?await database.prepare(`SELECT department.id,college.owner_user_id AS ownerUserId,account.provider_account_id AS accountId,
    account.onboarding_status AS onboardingStatus,account.charges_enabled AS chargesEnabled,account.payouts_enabled AS payoutsEnabled
    FROM smartlingo_college_departments department JOIN smartlingo_colleges college ON college.id=department.college_id
    JOIN smartlingo_college_department_courses mapping ON mapping.department_id=department.id AND mapping.course_id=?
    LEFT JOIN smartlingo_connected_accounts account ON account.user_id=college.owner_user_id
    WHERE department.id=? AND department.status='active' LIMIT 1`).bind(classId,departmentId).first<{id:string;ownerUserId:string;accountId:string|null;onboardingStatus:string|null;chargesEnabled:number;payoutsEnabled:number}>():null;
  if(departmentId&&!department)return Response.json({error:"Department course not found"},{status:404});
  if(department&&(!department.accountId||department.onboardingStatus!=="ready"||!department.chargesEnabled||!department.payoutsEnabled))return Response.json({error:"The college must finish payout onboarding before accepting department subscriptions"},{status:409});
  const existing = await database.prepare("SELECT id FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=? LIMIT 1").bind(classId, user.id).first();
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: "subscription",
    success_url: `${origin}/${lang}/classes/${encodeURIComponent(classId)}/pay/card/complete?session_id={CHECKOUT_SESSION_ID}${departmentId?`&department=${encodeURIComponent(departmentId)}`:""}`,
    cancel_url: `${origin}/${lang}/classes/${encodeURIComponent(classId)}${departmentId?`?department=${encodeURIComponent(departmentId)}`:""}`,
    client_reference_id: user.id,
    customer_email: user.email,
    payment_method_collection: "always",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(course.priceCents),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": course.title,
    "metadata[class_id]": classId,
    "metadata[user_id]": user.id,
    "metadata[package_tier]": course.packageTier,
    "metadata[target_language]": course.targetLanguage,
    "subscription_data[metadata][class_id]": classId,
    "subscription_data[metadata][user_id]": user.id,
  });
  if(department){form.set("metadata[department_id]",department.id);form.set("subscription_data[metadata][department_id]",department.id);form.set("subscription_data[application_fee_percent]","30");form.set("subscription_data[transfer_data][destination]",department.accountId!)}
  if (!existing) form.set("subscription_data[trial_period_days]", String(course.trialDays));
  try {
    const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", { method: "POST", body: form });
    return Response.json({ url: session.url, sessionId: session.id, firstMonthFree: !existing });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to start credit-card checkout" }, { status: unavailable ? 503 : 502 });
  }
}
