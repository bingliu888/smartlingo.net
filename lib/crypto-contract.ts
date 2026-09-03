import type { SmartLingoPackageTier } from "./smartlingo-course-packages";

export type CryptoPlanId = SmartLingoPackageTier;
export const CRYPTO_PLANS = [
  { id: "basic", months: 3, priceCents: 3_000, name: "Beginner · 3 months" },
  { id: "intermediate", months: 3, priceCents: 6_000, name: "Intermediate · 3 months" },
  { id: "advanced", months: 3, priceCents: 12_000, name: "Advanced · 3 months" },
] as const;

export type CryptoPaymentSetting = {
  id: string; label: string; chainType: "evm"; chainName: string; chainId: number;
  tokenSymbol: string; tokenContract: string; tokenDecimals: number; receiverWallet: string;
  smartPay5Contract: string | null; smartPay5UsdtPercent: number;
  basicAmountCents: number; intermediateAmountCents: number; advancedAmountCents: number;
  basicTokenAmount: string; intermediateTokenAmount: string; advancedTokenAmount: string;
  minConfirmations: number; walletConnectProjectId: string | null; enabled: number;
};

export function explorerUrl(chainId: number, kind: "address" | "token" | "tx", value: string) {
  const bases: Record<number, string> = { 1: "https://etherscan.io", 56: "https://bscscan.com", 137: "https://polygonscan.com", 8453: "https://basescan.org" };
  const valid = kind === "tx" ? /^0x[a-fA-F0-9]{64}$/.test(value) : /^0x[a-fA-F0-9]{40}$/.test(value);
  return bases[chainId] && valid ? `${bases[chainId]}/${kind}/${value}` : null;
}
