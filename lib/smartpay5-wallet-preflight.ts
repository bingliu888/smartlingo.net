"use client";

import { decodeFunctionResult, encodeFunctionData, type Address, type Hex } from "viem";
import type { EthereumProvider } from "./evm-wallet-client";
import { bufferedWalletGasLimit, walletRpcErrorData } from "./wallet-rpc";

const ERC20_READ_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }
] as const;

const SMARTPAY5_PAY_ABI = [{
  type: "function", name: "pay", stateMutability: "nonpayable",
  inputs: [
    { name: "primaryTokenAddress", type: "address" },
    { name: "secondaryTokenAddress", type: "address" },
    { name: "mainId", type: "string" },
    { name: "secondId", type: "string" },
    { name: "primaryTokenAmount", type: "uint256" },
    { name: "refId", type: "string" },
    { name: "payerId", type: "string" }
  ],
  outputs: [{ name: "transactionId", type: "bytes32" }]
}] as const;

export type SmartPay5WalletPreflight = {
  primaryBalanceAtomic: string;
  secondaryBalanceAtomic: string;
  nativeBalanceAtomic: string;
  primaryAllowanceAtomic: string;
  secondaryAllowanceAtomic: string;
  primaryEnough: boolean;
  secondaryEnough: boolean;
  eligibilityMet: boolean;
  gasEnough: boolean | null;
  nextAction: "approve-primary" | "approve-secondary" | "pay";
  gasLimit: Hex | null;
  estimatedFeeAtomic: string | null;
  simulationError: string | null;
};

const asHexBigInt = (value: unknown, reason: string) => {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) throw new Error(reason);
  return BigInt(value);
};

const readUint = (value: unknown, functionName: "balanceOf" | "allowance") => {
  if (typeof value !== "string") throw new Error("SMARTPAY5_BALANCE_READ_FAILED");
  return decodeFunctionResult({ abi: ERC20_READ_ABI, functionName, data: value as Hex }) as bigint;
};

