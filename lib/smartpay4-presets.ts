import { atomicTokenAmountToDisplay, tokenAmountToAtomic } from "./crypto-amount";
import type { CryptoPaymentSetting } from "./crypto-settings";
import { cryptoSubscriptionRuleIds, type CryptoSubscriptionPlan } from "./crypto-subscription";

const TIERS: CryptoSubscriptionPlan[] = ["basic", "intermediate", "advanced"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const SMARTPAY4_MINIMUM_GLC_DISPLAY = "1000000000";
export const SMARTPAY4_GLC_PER_USDT = 1_000_000n;

const amountKey = (tier: CryptoSubscriptionPlan): "basicTokenAmount" | "intermediateTokenAmount" | "advancedTokenAmount" =>
  tier === "basic" ? "basicTokenAmount" : tier === "intermediate" ? "intermediateTokenAmount" : "advancedTokenAmount";

export type SmartPay4RulePreset = {
  key: string; mode: "dual" | "single"; chainId: 137; plan: CryptoSubscriptionPlan; months: 3;
  mainId: string; secondId: "";
  primarySettingId: string; primarySettingLabel: string; primaryTokenAddress: string; primaryTokenSymbol: string;
  primaryTokenDecimals: number; primaryTokenAmount: string; primaryTokenAmountAtomic: string;
  secondarySettingId: string; secondarySettingLabel: string; secondaryTokenAddress: string; secondaryTokenSymbol: string;
  secondaryTokenDecimals: number; secondaryTokenAmount: string; secondaryTokenAmountAtomic: string;
  minimumSecondaryBalance: string; minimumSecondaryBalanceAtomic: string; primaryPercent: number; secondaryPercent: number;
};

export type ComparableSmartPay4Rule = {
  primaryTokenAddress: string; secondaryTokenAddress: string; mainId: string; secondId: string;
  primaryTokenAmount: string; secondaryTokenAmount: string; minimumSecondaryBalance: string; enabled: boolean;
};

export function smartPay4ExpectedTokenPair(settings: readonly CryptoPaymentSetting[], primary: CryptoPaymentSetting) {
  if (primary.chainId !== 137 || !["USDT", "GLC"].includes(primary.tokenSymbol.toUpperCase())) return null;
  if (primary.tokenSymbol.toUpperCase() !== "USDT") return { mode: "single" as const, secondarySetting: null, secondaryTokenAddress: ZERO_ADDRESS };
  const secondarySetting = settings.find(item => item.chainId === primary.chainId && Boolean(item.enabled) && item.tokenSymbol.toUpperCase() === "GLC") || null;
  return secondarySetting ? { mode: "dual" as const, secondarySetting, secondaryTokenAddress: secondarySetting.tokenContract.toLowerCase() } : null;
}

export function smartPay4RulePresets(settings: readonly CryptoPaymentSetting[], chainId: number | undefined) {
  if (chainId !== 137) return [] as SmartPay4RulePreset[];
  const active = settings.filter(item => item.chainId === 137 && Boolean(item.enabled) && ["USDT", "GLC"].includes(item.tokenSymbol.toUpperCase()));
  const glc = active.find(item => item.tokenSymbol.toUpperCase() === "GLC") || null;
  const minimumSecondaryBalanceAtomic = glc ? tokenAmountToAtomic(SMARTPAY4_MINIMUM_GLC_DISPLAY, glc.tokenDecimals).toString() : "0";
  const rows: SmartPay4RulePreset[] = [];
  for (const setting of active) {
    const isUsdt = setting.tokenSymbol.toUpperCase() === "USDT";
    if (isUsdt && !glc) continue;
    for (const plan of TIERS) {
      const ids = cryptoSubscriptionRuleIds(plan);
      const fullPrimary = tokenAmountToAtomic(setting[amountKey(plan)], setting.tokenDecimals);
      const percent = Number.isInteger(setting.smartPay4UsdtPercent) ? setting.smartPay4UsdtPercent : 50;
      if (percent < 0 || percent > 100) throw new Error("SMARTPAY4_INVALID_USDT_PERCENT");
      let fullSecondary = 0n;
      if (isUsdt && glc) {
        const numerator = fullPrimary * SMARTPAY4_GLC_PER_USDT * (10n ** BigInt(glc.tokenDecimals));
        const denominator = 10n ** BigInt(setting.tokenDecimals);
        if (numerator % denominator !== 0n) throw new Error("SMARTPAY4_SECONDARY_AMOUNT_NOT_EXACT");
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
        secondaryTokenAmountAtomic: fullSecondary.toString(), minimumSecondaryBalance: isUsdt ? SMARTPAY4_MINIMUM_GLC_DISPLAY : "0",
        minimumSecondaryBalanceAtomic: isUsdt ? minimumSecondaryBalanceAtomic : "0",
        primaryPercent: isUsdt ? percent : 100, secondaryPercent: isUsdt ? 100 - percent : 0,
      });
    }
  }
  return rows;
}

export function smartPay4RulePresetStatus(preset: SmartPay4RulePreset, rules: readonly ComparableSmartPay4Rule[]) {
  const rule = rules.find(candidate => candidate.primaryTokenAddress.toLowerCase() === preset.primaryTokenAddress.toLowerCase()
    && candidate.secondaryTokenAddress.toLowerCase() === preset.secondaryTokenAddress.toLowerCase()
    && candidate.mainId === preset.mainId && candidate.secondId === preset.secondId) || null;
  if (!rule) return { state: "missing" as const, rule };
  const configured = rule.enabled && rule.primaryTokenAmount === preset.primaryTokenAmountAtomic
    && rule.secondaryTokenAmount === preset.secondaryTokenAmountAtomic
    && rule.minimumSecondaryBalance === preset.minimumSecondaryBalanceAtomic;
  return { state: configured ? "configured" as const : "different" as const, rule };
}
