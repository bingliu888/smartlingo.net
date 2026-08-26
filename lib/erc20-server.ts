import type { Address, Hex } from "viem";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { cryptoRpc } from "./crypto-rpc";
import { atomicTokenAmountToDisplay } from "./crypto-amount";
import { ERC20_ABI } from "./erc20";

async function erc20Call(rpcUrl: string, tokenAddress: Address, data: Hex) {
  return cryptoRpc<Hex>(rpcUrl, "eth_call", [{ to: tokenAddress, data }, "latest"]);
}

export async function erc20ContractDetails(rpcUrl: string, tokenAddress: Address, balanceAccount?: Address) {
  const calls = [
    erc20Call(rpcUrl, tokenAddress, encodeFunctionData({ abi: ERC20_ABI, functionName: "symbol" })),
    erc20Call(rpcUrl, tokenAddress, encodeFunctionData({ abi: ERC20_ABI, functionName: "decimals" }))
  ];
  if (balanceAccount) calls.push(erc20Call(rpcUrl, tokenAddress, encodeFunctionData({ abi: ERC20_ABI, functionName: "balanceOf", args: [balanceAccount] })));
  const [symbolData, decimalsData, balanceData] = await Promise.all(calls);
  const symbol = decodeFunctionResult({ abi: ERC20_ABI, functionName: "symbol", data: symbolData }) as string;
  const decimals = Number(decodeFunctionResult({ abi: ERC20_ABI, functionName: "decimals", data: decimalsData }));
  const balance = balanceData == null ? null : decodeFunctionResult({ abi: ERC20_ABI, functionName: "balanceOf", data: balanceData }) as bigint;
  return {
    symbol,
    decimals,
    balanceAtomic: balance?.toString() ?? null,
    balance: balance == null ? null : atomicTokenAmountToDisplay(balance, decimals)
  };
}
