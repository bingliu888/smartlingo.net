import type { Abi, Address, Hex } from "viem";
import { decodeEventLog, toEventSelector } from "viem";
import smartPay4AbiJson from "../contracts/abi/SmartPay4.json";

export const SMARTPAY4_ABI = smartPay4AbiJson as Abi;
export const SMARTPAY4_TRANSACTION_RECORDED_TOPIC = toEventSelector(
  "TransactionRecorded(bytes32,uint64,address,string,string,string,string,address,uint256,address,uint256)"
);
export const SMARTPAY4_PAYOUT_EXECUTED_TOPIC = toEventSelector(
  "PayoutExecuted(bytes32,address,address,uint256)"
);

export type SmartPay4TransactionEvent = {
  transactionId: Hex;
  timestamp: bigint;
  wallet: Address;
  payerId: string;
  refId: string;
  mainId: string;
  secondId: string;
  primaryTokenAddress: Address;
  primaryTokenAmount: bigint;
  secondaryTokenAddress: Address;
  secondaryTokenAmount: bigint;
};

export function decodeSmartPay4TransactionLog(log: { data: Hex; topics: readonly Hex[] }) {
  if (!log.topics.length) throw new Error("MISSING_EVENT_TOPICS");
  const decoded = decodeEventLog({
    abi: SMARTPAY4_ABI,
    eventName: "TransactionRecorded",
    data: log.data,
    topics: log.topics as [Hex, ...Hex[]],
    strict: true
  });
  return decoded.args as unknown as SmartPay4TransactionEvent;
}
