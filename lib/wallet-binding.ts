import { getDatabase } from "./auth";

export function normalizeEvmWallet(value: unknown) {
  const wallet = String(value ?? "").trim().toLowerCase();
  if (wallet && !/^0x[a-f0-9]{40}$/.test(wallet)) throw new Error("INVALID_WALLET");
  return wallet;
}

export async function bindSmartPayWallet(userId: string, value: unknown) {
  const database = getDatabase();
  const wallet = normalizeEvmWallet(value);
  if (!wallet) {
    await database.batch([
      database.prepare("DELETE FROM smartpay_wallet_bindings WHERE user_id=?").bind(userId),
      database.prepare("UPDATE users SET wallet_address=NULL WHERE id=?").bind(userId),
    ]);
    return "";
  }
  const now = Math.floor(Date.now() / 1000);
  await database.batch([
    database.prepare(`INSERT INTO smartpay_wallet_bindings(wallet_address,user_id,updated_at) VALUES(?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET wallet_address=excluded.wallet_address,updated_at=excluded.updated_at`).bind(wallet, userId, now),
    database.prepare("UPDATE users SET wallet_address=? WHERE id=?").bind(wallet, userId),
  ]);
  return wallet;
}
