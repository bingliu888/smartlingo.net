import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { eligibleCourseSupervisorByRefId } from "@/lib/course-supervisors";
import { normalizeSmartPayRefId } from "@/lib/smartpay-refid";

export async function PATCH(request: Request, { params }: { params: Promise<{ subscriptionId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const subscriptionId = String((await params).subscriptionId || "");
  const body = await request.json().catch(() => null) as { supervisorRefId?: unknown } | null;
  const refId = normalizeSmartPayRefId(body?.supervisorRefId);
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(refId)) return Response.json({ error: "Invalid Supervisor RefID" }, { status: 400 });
  const supervisor = await eligibleCourseSupervisorByRefId(refId);
  if (!supervisor || supervisor.userId === user.id) return Response.json({ error: "Invalid Supervisor RefID" }, { status: 422 });
  const database = getDatabase();
  const current = await database.prepare(`SELECT supervisor_user_id AS supervisorUserId,supervisor_ref_id AS supervisorRefId
    FROM smartlingo_course_subscriptions WHERE id=? AND user_id=? LIMIT 1`).bind(subscriptionId,user.id)
    .first<{ supervisorUserId: string | null; supervisorRefId: string | null }>();
  if (!current) return Response.json({ error: "Subscription not found" }, { status: 404 });
  if (current.supervisorUserId) return Response.json({ supervisorRefId: current.supervisorRefId, immutable: true });
  const purchase = await database.prepare(`SELECT purchase.id,purchase.class_id AS classId,purchase.price_cents AS priceCents
    FROM smartlingo_course_package_purchases purchase
    JOIN smartlingo_course_subscriptions subscription ON subscription.class_id=purchase.class_id AND subscription.user_id=purchase.user_id
    WHERE subscription.id=? AND purchase.user_id=? AND purchase.status='paid'
    ORDER BY purchase.created_at DESC LIMIT 1`).bind(subscriptionId,user.id).first<{id:string;classId:string;priceCents:number}>();
  const statements = [database.prepare(`UPDATE smartlingo_course_subscriptions SET supervisor_user_id=?,supervisor_ref_id=?,updated_at=unixepoch()
    WHERE id=? AND user_id=? AND supervisor_user_id IS NULL`).bind(supervisor.userId,supervisor.refId,subscriptionId,user.id)];
  if (purchase) statements.push(database.prepare(`INSERT INTO smartlingo_course_supervisor_reward_events
    (id,purchase_id,supervisor_user_id,subscriber_user_id,class_id,reward_basis_cents,reward_amount_cents,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,NULL,'eligible',unixepoch(),unixepoch()) ON CONFLICT(purchase_id) DO NOTHING`)
    .bind(createId(),purchase.id,supervisor.userId,user.id,purchase.classId,purchase.priceCents));
  await database.batch(statements);
  const saved = await database.prepare(`SELECT supervisor_user_id AS supervisorUserId,supervisor_ref_id AS supervisorRefId
    FROM smartlingo_course_subscriptions WHERE id=? AND user_id=? LIMIT 1`).bind(subscriptionId,user.id)
    .first<{supervisorUserId:string|null;supervisorRefId:string|null}>();
  if (saved?.supervisorUserId!==supervisor.userId || saved.supervisorRefId!==supervisor.refId) return Response.json({ error: "Supervisor could not be saved" }, { status: 409 });
  return Response.json({ supervisorRefId: supervisor.refId, immutable: true });
}
