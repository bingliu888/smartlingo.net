import { isAddress, type Address } from "viem";
import { isPermanentAdmin } from "@/lib/admin-access";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { cryptoRpcUrl } from "@/lib/crypto-rpc";
import { activeCryptoPaymentSettings, cryptoPaymentSettingById } from "@/lib/crypto-payments";
import { smartLingoProductOwnerRefId } from "@/lib/smartpay-product-owner";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "@/lib/smartpay-refid";
import { smartPay4LatestTransactions, verifySmartPay4Identity } from "@/lib/smartpay4-server";
import { smartPay4ExpectedTokenPair } from "@/lib/smartpay4-presets";

export const dynamic = "force-dynamic";

type ClaimRow = { transactionId: string; userId: string; currentPeriodEnd: number };
type MatchedMember = { id: string; email: string; displayName: string; payerId: string };

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const url = new URL(request.url);
  const setting = await cryptoPaymentSettingById(url.searchParams.get("settingId") || "");
  if (!setting?.smartPay4Contract || !isAddress(setting.smartPay4Contract)) {
    return Response.json({ error: "On-chain course payment is not configured for this token" }, { status: 409 });
  }
  const database = getDatabase();
  const admin = isPermanentAdmin(user);
  const ownPayerId = await ensureSmartPayRefId(user.id);
  const payerIdParam = String(url.searchParams.get("payerId") || "").trim().toUpperCase();
  const requestedPayerId = admin ? payerIdParam : ownPayerId;
  const latestMode = admin && !requestedPayerId;
  if (!latestMode && !/^[A-HJ-NP-Z2-9]{6}$/.test(requestedPayerId)) {
    return Response.json({ error: "Enter a valid six-character PayerID" }, { status: 400 });
  }
  if (!admin && payerIdParam && payerIdParam !== ownPayerId) {
    return Response.json({ error: "You may only query your own PayerID" }, { status: 403 });
  }
  try {
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    const contract = setting.smartPay4Contract as Address;
    await verifySmartPay4Identity(rpcUrl, contract);
    const requestedLimit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25) || 25));
    const maxCount = latestMode ? Math.min(25, requestedLimit) : requestedLimit;
    const latest = await smartPay4LatestTransactions({
      rpcUrl,
      contract,
      payerId: latestMode ? undefined : requestedPayerId,
      maxCount,
    });
    const claims = new Map<string, ClaimRow>();
    if (latest.transactions.length) {
      const placeholders = latest.transactions.map(() => "?").join(",");
      const rows = await database.prepare(`SELECT transaction_id AS transactionId,user_id AS userId,
          current_period_ends_at AS currentPeriodEnd FROM smartpay4_payment_claims
        WHERE lower(contract_address)=lower(?) AND lower(transaction_id) IN (${placeholders})`)
        .bind(contract, ...latest.transactions.map(item => item.transactionId.toLowerCase()))
        .all<ClaimRow>();
      for (const row of rows.results || []) claims.set(row.transactionId.toLowerCase(), row);
    }
    const matchedMembers: MatchedMember[] = [];
    if (admin) {
      const payerIds = [...new Set((latestMode ? latest.transactions.map(item => item.payerId) : [requestedPayerId])
        .map(normalizeSmartPayRefId).filter(Boolean))];
      for (const payerId of payerIds) {
        const rows = await database.prepare(`SELECT u.id,u.email,u.display_name AS displayName,r.ref_id AS payerId
          FROM smartpay_ref_ids r JOIN users u ON u.id=r.user_id
          WHERE lower(r.ref_id)=lower(?) LIMIT 10`).bind(payerId).all<MatchedMember>();
        matchedMembers.push(...(rows.results || []));
      }
    }
    const productOwnerRefId = await smartLingoProductOwnerRefId();
    const settings = await activeCryptoPaymentSettings();
    const transactions = latest.transactions.map(record => {
      const claim = claims.get(record.transactionId.toLowerCase());
      const matchedSetting = settings.find(candidate => {
        if (candidate.chainId !== setting.chainId
          || candidate.smartPay4Contract?.toLowerCase() !== contract.toLowerCase()
          || candidate.tokenContract.toLowerCase() !== record.primaryTokenAddress.toLowerCase()) return false;
        const pair = smartPay4ExpectedTokenPair(settings, candidate);
        return pair?.secondaryTokenAddress.toLowerCase() === record.secondaryTokenAddress.toLowerCase();
      }) || null;
      return {
        ...record,
        settingId: matchedSetting?.id || null,
        siteOwned: normalizeSmartPayRefId(record.refId) === normalizeSmartPayRefId(productOwnerRefId),
        subscriptionRecorded: Boolean(claim),
        subscriptionEndsAt: claim?.currentPeriodEnd || null,
        claimedMemberId: claim?.userId || null,
      };
    }).filter(record => admin || (
      normalizeSmartPayRefId(record.payerId) === normalizeSmartPayRefId(ownPayerId)
      && normalizeSmartPayRefId(record.refId) === normalizeSmartPayRefId(productOwnerRefId)
      && Boolean(record.settingId)
      && !record.subscriptionRecorded
    ));
    return Response.json({
      payerId: latestMode ? null : requestedPayerId,
      mode: latestMode ? "latest" : "payer",
      totalTransactions: admin ? latest.totalTransactions : transactions.length,
      transactions,
      matchedMembers,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.warn("SmartPay4 transaction lookup failed", error instanceof Error ? error.message.slice(0, 160) : "unknown");
    return Response.json({ error: "Blockchain transaction records are temporarily unavailable" }, { status: 503 });
  }
}
