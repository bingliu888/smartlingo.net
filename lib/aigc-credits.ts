import { getDatabase } from "./auth";
export { SMARTLINGO_AIGC_CREDIT_COSTS } from "./platform-commerce";

export async function aigcCreditBalance(userId: string) {
  const row = await getDatabase().prepare("SELECT balance FROM smartlingo_aigc_credit_accounts WHERE user_id=? LIMIT 1")
    .bind(userId).first<{ balance: number }>();
  return Number(row?.balance || 0);
}

export async function addAigcCredits(input: { userId: string; credits: number; reason: string; providerReference: string; metadata?: unknown; now?: number }) {
  const now = input.now || Math.floor(Date.now() / 1_000);
  const credits = Math.floor(input.credits);
  if (credits <= 0) throw new Error("INVALID_CREDIT_AMOUNT");
  const database = getDatabase();
  const existing = await database.prepare("SELECT balance_after AS balanceAfter FROM smartlingo_aigc_credit_ledger WHERE provider_reference=? LIMIT 1")
    .bind(input.providerReference).first<{ balanceAfter: number }>();
  if (existing) return Number(existing.balanceAfter);
  await database.prepare(`INSERT OR IGNORE INTO smartlingo_aigc_credit_accounts(user_id,balance,created_at,updated_at)
    VALUES(?,0,?,?)`).bind(input.userId, now, now).run();
  try {
    await database.batch([
      database.prepare("UPDATE smartlingo_aigc_credit_accounts SET balance=balance+?,updated_at=? WHERE user_id=?")
        .bind(credits, now, input.userId),
      database.prepare(`INSERT INTO smartlingo_aigc_credit_ledger
        (id,user_id,delta,balance_after,reason,provider_reference,metadata_json,created_at)
        SELECT ?,?,?,balance,?,?,?,? FROM smartlingo_aigc_credit_accounts WHERE user_id=?`)
        .bind(crypto.randomUUID(), input.userId, credits, input.reason, input.providerReference,
          input.metadata === undefined ? null : JSON.stringify(input.metadata), now, input.userId),
    ]);
  } catch (error) {
    const replay = await database.prepare("SELECT balance_after AS balanceAfter FROM smartlingo_aigc_credit_ledger WHERE provider_reference=? LIMIT 1")
      .bind(input.providerReference).first<{ balanceAfter: number }>();
    if (replay) return Number(replay.balanceAfter);
    throw error;
  }
  return aigcCreditBalance(input.userId);
}

export async function consumeAigcCredits(input: { userId: string; credits: number; reason: string; providerReference: string; metadata?: unknown; now?: number }) {
  const now = input.now || Math.floor(Date.now() / 1_000);
  const credits = Math.floor(input.credits);
  if (credits <= 0) throw new Error("INVALID_CREDIT_AMOUNT");
  const database = getDatabase();
  const existing = await database.prepare("SELECT balance_after AS balanceAfter FROM smartlingo_aigc_credit_ledger WHERE provider_reference=? LIMIT 1")
    .bind(input.providerReference).first<{ balanceAfter: number }>();
  if (existing) return Number(existing.balanceAfter);
  const account = await database.prepare("SELECT balance FROM smartlingo_aigc_credit_accounts WHERE user_id=? LIMIT 1")
    .bind(input.userId).first<{ balance: number }>();
  if (Number(account?.balance || 0) < credits) throw new Error("AIGC_CREDITS_REQUIRED");
  try {
    await database.batch([
      database.prepare(`INSERT INTO smartlingo_aigc_credit_ledger
        (id,user_id,delta,balance_after,reason,provider_reference,metadata_json,created_at)
        SELECT ?,?,?,balance-?,?,?,?,? FROM smartlingo_aigc_credit_accounts WHERE user_id=?`)
        .bind(crypto.randomUUID(), input.userId, -credits, credits, input.reason, input.providerReference,
          input.metadata === undefined ? null : JSON.stringify(input.metadata), now, input.userId),
      database.prepare("UPDATE smartlingo_aigc_credit_accounts SET balance=balance-?,updated_at=? WHERE user_id=? AND balance>=?")
        .bind(credits, now, input.userId, credits),
    ]);
  } catch (error) {
    const replay = await database.prepare("SELECT balance_after AS balanceAfter FROM smartlingo_aigc_credit_ledger WHERE provider_reference=? LIMIT 1")
      .bind(input.providerReference).first<{ balanceAfter: number }>();
    if (replay) return Number(replay.balanceAfter);
    if (await aigcCreditBalance(input.userId) < credits) throw new Error("AIGC_CREDITS_REQUIRED");
    throw error;
  }
  return aigcCreditBalance(input.userId);
}

export async function refundAigcCredits(input: { userId: string; credits: number; reason: string; providerReference: string }) {
  return addAigcCredits({ ...input, providerReference: `refund:${input.providerReference}` });
}
