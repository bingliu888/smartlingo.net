import type { CryptoPaymentSetting } from "./crypto-settings";

const SMARTPAY_CHAIN_ORDER = [137, 56, 8453, 1] as const;
const SMARTPAY_CHAIN_LABELS: Record<number, string> = {
  1: "ETH",
  56: "BSC",
  137: "Polygon",
  8453: "Base"
};

export type SmartPayChainOption<T> = {
  chainId: number;
  label: string;
  setting: T | null;
};

export function smartPayChainLabel(chainId: number, fallback: string) {
  return SMARTPAY_CHAIN_LABELS[chainId] || fallback;
}

export function smartPayChainSettings<T extends Pick<CryptoPaymentSetting, "chainId" | "chainName" | "smartPay3Contract">>(settings: readonly T[]) {
  const byChain = new Map<number, T>();
  for (const setting of settings) {
    const current = byChain.get(setting.chainId);
    if (!current || (!current.smartPay3Contract && setting.smartPay3Contract)) byChain.set(setting.chainId, setting);
  }
  const rank = (chainId: number) => {
    const index = SMARTPAY_CHAIN_ORDER.indexOf(chainId as (typeof SMARTPAY_CHAIN_ORDER)[number]);
    return index === -1 ? SMARTPAY_CHAIN_ORDER.length : index;
  };
  return [...byChain.values()].sort((left, right) => rank(left.chainId) - rank(right.chainId)
    || smartPayChainLabel(left.chainId, left.chainName).localeCompare(smartPayChainLabel(right.chainId, right.chainName)));
}

export function smartPayChainOptions<T extends Pick<CryptoPaymentSetting, "chainId" | "chainName" | "smartPay3Contract">>(settings: readonly T[]): SmartPayChainOption<T>[] {
  const configured = new Map(smartPayChainSettings(settings).map(setting => [setting.chainId, setting]));
  return SMARTPAY_CHAIN_ORDER.map(chainId => ({
    chainId,
    label: SMARTPAY_CHAIN_LABELS[chainId],
    setting: configured.get(chainId) || null
  }));
}
