import type { Address, Hex } from "viem";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import smartPay5ArtifactJson from "../contracts/artifacts/SmartPay5.json";
import { cryptoRpc } from "./crypto-rpc";
import { SMARTPAY5_ABI, SMARTPAY5_TRANSACTION_RECORDED_TOPIC } from "./smartpay5";
import { locateSmartPay5Receipt } from "./smartpay5-receipt-locator";

type ContractTransactionRecord = {
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

type ContractPaymentRule = {
  primaryTokenAddress: Address;
  secondaryTokenAddress: Address;
  mainId: string;
  secondId: string;
  primaryTokenAmount: bigint;
  secondaryTokenAmount: bigint;
  minimumSecondaryBalance: bigint;
  enabled: boolean;
};

async function ethCall(rpcUrl: string, contract: Address, functionName: string, args: readonly unknown[] = []) {
  const data = encodeFunctionData({ abi: SMARTPAY5_ABI, functionName, args });
  return cryptoRpc<Hex>(rpcUrl, "eth_call", [{ to: contract, data }, "latest"]);
}

function mapTransactions(records: ContractTransactionRecord[]) {
  return records.map(record => ({
    transactionId: record.transactionId,
    timestamp: Number(record.timestamp),
    wallet: record.wallet,
    payerId: record.payerId,
    refId: record.refId,
    mainId: record.mainId,
    secondId: record.secondId,
    primaryTokenAddress: record.primaryTokenAddress,
    primaryTokenAmount: record.primaryTokenAmount.toString(),
    secondaryTokenAddress: record.secondaryTokenAddress,
    secondaryTokenAmount: record.secondaryTokenAmount.toString()
  }));
}

export async function smartPay5TransactionById(rpcUrl: string, contract: Address, transactionId: Hex) {
  const data = await ethCall(rpcUrl, contract, "transactionById", [transactionId]);
  const record = decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "transactionById", data }) as ContractTransactionRecord;
  return mapTransactions([record])[0];
}

export async function smartPay5ReceiptByTransactionId(input: {
  rpcUrl: string;
  contract: Address;
  transactionId: Hex;
  timestamp: number;
}) {
  return locateSmartPay5Receipt({
    rpc: <T>(method: string, params: unknown[]) =>
      cryptoRpc<T>(input.rpcUrl, method, params),
    contract: input.contract,
    transactionId: input.transactionId,
    transactionTopic: SMARTPAY5_TRANSACTION_RECORDED_TOPIC,
    timestamp: input.timestamp,
  });
}

export async function smartPay5PayoutConfigurationRaw(rpcUrl: string, contract: Address) {
  const data = await ethCall(rpcUrl, contract, "payoutConfiguration");
  const [wallets, sharesBps] = decodeFunctionResult({
    abi: SMARTPAY5_ABI,
    functionName: "payoutConfiguration",
    data
  }) as [Address[], number[]];
  return wallets.map((wallet, index) => ({ wallet, shareBps: Number(sharesBps[index] || 0) }));
}

export async function smartPay5PaymentRules(rpcUrl: string, contract: Address) {
  const countData = await ethCall(rpcUrl, contract, "paymentRuleCount");
  const count = Number(decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "paymentRuleCount", data: countData }) as bigint);
  const records: ContractPaymentRule[] = [];
  for (let offset = 0; offset < count; offset += 100) {
    const pageData = await ethCall(rpcUrl, contract, "paymentRules", [BigInt(offset), BigInt(Math.min(100, count - offset))]);
    records.push(...decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "paymentRules", data: pageData }) as ContractPaymentRule[]);
  }
  return records.map(record => ({
    primaryTokenAddress: record.primaryTokenAddress,
    secondaryTokenAddress: record.secondaryTokenAddress,
    mainId: record.mainId,
    secondId: record.secondId,
    primaryTokenAmount: record.primaryTokenAmount.toString(),
    secondaryTokenAmount: record.secondaryTokenAmount.toString(),
    minimumSecondaryBalance: record.minimumSecondaryBalance.toString(),
    enabled: record.enabled
  }));
}

export async function smartPay5LatestTransactions(input: {
  rpcUrl: string;
  contract: Address;
  payerId?: string;
  maxCount: number;
}) {
  if (!Number.isInteger(input.maxCount) || input.maxCount < 1 || input.maxCount > 100) {
    throw new Error("INVALID_SMARTPAY5_LATEST_COUNT");
  }
  const functionName = input.payerId ? "getTransactionsByPayerID" : "getLatestTransactions";
  const args = input.payerId ? [input.payerId, BigInt(input.maxCount)] : [BigInt(input.maxCount)];
  const data = await ethCall(input.rpcUrl, input.contract, functionName, args);
  const [records, total] = decodeFunctionResult({
    abi: SMARTPAY5_ABI,
    functionName,
    data
  }) as [ContractTransactionRecord[], bigint];
  return { transactions: mapTransactions(records), totalTransactions: Number(total) };
}

export async function smartPay5Ownership(rpcUrl: string, contract: Address) {
  const [ownerData, pausedData] = await Promise.all([
    ethCall(rpcUrl, contract, "owner"),
    ethCall(rpcUrl, contract, "paused")
  ]);
  return {
    owner: decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "owner", data: ownerData }) as Address,
    paused: decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "paused", data: pausedData }) as boolean
  };
}

export async function verifySmartPay5Identity(rpcUrl: string, contract: Address) {
  const code = await cryptoRpc<string>(rpcUrl, "eth_getCode", [contract, "latest"]);
  if (!code || code === "0x") throw new Error("CONTRACT_CODE_NOT_FOUND");
  const expectedCode = String((smartPay5ArtifactJson as { deployedBytecode?: string }).deployedBytecode || "");
  if (!expectedCode || code.toLowerCase() !== expectedCode.toLowerCase()) throw new Error("CONTRACT_IDENTITY_MISMATCH");
  const [ownership, basicData, intermediateData, advancedData] = await Promise.all([
    smartPay5Ownership(rpcUrl, contract),
    ethCall(rpcUrl, contract, "MAIN_ID_BASIC_3_MONTH"),
    ethCall(rpcUrl, contract, "MAIN_ID_INTERMEDIATE_3_MONTH"),
    ethCall(rpcUrl, contract, "MAIN_ID_ADVANCED_3_MONTH")
  ]);
  const ids = [
    decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "MAIN_ID_BASIC_3_MONTH", data: basicData }) as string,
    decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "MAIN_ID_INTERMEDIATE_3_MONTH", data: intermediateData }) as string,
    decodeFunctionResult({ abi: SMARTPAY5_ABI, functionName: "MAIN_ID_ADVANCED_3_MONTH", data: advancedData }) as string
  ];
  if (ids.join("|") !== "smartlingo_course_basic_3m|smartlingo_course_intermediate_3m|smartlingo_course_advanced_3m") {
    throw new Error("CONTRACT_IDENTITY_MISMATCH");
  }
  return { ...ownership, mainIds: ids, upgradeRequired: false };
}
