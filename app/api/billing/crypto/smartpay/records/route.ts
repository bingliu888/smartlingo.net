import { isAddress, type Address } from "viem";
import { isPermanentAdmin } from "@/lib/admin-access";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { cryptoRpcUrl } from "@/lib/crypto-rpc";
import { cryptoPaymentSettingById } from "@/lib/crypto-payments";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "@/lib/smartpay-refid";
import { smartPay3LatestTransactions, verifySmartPay3Identity } from "@/lib/smartpay3-server";

export const dynamic = "force-dynamic";

type ClaimRow = { transactionId: string; userId: string; currentPeriodEnd: number };
type MatchedMember = {
  id: string;
  email: string;
  displayName: string;
  payerWalletAddress: string;
  refId: string;
};

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const url = new URL(request.url);
  const setting = await cryptoPaymentSettingById(url.searchParams.get("settingId") || "");
  if (!setting?.smartPay3Contract || !isAddress(setting.smartPay3Contract)) {
    return Response.json({ error: "On-chain course payment is not configured for this token" }, { status: 409 });
  }
  const database = getDatabase();
  const admin = isPermanentAdmin(user);
  const saved = await database.prepare("SELECT wallet_address AS wallet FROM users WHERE id=? LIMIT 1")
    .bind(user.id).first<{ wallet: string | null }>();
  const requested = String(url.searchParams.get("wallet") || "").trim();
  const wallet = admin ? requested : (saved?.wallet || "");
  const latestMode = admin && !wallet;
  if (!latestMode && !isAddress(wallet)) {
    return Response.json({ error: admin ? "Enter a valid EVM wallet or leave it blank" : "Save a payer wallet first" }, { status: 400 });
  }
  if (!admin && requested && requested.toLowerCase() !== wallet.toLowerCase()) {
    return Response.json({ error: "You may only query your saved payer wallet" }, { status: 403 });
  }
  try {
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    await verifySmartPay3Identity(rpcUrl, setting.smartPay3Contract as Address);
    const requestedLimit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25) || 25));
    const maxCount = latestMode ? Math.min(25, requestedLimit) : requestedLimit;
    const latest = await smartPay3LatestTransactions({
      rpcUrl,
      contract: setting.smartPay3Contract as Address,
      wallet: latestMode ? undefined : wallet as Address,
      maxCount,
    });
    const claims = new Map<string, ClaimRow>();
    if (latest.transactions.length) {
      const placeholders = latest.transactions.map(() => "?").join(",");
      const rows = await database.prepare(`SELECT transaction_id AS transactionId,user_id AS userId,
          current_period_ends_at AS currentPeriodEnd FROM smartpay3_payment_claims
        WHERE lower(contract_address)=lower(?) AND lower(transaction_id) IN (${placeholders})`)
        .bind(setting.smartPay3Contract, ...latest.transactions.map(item => item.transactionId.toLowerCase()))
        .all<ClaimRow>();
      for (const row of rows.results || []) claims.set(row.transactionId.toLowerCase(), row);
    }
    const matchedMembers: MatchedMember[] = [];
    if (admin) {
      const wallets = [...new Set((latestMode ? latest.transactions.map(item => item.wallet) : [wallet]).map(item => item.toLowerCase()))];
      for (const payerWallet of wallets) {
        const rows = await database.prepare(`SELECT u.id,u.email,u.display_name AS displayName,
            b.wallet_address AS payerWalletAddress,r.ref_id AS refId
          FROM smartpay_wallet_bindings b
          JOIN users u ON u.id=b.user_id
          JOIN smartpay_ref_ids r ON r.user_id=u.id
          WHERE lower(b.wallet_address)=lower(?) LIMIT 10`)
          .bind(payerWallet).all<MatchedMember>();
        matchedMembers.push(...(rows.results || []));
      }
    }
    const refId = admin ? "" : await ensureSmartPayRefId(user.id);
    const transactions = latest.transactions.map(record => {
      const claim = claims.get(record.transactionId.toLowerCase());
      return {
        ...record,
        settingId: setting.id,
        subscriptionRecorded: Boolean(claim),
        subscriptionEndsAt: claim?.currentPeriodEnd || null,
        claimedMemberId: claim?.userId || null,
      };
    }).filter(record => admin || (
      normalizeSmartPayRefId(record.refId) === normalizeSmartPayRefId(refId)
      && !record.subscriptionRecorded
    ));
    return Response.json({
      wallet: latestMode ? null : wallet.toLowerCase(),
      refId,
      mode: latestMode ? "latest" : "wallet",
      totalTransactions: admin ? latest.totalTransactions : transactions.length,
      transactions,
      matchedMembers,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.warn("SmartPay3 transaction lookup failed", error instanceof Error ? error.message.slice(0, 160) : "unknown");
    return Response.json({ error: "Blockchain transaction records are temporarily unavailable" }, { status: 503 });
  }
}
