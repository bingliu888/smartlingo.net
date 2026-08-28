import { getDatabase } from "./auth";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "./smartpay-refid";

export type CourseSupervisorIdentity = {
  userId: string;
  refId: string;
  isAdmin: boolean;
};

type EligibilityRow = { id: string; role: string; eligible: number };

async function eligibilityRow(userId: string) {
  return getDatabase().prepare(`SELECT u.id,u.role,
    CASE WHEN u.role='admin' OR (
      COALESCE(access.status,'active')='active'
      AND COALESCE(access.subscriber_override,0)<>-1
      AND (COALESCE(access.subscriber_override,0)=1 OR EXISTS (
        SELECT 1 FROM smartlingo_platform_subscription_payments payment
        WHERE payment.subscriber_user_id=u.id AND payment.status='paid'
      ))
    ) THEN 1 ELSE 0 END AS eligible
    FROM users u LEFT JOIN platform_member_access access ON access.user_id=u.id
    WHERE u.id=? LIMIT 1`).bind(userId).first<EligibilityRow>();
}
export async function isEligibleCourseSupervisor(userId: string) {
  return Number((await eligibilityRow(userId))?.eligible || 0) === 1;
}

export async function courseSupervisorIdentity(userId: string, ensureRefId = false): Promise<CourseSupervisorIdentity | null> {
  const row = await eligibilityRow(userId);
  if (!row || Number(row.eligible) !== 1) return null;
  let refId = await getDatabase().prepare("SELECT ref_id AS refId FROM smartpay_ref_ids WHERE user_id=? LIMIT 1")
    .bind(userId).first<{ refId: string }>().then(value => normalizeSmartPayRefId(value?.refId));
  if (!refId && ensureRefId) refId = await ensureSmartPayRefId(userId);
  if (!refId) return null;
  return { userId, refId, isAdmin: row.role === "admin" };
}

export async function eligibleCourseSupervisorByRefId(value: unknown): Promise<CourseSupervisorIdentity | null> {
  const refId = normalizeSmartPayRefId(value);
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(refId)) return null;
  const row = await getDatabase().prepare(`SELECT u.id,u.role,
    CASE WHEN u.role='admin' OR (
      COALESCE(access.status,'active')='active'
      AND COALESCE(access.subscriber_override,0)<>-1
      AND (COALESCE(access.subscriber_override,0)=1 OR EXISTS (
        SELECT 1 FROM smartlingo_platform_subscription_payments payment
        WHERE payment.subscriber_user_id=u.id AND payment.status='paid'
      ))
    ) THEN 1 ELSE 0 END AS eligible
    FROM smartpay_ref_ids ref JOIN users u ON u.id=ref.user_id
    LEFT JOIN platform_member_access access ON access.user_id=u.id
    WHERE lower(ref.ref_id)=lower(?) LIMIT 1`).bind(refId).first<EligibilityRow>();
  if (!row || Number(row.eligible) !== 1) return null;
  return { userId: row.id, refId, isAdmin: row.role === "admin" };
}
