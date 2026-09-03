import { BOOTSTRAP_ADMIN_EMAIL, getDatabase } from "./auth";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "./smartpay-refid";

export async function smartLingoProductOwnerRefId() {
  const owner = await getDatabase().prepare(`SELECT id FROM users
    WHERE lower(email)=lower(?) AND email_verified=1 AND role='admin'
    ORDER BY clerk_identity_checked_at DESC LIMIT 1`)
    .bind(BOOTSTRAP_ADMIN_EMAIL)
    .first<{ id: string }>();
  if (!owner) throw new Error("SMARTPAY5_PRODUCT_OWNER_UNAVAILABLE");
  const refId = normalizeSmartPayRefId(await ensureSmartPayRefId(owner.id));
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(refId)) throw new Error("SMARTPAY5_PRODUCT_OWNER_UNAVAILABLE");
  return refId;
}
