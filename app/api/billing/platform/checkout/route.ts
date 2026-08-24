import { getDatabase, getSessionUser } from "@/lib/auth";
import { collegeSupervisorPlan } from "@/lib/college-supervisor-plans";
import { stripeRequest } from "@/lib/stripe-course-subscription";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { lang?: string; tier?: string } | null;
  const lang = body?.lang && ["zh","en","es","ja","ko","fr","de","ru","it","pt","ar","hi"].includes(body.lang) ? body.lang : "en";
  const plan = collegeSupervisorPlan(body?.tier);
  if (!plan) return Response.json({ error: "Choose a College Supervisor package" }, { status: 400 });
  const current = await getDatabase().prepare("SELECT tier,price_cents AS priceCents,status FROM smartlingo_college_supervisor_licenses WHERE user_id=? LIMIT 1").bind(user.id).first<{tier:string;priceCents:number;status:string}>();
  const ranks:Record<string,number>={basic:0,premium:1,supreme:2};
  if(current?.status==="active"&&ranks[plan.tier]<=ranks[current.tier])return Response.json({error:"This package is already active"},{status:409});
  const amount=current?.status==="active"?plan.priceCents-current.priceCents:plan.priceCents;
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/${lang}/colleges/mine/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${lang}/colleges/mine`,
    client_reference_id: user.id,
    customer_email: user.email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `SmartLingo ${plan.nameEn}`,
    "metadata[user_id]": user.id,
    "metadata[tier]": plan.tier,
    "metadata[scope]": "college_supervisor",
  });
  try {
    const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", { method: "POST", body: form });
    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to start checkout" }, { status: unavailable ? 503 : 502 });
  }
}
