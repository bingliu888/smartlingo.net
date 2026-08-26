import type { SmartLingoPackageTier } from "./smartlingo-course-packages";

export type CryptoPlanId = SmartLingoPackageTier;
export const CRYPTO_PLANS = [
  { id: "basic", months: 12, priceCents: 24_000, name: "Basic · 12 months" },
  { id: "intermediate", months: 12, priceCents: 120_000, name: "Intermediate · 12 months" },
  { id: "advanced", months: 12, priceCents: 360_000, name: "Advanced · 12 months" },
] as const;

export type CryptoPaymentSetting = {
  id: string; label: string; chainType: "evm"; chainName: string; chainId: number;
  tokenSymbol: string; tokenContract: string; tokenDecimals: number; receiverWallet: string;
  smartPay3Contract: string | null; smartPay3UsdtPercent: number;
  basicAmountCents: number; intermediateAmountCents: number; advancedAmountCents: number;
  basicTokenAmount: string; intermediateTokenAmount: string; advancedTokenAmount: string;
  minConfirmations: number; walletConnectProjectId: string | null; enabled: number;
};

export function explorerUrl(chainId: number, kind: "address" | "token" | "tx", value: string) {
  const bases: Record<number, string> = { 1: "https://etherscan.io", 56: "https://bscscan.com", 137: "https://polygonscan.com", 8453: "https://basescan.org" };
  const valid = kind === "tx" ? /^0x[a-fA-F0-9]{64}$/.test(value) : /^0x[a-fA-F0-9]{40}$/.test(value);
  return bases[chainId] && valid ? `${bases[chainId]}/${kind}/${value}` : null;
}
