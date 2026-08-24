import { getDatabase } from "./auth";
import { collegeSupervisorPlan, type CollegeSupervisorTier } from "./college-supervisor-plans";
import { stripeRequest } from "./stripe-course-subscription";

export type SupervisorCheckoutSession = {
  id: string; status: string; payment_status?: string; mode: string; client_reference_id: string;
  payment_intent?: string | { id?: string } | null;
  metadata?: { user_id?: string; tier?: string; scope?: string };
};

export async function syncStripeCollegeSupervisorLicense(userId: string, session: SupervisorCheckoutSession) {
  const plan = collegeSupervisorPlan(session.metadata?.tier);
  if (!plan || session.metadata?.user_id !== userId || session.metadata?.scope !== "college_supervisor"
    || session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") throw new Error("STRIPE_SCOPE_MISMATCH");
  const current = await getDatabase().prepare("SELECT tier,max_departments AS maxDepartments FROM smartlingo_college_supervisor_licenses WHERE user_id=? LIMIT 1")
    .bind(userId).first<{tier:CollegeSupervisorTier;maxDepartments:number}>();
  const rank = { basic: 0, premium: 1, supreme: 2 } as const;
  if (current && rank[plan.tier] < rank[current.tier]) return { tier: current.tier, maxDepartments: current.maxDepartments, status: "active" as const };
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
  const now = Math.floor(Date.now() / 1000);
  await getDatabase().prepare(`INSERT INTO smartlingo_college_supervisor_licenses
    (user_id,tier,price_cents,max_departments,status,stripe_checkout_session_id,stripe_payment_intent_id,purchased_at,created_at,updated_at)
    VALUES(?,?,?,?,'active',?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier,price_cents=excluded.price_cents,max_departments=excluded.max_departments,
      status='active',stripe_checkout_session_id=excluded.stripe_checkout_session_id,
      stripe_payment_intent_id=excluded.stripe_payment_intent_id,purchased_at=excluded.purchased_at,updated_at=excluded.updated_at`)
    .bind(userId,plan.tier,plan.priceCents,plan.maxDepartments,session.id,paymentIntentId,now,now,now).run();
  return { tier: plan.tier, maxDepartments: plan.maxDepartments, status: "active" as const };
}

export async function loadSupervisorCheckoutSession(sessionId: string) {
  return stripeRequest<SupervisorCheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`);
}

export async function markSupervisorPaymentStatus(paymentIntentId:string,status:"refunded"|"disputed"){
  if(!paymentIntentId)return false;
  await getDatabase().prepare(`UPDATE smartlingo_college_supervisor_licenses SET status=?,updated_at=?
    WHERE stripe_payment_intent_id=?`).bind(status,Math.floor(Date.now()/1000),paymentIntentId).run();
  return true;
}
