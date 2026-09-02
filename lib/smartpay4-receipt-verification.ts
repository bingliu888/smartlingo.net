import { decodeEventLog, type Hex } from "viem";
import {
  decodeSmartPay4TransactionLog,
  SMARTPAY4_ABI,
  SMARTPAY4_PAYOUT_EXECUTED_TOPIC,
  SMARTPAY4_TRANSACTION_RECORDED_TOPIC,
  type SmartPay4TransactionEvent,
} from "./smartpay4";
import { smartPayRecipientMatches } from "./smartpay-reconciliation";
import type { SmartPay4ReceiptLog } from "./smartpay4-receipt-locator";

export type { SmartPay4ReceiptLog } from "./smartpay4-receipt-locator";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const addressTopic = (address: string) =>
  `0x${address.toLowerCase().slice(2).padStart(64, "0")}`;

function matchesAmount(value: string | undefined, amount: bigint) {
  if (!value) return false;
  try { return BigInt(value) === amount; } catch { return false; }
}

function matchingTransfer(
  logs: SmartPay4ReceiptLog[],
  token: string,
  payer: string,
  wallet: string,
  amount: bigint,
) {
  return logs.find((item) => item.address?.toLowerCase() === token
    && item.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC
    && item.topics?.[1]?.toLowerCase() === addressTopic(payer)
    && item.topics?.[2]?.toLowerCase() === addressTopic(wallet)
    && matchesAmount(item.data, amount));
}

function payoutRows(logs: SmartPay4ReceiptLog[], contract: string, transactionId: string) {
  return logs.flatMap((item) => {
    if (item.address?.toLowerCase() !== contract
      || item.topics?.[0]?.toLowerCase() !== SMARTPAY4_PAYOUT_EXECUTED_TOPIC.toLowerCase()
      || item.topics?.[1]?.toLowerCase() !== transactionId.toLowerCase()
      || !item.data || !item.topics) return [];
    try {
      const decoded = decodeEventLog({
        abi: SMARTPAY4_ABI,
        eventName: "PayoutExecuted",
        data: item.data as Hex,
        topics: item.topics as [Hex, ...Hex[]],
        strict: true,
      });
      const args = decoded.args as unknown as {
        tokenAddress: string;
        wallet: string;
        tokenAmount: bigint;
      };
      return [{
        token: args.tokenAddress.toLowerCase(),
        wallet: args.wallet.toLowerCase(),
        amount: args.tokenAmount,
      }];
    } catch { return []; }
  });
}

export function verifySmartPay4Receipt(input: {
  logs: SmartPay4ReceiptLog[];
  contract: string;
  payer: string;
  payerId: string;
  primaryToken: string;
  secondaryToken: string;
  mainId: string;
  secondId: string;
  refId: string;
  transactionId: string;
}) {
  const contract = input.contract.toLowerCase();
  const payer = input.payer.toLowerCase();
  const primaryToken = input.primaryToken.toLowerCase();
  const secondaryToken = input.secondaryToken.toLowerCase();
  const paymentLogs = input.logs.filter((item) =>
    item.address?.toLowerCase() === contract
      && item.topics?.[0]?.toLowerCase() === SMARTPAY4_TRANSACTION_RECORDED_TOPIC.toLowerCase());
  if (paymentLogs.length !== 1 || !paymentLogs[0].data || !paymentLogs[0].topics)
    return { ok: false as const, reason: "transaction-log" };
  let payment: SmartPay4TransactionEvent;
  try {
    payment = decodeSmartPay4TransactionLog({
      data: paymentLogs[0].data as Hex,
      topics: paymentLogs[0].topics as Hex[],
    });
  } catch {
    return { ok: false as const, reason: "transaction-log" };
  }
  if (payment.transactionId.toLowerCase() !== input.transactionId.toLowerCase()
    || !smartPayRecipientMatches(payment, input.payerId, input.refId)
    || payment.primaryTokenAddress.toLowerCase() !== primaryToken
    || payment.secondaryTokenAddress.toLowerCase() !== secondaryToken
    || payment.mainId !== input.mainId || payment.secondId !== input.secondId)
    return { ok: false as const, reason: "identity" };
  const payouts = payoutRows(input.logs, contract, payment.transactionId);
  if (payouts.length < 1 || payouts.length > 10
    || payouts.some((item) => item.token !== primaryToken && item.token !== secondaryToken))
    return { ok: false as const, reason: "payouts" };
  const payoutKeys = new Set(payouts.map((item) => `${item.token}:${item.wallet}`));
  if (payoutKeys.size !== payouts.length)
    return { ok: false as const, reason: "payouts" };
  for (const [token, amount] of [
    [primaryToken, payment.primaryTokenAmount],
    [secondaryToken, payment.secondaryTokenAmount],
  ] as Array<[string, bigint]>) {
    const rows = payouts.filter((item) => item.token === token);
    if (amount === 0n) {
      if (rows.length) return { ok: false as const, reason: "payouts" };
      continue;
    }
    if (!rows.length || rows.length > 5
      || rows.reduce((sum, item) => sum + item.amount, 0n) !== amount)
      return { ok: false as const, reason: "payouts" };
    if (rows.some((item) =>
      !matchingTransfer(input.logs, token, payer, item.wallet, item.amount)))
      return { ok: false as const, reason: "transfers" };
  }
  return { ok: true as const, payment };
}
