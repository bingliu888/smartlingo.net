import { getDatabase } from "./auth";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomRefId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, value => ALPHABET[value % ALPHABET.length]).join("");
}

export function normalizeSmartPayRefId(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export async function ensureSmartPayRefId(userId: string) {
  const database = getDatabase();
  const existing = await database.prepare("SELECT ref_id AS refId FROM smartpay_ref_ids WHERE user_id=? LIMIT 1")
    .bind(userId).first<{ refId: string }>();
  if (existing?.refId) return normalizeSmartPayRefId(existing.refId);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const refId = randomRefId();
    const result = await database.prepare("INSERT OR IGNORE INTO smartpay_ref_ids(user_id,ref_id,created_at) VALUES(?,?,?)")
      .bind(userId, refId, Math.floor(Date.now() / 1000)).run();
    if (result.success) {
      const saved = await database.prepare("SELECT ref_id AS refId FROM smartpay_ref_ids WHERE user_id=? LIMIT 1")
        .bind(userId).first<{ refId: string }>();
      if (saved?.refId) return normalizeSmartPayRefId(saved.refId);
    }
  }
  throw new Error("REF_ID_UNAVAILABLE");
}
