import { toEventSelector, type Hex } from "viem";
import type { SmartPay5ReceiptLog } from "./smartpay5-receipt-locator";

const SMARTPAY5_TRANSACTION_RECORDED_TOPIC = toEventSelector(
  "TransactionRecorded(bytes32,uint64,address,string,string,string,string,address,uint256,address,uint256)"
);

export function smartPay5TransactionIdFromReceipt(logs: SmartPay5ReceiptLog[], contractAddress: string): Hex | null {
  const contract = contractAddress.toLowerCase();
  const matches = logs.filter(log => log.address?.toLowerCase() === contract
    && log.topics?.[0]?.toLowerCase() === SMARTPAY5_TRANSACTION_RECORDED_TOPIC.toLowerCase());
  if (matches.length !== 1) return null;
  const transactionId = matches[0]?.topics?.[1];
  return transactionId && /^0x[\da-f]{64}$/i.test(transactionId) ? transactionId as Hex : null;
}
