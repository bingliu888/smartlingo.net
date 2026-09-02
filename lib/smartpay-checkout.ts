import type { CryptoSubscriptionPlan } from "./crypto-subscription";
import type { CryptoPaymentSetting } from "./crypto-settings";

export type SmartPayCheckoutOption = {
  key: string; settingId: string; plan: CryptoSubscriptionPlan; months: 3; languageCode: string; classId: string;
  chainId: number; chainName: string; contractAddress: string; tokenAddress: string; tokenSymbol: string;
  tokenDecimals: number; tokenAmountAtomic: string; tokenAmount: string; mainId: string; secondId: string; minConfirmations: number;
  smartPay4Offer: {
    mode: "dual" | "single"; contractAddress: string;
    primaryTokenAddress: string; primaryTokenSymbol: string; primaryTokenDecimals: number;
    primaryTokenAmountAtomic: string; primaryTokenAmount: string; primaryPercent: number;
    secondaryTokenAddress: string; secondaryTokenSymbol: string; secondaryTokenDecimals: number;
    secondaryTokenAmountAtomic: string; secondaryTokenAmount: string; secondaryPercent: number;
    minimumSecondaryBalanceAtomic: string; minimumSecondaryBalance: string;
    mainId: string; secondId: string; minConfirmations: number;
  };
};

const PLAN_ORDER: CryptoSubscriptionPlan[] = ["basic", "intermediate", "advanced"];
export const smartPayAvailablePlans = (options: readonly SmartPayCheckoutOption[]) => PLAN_ORDER.filter(plan => options.some(option => option.plan === plan));
export const smartPayOptionsForPlan = (options: readonly SmartPayCheckoutOption[], plan: CryptoSubscriptionPlan) => options.filter(option => option.plan === plan);
export const smartPayOptionsForLanguage = (options: readonly SmartPayCheckoutOption[], languageCode: string, lockedCourseId?: string) =>
  options.filter(option => option.languageCode === languageCode && (!lockedCourseId || option.classId === lockedCourseId));

export function smartPayCheckoutDisplayAmount(option: SmartPayCheckoutOption, walletOfferEligible = false) {
  const offer = option.smartPay4Offer;
  if (!walletOfferEligible) return `${option.tokenAmount} ${option.tokenSymbol}`;
  return [
    BigInt(offer.primaryTokenAmountAtomic) > 0n ? `${offer.primaryTokenAmount} ${offer.primaryTokenSymbol}` : "",
    BigInt(offer.secondaryTokenAmountAtomic) > 0n ? `${offer.secondaryTokenAmount} ${offer.secondaryTokenSymbol}` : "",
  ].filter(Boolean).join(" + ") || `${option.tokenAmount} ${option.tokenSymbol}`;
}

export async function availableSmartPayCheckoutIdentity<T>(readIdentity: () => Promise<T>) {
  try { return await readIdentity(); }
  catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "CONTRACT_IDENTITY_MISMATCH" || reason === "CONTRACT_CODE_NOT_FOUND") return null;
    throw error;
  }
}

export function configuredSmartPay4CheckoutScopes(settings: readonly CryptoPaymentSetting[]) {
  const scopes = new Map<string, { chainId: number; contractAddress: string }>();
  for (const setting of settings) {
    if (!setting.enabled || !/^0x[a-fA-F0-9]{40}$/.test(setting.smartPay4Contract || "")) continue;
    const key = `${setting.chainId}:${setting.smartPay4Contract!.toLowerCase()}`;
    if (!scopes.has(key)) scopes.set(key, { chainId: setting.chainId, contractAddress: setting.smartPay4Contract! });
  }
  return [...scopes.values()];
}