export async function readSmartPay5WalletPreflight(input: {
  provider: EthereumProvider;
  wallet: Address;
  contractAddress: Address;
  primaryTokenAddress: Address;
  secondaryTokenAddress: Address;
  primaryRequired: bigint;
  secondaryRequired: bigint;
  minimumSecondaryBalance: bigint;
  mainId: string;
  secondId: string;
  refId: string;
  payerId: string;
}): Promise<SmartPay5WalletPreflight> {
  const balanceData = encodeFunctionData({ abi: ERC20_READ_ABI, functionName: "balanceOf", args: [input.wallet] });
  const allowanceData = encodeFunctionData({ abi: ERC20_READ_ABI, functionName: "allowance", args: [input.wallet, input.contractAddress] });
  const needsSecondary = input.secondaryRequired > 0n;
  const [primaryBalanceRaw, primaryAllowanceRaw, secondaryReads, nativeRaw, gasPriceRaw] = await Promise.all([
    input.provider.request({ method: "eth_call", params: [{ to: input.primaryTokenAddress, data: balanceData }, "latest"] }),
    input.provider.request({ method: "eth_call", params: [{ to: input.primaryTokenAddress, data: allowanceData }, "latest"] }),
    needsSecondary ? Promise.all([
      input.provider.request({ method: "eth_call", params: [{ to: input.secondaryTokenAddress, data: balanceData }, "latest"] }),
      input.provider.request({ method: "eth_call", params: [{ to: input.secondaryTokenAddress, data: allowanceData }, "latest"] })
    ]) : Promise.resolve([null, null]),
    input.provider.request({ method: "eth_getBalance", params: [input.wallet, "latest"] }),
    input.provider.request({ method: "eth_gasPrice" })
  ]);
  const primaryBalance = readUint(primaryBalanceRaw, "balanceOf");
  const primaryAllowance = readUint(primaryAllowanceRaw, "allowance");
  const secondaryBalance = needsSecondary ? readUint(secondaryReads[0], "balanceOf") : 0n;
  const secondaryAllowance = needsSecondary ? readUint(secondaryReads[1], "allowance") : 0n;
  const nativeBalance = asHexBigInt(nativeRaw, "SMARTPAY5_NATIVE_BALANCE_READ_FAILED");
  const gasPrice = asHexBigInt(gasPriceRaw, "SMARTPAY5_GAS_PRICE_READ_FAILED");
  const primaryEnough = primaryBalance >= input.primaryRequired;
  const secondaryEnough = secondaryBalance >= input.secondaryRequired;
  const eligibilityMet = input.secondaryRequired === 0n || (secondaryBalance >= input.minimumSecondaryBalance && secondaryEnough);
  const nextAction = input.primaryRequired > 0n && primaryAllowance < input.primaryRequired
    ? "approve-primary" as const
    : input.secondaryRequired > 0n && secondaryAllowance < input.secondaryRequired ? "approve-secondary" as const : "pay" as const;
  if (!primaryEnough || !eligibilityMet) return {
    primaryBalanceAtomic: primaryBalance.toString(), secondaryBalanceAtomic: secondaryBalance.toString(), nativeBalanceAtomic: nativeBalance.toString(),
    primaryAllowanceAtomic: primaryAllowance.toString(), secondaryAllowanceAtomic: secondaryAllowance.toString(), primaryEnough, secondaryEnough,
    eligibilityMet, gasEnough: nativeBalance === 0n ? false : null, nextAction, gasLimit: null, estimatedFeeAtomic: null, simulationError: null
  };
  const target = nextAction === "approve-primary" ? input.primaryTokenAddress
    : nextAction === "approve-secondary" ? input.secondaryTokenAddress : input.contractAddress;
  const data = nextAction === "approve-primary"
    ? encodeFunctionData({ abi: ERC20_READ_ABI, functionName: "approve", args: [input.contractAddress, input.primaryRequired] })
    : nextAction === "approve-secondary"
      ? encodeFunctionData({ abi: ERC20_READ_ABI, functionName: "approve", args: [input.contractAddress, input.secondaryRequired] })
      : encodeFunctionData({ abi: SMARTPAY5_PAY_ABI, functionName: "pay", args: [input.primaryTokenAddress, input.secondaryTokenAddress, input.mainId, input.secondId, input.primaryRequired, input.refId, input.payerId] });
  try {
    const estimate = await input.provider.request({ method: "eth_estimateGas", params: [{ from: input.wallet, to: target, data }] });
    const gasLimit = bufferedWalletGasLimit(estimate);
    const estimatedFee = (BigInt(gasLimit) * gasPrice * 120n + 99n) / 100n;
    return {
      primaryBalanceAtomic: primaryBalance.toString(), secondaryBalanceAtomic: secondaryBalance.toString(), nativeBalanceAtomic: nativeBalance.toString(),
      primaryAllowanceAtomic: primaryAllowance.toString(), secondaryAllowanceAtomic: secondaryAllowance.toString(), primaryEnough, secondaryEnough,
      eligibilityMet, gasEnough: nativeBalance >= estimatedFee, nextAction, gasLimit, estimatedFeeAtomic: estimatedFee.toString(), simulationError: null
    };
  } catch (error) {
    return {
      primaryBalanceAtomic: primaryBalance.toString(), secondaryBalanceAtomic: secondaryBalance.toString(), nativeBalanceAtomic: nativeBalance.toString(),
      primaryAllowanceAtomic: primaryAllowance.toString(), secondaryAllowanceAtomic: secondaryAllowance.toString(), primaryEnough, secondaryEnough,
      eligibilityMet, gasEnough: null, nextAction, gasLimit: null, estimatedFeeAtomic: null,
      simulationError: walletRpcErrorData(error) || "SMARTPAY5_GAS_ESTIMATE_FAILED"
    };
  }
}
