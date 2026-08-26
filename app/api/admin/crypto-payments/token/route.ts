import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { cryptoRpcUrl } from "../../../../../lib/crypto-rpc";
import { cryptoSettingById } from "../../../../../lib/crypto-settings";
import { requirePermanentAdmin } from "../../../../../lib/member";
import { erc20ContractDetails } from "../../../../../lib/erc20-server";
import { smartPay3PaymentRules } from "../../../../../lib/smartpay3-server";

export const dynamic = "force-dynamic";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function GET(request: Request) {
  try {
    await requirePermanentAdmin();
    const params = new URL(request.url).searchParams;
    const setting = await cryptoSettingById(String(params.get("settingId") || ""));
    if (!setting) return NextResponse.json({ error: "Select an active payment rail" }, { status: 400 });
    const configuredContract = setting.smartPay3Contract;
    const tokenAddress = String(params.get("tokenAddress") || "").toLowerCase();
    if (!configuredContract || !isAddress(configuredContract) || !isAddress(tokenAddress)) {
      return NextResponse.json({ error: "Select a contract and enter a valid ERC-20 token address" }, { status: 400 });
    }
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    if (!rpcUrl) return NextResponse.json({ error: "Blockchain RPC is not configured for this network" }, { status: 503 });
    const rules = await smartPay3PaymentRules(rpcUrl, configuredContract as Address);
    const permittedTokens = [...new Set(rules.flatMap(rule =>
      [rule.primaryTokenAddress.toLowerCase(), rule.secondaryTokenAddress.toLowerCase()]))]
      .filter(address => address !== ZERO_ADDRESS);
    if (!permittedTokens.includes(tokenAddress)) {
      return NextResponse.json({ error: "Select a token from an enabled SmartPay3 on-chain payment rule" }, { status: 422 });
    }
    const token = await erc20ContractDetails(rpcUrl, tokenAddress as Address, configuredContract as Address);
    return NextResponse.json({ tokenAddress, ...token });
  } catch (error) {
    if (error instanceof Response) return error;
    console.warn("ERC-20 administrator lookup failed", error instanceof Error ? error.message.slice(0, 160) : "unknown");
    return NextResponse.json({ error: "Unable to read this ERC-20 token" }, { status: 502 });
  }
}
