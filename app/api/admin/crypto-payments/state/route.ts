import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { atomicTokenAmountToDisplay } from "../../../../../lib/crypto-amount";
import { cryptoRpcUrl } from "../../../../../lib/crypto-rpc";
import { cryptoSettingById } from "../../../../../lib/crypto-settings";
import { requirePermanentAdmin } from "../../../../../lib/member";
import { erc20ContractDetails } from "../../../../../lib/erc20-server";
import {
  smartPay3LatestTransactions,
  smartPay3PaymentRules,
  smartPay3PayoutConfigurationRaw,
  verifySmartPay3Identity
} from "../../../../../lib/smartpay3-server";

export const dynamic = "force-dynamic";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function GET(request: Request) {
  try {
    await requirePermanentAdmin();
    const params = new URL(request.url).searchParams;
    const setting = await cryptoSettingById(String(params.get("settingId") || ""));
    if (!setting) return NextResponse.json({ error: "Select an active payment rail" }, { status: 400 });
    const configuredContract = setting.smartPay3Contract;
    if (!configuredContract || !isAddress(configuredContract)) {
      return NextResponse.json({ error: "SmartPay3 is not configured for this payment rail" }, { status: 409 });
    }
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    if (!rpcUrl) return NextResponse.json({ error: "Blockchain RPC is not configured for this network" }, { status: 503 });
    const contract = configuredContract as Address;
    const identity = await verifySmartPay3Identity(rpcUrl, contract);
    const [payouts, rules, latest] = await Promise.all([
      smartPay3PayoutConfigurationRaw(rpcUrl, contract),
      smartPay3PaymentRules(rpcUrl, contract),
      smartPay3LatestTransactions({ rpcUrl, contract, maxCount: 25 })
    ]);
    const tokenAddresses = [...new Set(rules.flatMap(rule => [
      rule.primaryTokenAddress.toLowerCase(),
      rule.secondaryTokenAddress.toLowerCase()
    ]).filter(Boolean))]
      .filter(value => value !== ZERO_ADDRESS && isAddress(value)) as Address[];
    const tokenEntries = await Promise.all(tokenAddresses.map(async tokenAddress => [
      tokenAddress.toLowerCase(),
      await erc20ContractDetails(rpcUrl, tokenAddress, contract)
    ] as const));
    const tokens = Object.fromEntries(tokenEntries);
    return NextResponse.json({
      setting,
      contract,
      owner: identity.owner,
      paused: identity.paused,
      upgradeRequired: false,
      transactionReadReady: true,
      payouts,
      rules: rules.map(rule => {
        const primary = tokens[rule.primaryTokenAddress.toLowerCase()];
        const hasSecondary = rule.secondaryTokenAddress.toLowerCase() !== ZERO_ADDRESS;
        const secondary = hasSecondary ? tokens[rule.secondaryTokenAddress.toLowerCase()] : null;
        return {
          ...rule,
          primaryTokenSymbol: primary?.symbol || "ERC-20",
          primaryTokenDecimals: primary?.decimals ?? 18,
          primaryTokenAmountDisplay: atomicTokenAmountToDisplay(rule.primaryTokenAmount, primary?.decimals ?? 18),
          secondaryTokenSymbol: hasSecondary ? secondary?.symbol || "ERC-20" : "",
          secondaryTokenDecimals: hasSecondary ? secondary?.decimals ?? 18 : 0,
          secondaryTokenAmountDisplay: hasSecondary
            ? atomicTokenAmountToDisplay(rule.secondaryTokenAmount, secondary?.decimals ?? 18)
            : "0",
          minimumSecondaryBalanceDisplay: hasSecondary
            ? atomicTokenAmountToDisplay(rule.minimumSecondaryBalance, secondary?.decimals ?? 18)
            : "0"
        };
      }),
      tokens,
      totalTransactions: latest.totalTransactions,
      latestTransactions: latest.transactions
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.warn("SmartPay admin state lookup failed", error instanceof Error ? error.message.slice(0, 160) : "unknown");
    return NextResponse.json({ error: "Unable to read SmartPay contract state" }, { status: 502 });
  }
}
