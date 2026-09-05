import { isAddress, type Address } from "viem";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { cryptoRpcUrl } from "@/lib/crypto-rpc";
import { cryptoPaymentSettingById } from "@/lib/crypto-payments";
import { currentSmartPayCheckoutOption } from "@/lib/smartpay-checkout-server";
import { smartLingoProductOwnerRefId } from "@/lib/smartpay-product-owner";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "@/lib/smartpay-refid";
import { smartPay5LatestTransactions } from "@/lib/smartpay5-server";

type ClaimRow = { transactionId: string; userId: string; currentPeriodEnd: number };

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    const limited = await consumeAccountRequestLimit({
      request,
      scope: "smartpay-find-payment",
      userId: user.id,
      limit: 12,
      windowSeconds: 60,
      unavailableMessage: "Payment protection is temporarily unavailable.",
    });
    if (limited) return limited;
    const body = await boundedJsonBody<{
      settingId?: string;
      classId?: string;
      includeClaimed?: boolean;
    }>(request, 4 * 1024);
    const settingId = String(body.settingId || "");
    const classId = String(body.classId || "");
    const [setting, option, payerId, productOwnerRefId] = await Promise.all([
      cryptoPaymentSettingById(settingId),
      currentSmartPayCheckoutOption(settingId, classId),
      ensureSmartPayRefId(user.id),
      smartLingoProductOwnerRefId(),
    ]);
    if (!setting?.smartPay5Contract || !isAddress(setting.smartPay5Contract) || !option
      || option.contractAddress.toLowerCase() !== setting.smartPay5Contract.toLowerCase()) {
      return Response.json({ error: "Choose a course payment option" }, { status: 400 });
    }
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    const latest = await smartPay5LatestTransactions({
      rpcUrl,
      contract: setting.smartPay5Contract as Address,
      payerId,
      maxCount: 100,
    });
    const candidates = latest.transactions.filter(record => record.mainId === option.mainId
      && record.secondId === option.secondId
      && normalizeSmartPayRefId(record.payerId) === normalizeSmartPayRefId(payerId)
      && normalizeSmartPayRefId(record.refId) === normalizeSmartPayRefId(productOwnerRefId)
      && record.primaryTokenAddress.toLowerCase() === option.smartPay5Offer.primaryTokenAddress.toLowerCase()
      && record.secondaryTokenAddress.toLowerCase() === option.smartPay5Offer.secondaryTokenAddress.toLowerCase());
    const claims = new Map<string, ClaimRow>();
    if (candidates.length) {
      const placeholders = candidates.map(() => "?").join(",");
      const rows = await getDatabase().prepare(`SELECT transaction_id AS transactionId,user_id AS userId,
        current_period_ends_at AS currentPeriodEnd FROM smartpay5_payment_claims
        WHERE lower(contract_address)=lower(?) AND lower(transaction_id) IN (${placeholders})`)
        .bind(setting.smartPay5Contract, ...candidates.map(record => record.transactionId.toLowerCase()))
        .all<ClaimRow>();
      for (const claim of rows.results || []) claims.set(claim.transactionId.toLowerCase(), claim);
    }
    for (const record of candidates) {
      const claim = claims.get(record.transactionId.toLowerCase());
      if (claim && body.includeClaimed !== true) continue;
      if (claim && claim.userId !== user.id) continue;
      return Response.json({
        paymentId: record.transactionId,
        claimed: Boolean(claim),
        verified: Boolean(claim),
        timestamp: record.timestamp,
        currentPeriodEnd: claim?.currentPeriodEnd || null,
      }, { headers: { "cache-control": "private, no-store" } });
    }
    return Response.json({ error: "No matching unclaimed payment was found" }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "Recent payment lookup is temporarily unavailable" }, { status: 503 });
  }
}
