import type { Address } from "viem";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { cryptoRpcUrl } from "@/lib/crypto-rpc";
import { cryptoPaymentSettingById } from "@/lib/crypto-payments";
import { currentSmartPayCheckoutOption } from "@/lib/smartpay-checkout-server";
import { smartLingoProductOwnerRefId } from "@/lib/smartpay-product-owner";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "@/lib/smartpay-refid";
import { smartPay4LatestTransactions } from "@/lib/smartpay4-server";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    settingId?: string;
    classId?: string;
    includeClaimed?: boolean;
  } | null;
  const settingId = String(body?.settingId || "");
  const classId = String(body?.classId || "");
  const [setting, option, payerId, productOwnerRefId] = await Promise.all([
    cryptoPaymentSettingById(settingId),
    currentSmartPayCheckoutOption(settingId, classId),
    ensureSmartPayRefId(user.id),
    smartLingoProductOwnerRefId(),
  ]);
  if (!setting?.smartPay4Contract || !option) {
    return Response.json({ error: "Choose a course payment option" }, { status: 400 });
  }
  try {
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    const latest = await smartPay4LatestTransactions({
      rpcUrl,
      contract: setting.smartPay4Contract as Address,
      payerId,
      maxCount: 100,
    });
    for (const record of latest.transactions) {
      if (record.mainId !== option.mainId || record.secondId !== option.secondId
        || normalizeSmartPayRefId(record.payerId) !== normalizeSmartPayRefId(payerId)
        || normalizeSmartPayRefId(record.refId) !== normalizeSmartPayRefId(productOwnerRefId)) continue;
      const claim = await getDatabase().prepare(`SELECT user_id AS userId,
        current_period_ends_at AS currentPeriodEnd FROM smartpay4_payment_claims
        WHERE lower(contract_address)=lower(?) AND lower(transaction_id)=lower(?) LIMIT 1`)
        .bind(setting.smartPay4Contract, record.transactionId)
        .first<{ userId: string; currentPeriodEnd: number }>();
      if (claim && !body?.includeClaimed) continue;
      if (claim && claim.userId !== user.id) continue;
      return Response.json({
        txHash: record.transactionId,
        paymentId: record.transactionId,
        claimed: Boolean(claim),
        verified: Boolean(claim),
        timestamp: record.timestamp,
        currentPeriodEnd: claim?.currentPeriodEnd || null,
      });
    }
    return Response.json({ error: "No matching unclaimed payment was found" }, { status: 404 });
  } catch {
    return Response.json({ error: "Recent payment lookup is temporarily unavailable" }, { status: 503 });
  }
}
