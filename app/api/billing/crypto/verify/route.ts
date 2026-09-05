import { isAddress, type Address } from "viem";
import { getSessionUser } from "@/lib/auth";
import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { cryptoRpc, cryptoRpcUrl } from "@/lib/crypto-rpc";
import { cryptoPaymentSettingById } from "@/lib/crypto-payments";
import { claimSmartLingoCoursePayment } from "@/lib/smartlingo-smartpay-claim";
import { smartPay5TransactionIdFromReceipt } from "@/lib/smartpay5-receipt-transaction";
import type { SmartPay5ReceiptLog } from "@/lib/smartpay5-receipt-locator";

type VerifyInput = {
  settingId?: string;
  paymentId?: string;
  txHash?: string;
  classId?: string;
  supervisorRefId?: string;
};

type Receipt = { status?: string; logs?: SmartPay5ReceiptLog[] };

export async function POST(request: Request) {
  try {
    const actor = await getSessionUser(request);
    if (!actor) return Response.json({ error: "Sign in required" }, { status: 401 });
    const limited = await consumeAccountRequestLimit({
      request,
      scope: "smartpay-verify",
      userId: actor.id,
      limit: 20,
      windowSeconds: 60,
      unavailableMessage: "Payment protection is temporarily unavailable.",
    });
    if (limited) return limited;
    const body = await boundedJsonBody<VerifyInput>(request, 8 * 1024);
    const settingId = String(body.settingId || "");
    let paymentId = String(body.paymentId || "").trim().toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(paymentId)) {
      const txHash = String(body.txHash || "").trim().toLowerCase();
      if (!/^0x[a-f0-9]{64}$/.test(txHash))
        return Response.json({ error: "Enter a valid transaction hash" }, { status: 400 });
      const setting = await cryptoPaymentSettingById(settingId);
      if (!setting?.smartPay5Contract || !isAddress(setting.smartPay5Contract))
        return Response.json({ error: "The selected on-chain course rule is unavailable" }, { status: 409 });
      const rpcUrl = await cryptoRpcUrl(setting.chainId);
      if (!rpcUrl) return Response.json({ error: "RPC_UNAVAILABLE" }, { status: 503 });
      const receipt = await cryptoRpc<Receipt>(rpcUrl, "eth_getTransactionReceipt", [txHash]);
      if (!receipt?.status) return Response.json({ error: "Transaction receipt is still propagating" }, { status: 425 });
      if (receipt.status !== "0x1") return Response.json({ error: "Transaction is not confirmed successfully" }, { status: 422 });
      paymentId = smartPay5TransactionIdFromReceipt(receipt.logs || [], setting.smartPay5Contract as Address) || "";
      if (!paymentId) return Response.json({ error: "No matching on-chain transaction was found" }, { status: 422 });
    }
    return Response.json(await claimSmartLingoCoursePayment({
      actor,
      settingId,
      transactionId: paymentId,
      classId: String(body.classId || ""),
      supervisorRefId: body.supervisorRefId || undefined,
    }));
  } catch (error) {
    if (error instanceof Response) return error;
    const reason = error instanceof Error ? error.message : "PAYMENT_VERIFICATION_FAILED";
    const pending = reason.match(/^PAYMENT_CONFIRMATIONS_PENDING:(\d+)$/);
    if (pending) return Response.json({ error: `Waiting for ${pending[1]} more confirmations` }, { status: 425 });
    const status = reason === "INVALID_TRANSACTION_ID" ? 400
      : reason === "TRANSACTION_ALREADY_CLAIMED" ? 409
        : reason.includes("UNAVAILABLE") || reason === "RPC_UNAVAILABLE" ? 503 : 422;
    return Response.json({ error: reason }, { status });
  }
}
