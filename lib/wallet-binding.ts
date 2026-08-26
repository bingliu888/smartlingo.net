import { getDatabase } from "./auth";

export function normalizeEvmWallet(value: unknown) {
  const wallet = String(value ?? "").trim().toLowerCase();
  if (wallet && !/^0x[a-f0-9]{40}$/.test(wallet)) throw new Error("INVALID_WALLET");
  return wallet;
}

export async function bindSmartPayWallet(userId: string, value: unknown) {
  const database = getDatabase();
  const wallet = normalizeEvmWallet(value);
  const current = await database.prepare("SELECT wallet_address AS wallet FROM users WHERE id=? LIMIT 1")
    .bind(userId).first<{ wallet: string | null }>();
  if (!wallet) {
    await database.batch([
      database.prepare("DELETE FROM smartpay_wallet_bindings WHERE user_id=?").bind(userId),
      database.prepare("UPDATE users SET wallet_address=NULL WHERE id=?").bind(userId),
    ]);
    return "";
  }
  const existing = await database.prepare("SELECT user_id AS userId FROM smartpay_wallet_bindings WHERE lower(wallet_address)=lower(?) LIMIT 1")
    .bind(wallet).first<{ userId: string }>();
  if (existing && existing.userId !== userId) {
    const [claim, subscription] = await Promise.all([
      database.prepare("SELECT 1 AS found FROM smartpay3_payment_claims WHERE user_id=? LIMIT 1").bind(existing.userId).first<{ found: number }>(),
      database.prepare("SELECT 1 AS found FROM smartlingo_course_subscriptions WHERE user_id=? AND status IN ('trialing','active','past_due') LIMIT 1").bind(existing.userId).first<{ found: number }>(),
    ]);
    if (claim || subscription) throw new Error("WALLET_BELONGS_TO_SUBSCRIBED_ACCOUNT");
    await database.batch([
      database.prepare("UPDATE users SET wallet_address=NULL WHERE id=? AND lower(wallet_address)=lower(?)").bind(existing.userId, wallet),
      database.prepare("DELETE FROM smartpay_wallet_bindings WHERE lower(wallet_address)=lower(?)").bind(wallet),
    ]);
  }
  const now = Math.floor(Date.now() / 1000);
  const statements = [];
  if (current?.wallet && current.wallet.toLowerCase() !== wallet) {
    statements.push(database.prepare("DELETE FROM smartpay_wallet_bindings WHERE user_id=?").bind(userId));
  }
  statements.push(
    database.prepare(`INSERT INTO smartpay_wallet_bindings(wallet_address,user_id,updated_at) VALUES(?,?,?)
      ON CONFLICT(wallet_address) DO UPDATE SET user_id=excluded.user_id,updated_at=excluded.updated_at`).bind(wallet, userId, now),
    database.prepare("UPDATE users SET wallet_address=? WHERE id=?").bind(wallet, userId),
  );
  await database.batch(statements);
  return wallet;
}
