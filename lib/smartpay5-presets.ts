import { atomicTokenAmountToDisplay, tokenAmountToAtomic } from "./crypto-amount";
import type { CryptoPaymentSetting } from "./crypto-settings";
import { cryptoSubscriptionRuleIds, type CryptoSubscriptionPlan } from "./crypto-subscription";
import { smartPay5RulePresetStatus as compareSmartPay5RulePreset } from "./smartpay5-rule-state";

const TIERS: CryptoSubscriptionPlan[] = ["basic", "intermediate", "advanced"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const SMARTPAY5_MINIMUM_GLC_DISPLAY = "1000000000";
export const SMARTPAY5_GLC_PER_USDT = 1_000_000n;

const amountKey = (tier: CryptoSubscriptionPlan): "basicTokenAmount" | "intermediateTokenAmount" | "advancedTokenAmount" =>
  tier === "basic" ? "basicTokenAmount" : tier === "intermediate" ? "intermediateTokenAmount" : "advancedTokenAmount";

export type SmartPay5RulePreset = {
  key: string; mode: "dual" | "single"; chainId: 137; plan: CryptoSubscriptionPlan; months: 3;
  mainId: string; secondId: "";
  primarySettingId: string; primarySettingLabel: string; primaryTokenAddress: string; primaryTokenSymbol: string;
  primaryTokenDecimals: number; primaryTokenAmount: string; primaryTokenAmountAtomic: string;
  secondarySettingId: string; secondarySettingLabel: string; secondaryTokenAddress: string; secondaryTokenSymbol: string;
  secondaryTokenDecimals: number; secondaryTokenAmount: string; secondaryTokenAmountAtomic: string;
  minimumSecondaryBalance: string; minimumSecondaryBalanceAtomic: string; primaryPercent: number; secondaryPercent: number;
};

export type ComparableSmartPay5Rule = {
  primaryTokenAddress: string; secondaryTokenAddress: string; mainId: string; secondId: string;
  primaryTokenAmount: string; secondaryTokenAmount: string; minimumSecondaryBalance: string; enabled: boolean;
};

export function smartPay5ExpectedTokenPair(settings: readonly CryptoPaymentSetting[], primary: CryptoPaymentSetting) {
  if (primary.chainId !== 137 || !["USDT", "GLC"].includes(primary.tokenSymbol.toUpperCase())) return null;
  if (primary.tokenSymbol.toUpperCase() !== "USDT") return { mode: "single" as const, secondarySetting: null, secondaryTokenAddress: ZERO_ADDRESS };
  const secondarySetting = settings.find(item => item.chainId === primary.chainId && Boolean(item.enabled) && item.tokenSymbol.toUpperCase() === "GLC") || null;
  return secondarySetting ? { mode: "dual" as const, secondarySetting, secondaryTokenAddress: secondarySetting.tokenContract.toLowerCase() } : null;
}

export function smartPay5RulePresets(settings: readonly CryptoPaymentSetting[], chainId: number | undefined) {
  if (chainId !== 137) return [] as SmartPay5RulePreset[];
  const active = settings.filter(item => item.chainId === 137 && Boolean(item.enabled) && ["USDT", "GLC"].includes(item.tokenSymbol.toUpperCase()));
  const glc = active.find(item => item.tokenSymbol.toUpperCase() === "GLC") || null;
  const minimumSecondaryBalanceAtomic = glc ? tokenAmountToAtomic(SMARTPAY5_MINIMUM_GLC_DISPLAY, glc.tokenDecimals).toString() : "0";
  const rows: SmartPay5RulePreset[] = [];
  for (const setting of active) {
    const isUsdt = setting.tokenSymbol.toUpperCase() === "USDT";
    if (isUsdt && !glc) continue;
    for (const plan of TIERS) {
      const ids = cryptoSubscriptionRuleIds(plan);
      const fullPrimary = tokenAmountToAtomic(setting[amountKey(plan)], setting.tokenDecimals);
      const percent = Number.isInteger(setting.smartPay5UsdtPercent) ? setting.smartPay5UsdtPercent : 50;
      if (percent < 0 || percent > 100) throw new Error("SMARTPAY5_INVALID_USDT_PERCENT");
      let fullSecondary = 0n;
      if (isUsdt && glc) {
        const numerator = fullPrimary * SMARTPAY5_GLC_PER_USDT * (10n ** BigInt(glc.tokenDecimals));
        const denominator = 10n ** BigInt(setting.tokenDecimals);
        if (numerator % denominator !== 0n) throw new Error("SMARTPAY5_SECONDARY_AMOUNT_NOT_EXACT");
        fullSecondary = numerator / denominator;
      }
      rows.push({
        key: `${setting.id}:${glc?.id || "single"}:${plan}`, mode: isUsdt ? "dual" : "single", chainId: 137, plan, months: 3,
        mainId: ids.mainId, secondId: ids.secondId,
        primarySettingId: setting.id, primarySettingLabel: setting.label, primaryTokenAddress: setting.tokenContract,
        primaryTokenSymbol: setting.tokenSymbol, primaryTokenDecimals: setting.tokenDecimals,
        primaryTokenAmount: atomicTokenAmountToDisplay(fullPrimary, setting.tokenDecimals), primaryTokenAmountAtomic: fullPrimary.toString(),
        secondarySettingId: isUsdt ? glc!.id : "", secondarySettingLabel: isUsdt ? glc!.label : "",
        secondaryTokenAddress: isUsdt ? glc!.tokenContract : ZERO_ADDRESS, secondaryTokenSymbol: isUsdt ? glc!.tokenSymbol : "",
        secondaryTokenDecimals: isUsdt ? glc!.tokenDecimals : 0,
        secondaryTokenAmount: isUsdt ? atomicTokenAmountToDisplay(fullSecondary, glc!.tokenDecimals) : "0",
        secondaryTokenAmountAtomic: fullSecondary.toString(), minimumSecondaryBalance: isUsdt ? SMARTPAY5_MINIMUM_GLC_DISPLAY : "0",
        minimumSecondaryBalanceAtomic: isUsdt ? minimumSecondaryBalanceAtomic : "0",
        primaryPercent: isUsdt ? percent : 100, secondaryPercent: isUsdt ? 100 - percent : 0,
      });
    }
  }
  return rows;
}

export function smartPay5RulePresetStatus(preset: SmartPay5RulePreset, rules: readonly ComparableSmartPay5Rule[]) {
  return compareSmartPay5RulePreset(preset, rules);
}
