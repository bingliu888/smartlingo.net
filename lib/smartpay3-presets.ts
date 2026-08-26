import { atomicTokenAmountToDisplay, tokenAmountToAtomic } from "./crypto-amount";
import type { CryptoPaymentSetting } from "./crypto-settings";
import { cryptoSubscriptionIdsForCourse, type CryptoSubscriptionPlan } from "./crypto-subscription";

const LANGUAGES = ["zh","en","es","ja","ko","fr","de","ru","it","pt","ar","hi"] as const;
const TIERS: CryptoSubscriptionPlan[] = ["basic", "intermediate", "advanced"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ANNUAL_MONTHS = 12n;
export const SMARTPAY3_MINIMUM_GLC_DISPLAY = "1000000000";
export const SMARTPAY3_GLC_PER_USDT = 1_000_000n;

const amountKey = (tier: CryptoSubscriptionPlan): "basicTokenAmount" | "intermediateTokenAmount" | "advancedTokenAmount" =>
  tier === "basic" ? "basicTokenAmount" : tier === "intermediate" ? "intermediateTokenAmount" : "advancedTokenAmount";

export type SmartPay3RulePreset = {
  key: string; mode: "dual" | "single"; chainId: number; plan: CryptoSubscriptionPlan; months: 12;
  languageCode: typeof LANGUAGES[number]; classId: string; mainId: string; secondId: string;
  primarySettingId: string; primarySettingLabel: string; primaryTokenAddress: string; primaryTokenSymbol: string;
  primaryTokenDecimals: number; primaryTokenAmount: string; primaryTokenAmountAtomic: string;
  secondarySettingId: string; secondarySettingLabel: string; secondaryTokenAddress: string; secondaryTokenSymbol: string;
  secondaryTokenDecimals: number; secondaryTokenAmount: string; secondaryTokenAmountAtomic: string;
  minimumSecondaryBalance: string; minimumSecondaryBalanceAtomic: string; primaryPercent: number; secondaryPercent: number;
};

export type ComparableSmartPay3Rule = {
  primaryTokenAddress: string; secondaryTokenAddress: string; mainId: string; secondId: string;
  primaryTokenAmount: string; secondaryTokenAmount: string; minimumSecondaryBalance: string; enabled: boolean;
};

export function smartPay3ExpectedTokenPair(settings: readonly CryptoPaymentSetting[], primary: CryptoPaymentSetting) {
  if (primary.tokenSymbol.toUpperCase() !== "USDT") return { mode: "single" as const, secondarySetting: null, secondaryTokenAddress: ZERO_ADDRESS };
  const secondarySetting = settings.find(item => item.chainId === primary.chainId && Boolean(item.enabled) && item.tokenSymbol.toUpperCase() === "GLC") || null;
  return secondarySetting ? { mode: "dual" as const, secondarySetting, secondaryTokenAddress: secondarySetting.tokenContract.toLowerCase() } : null;
}

export function smartPay3RulePresets(settings: readonly CryptoPaymentSetting[], chainId: number | undefined) {
  if (!chainId) return [] as SmartPay3RulePreset[];
  const active = settings.filter(item => item.chainId === chainId && Boolean(item.enabled));
  const glc = active.find(item => item.tokenSymbol.toUpperCase() === "GLC") || null;
  const minimumSecondaryBalanceAtomic = glc ? tokenAmountToAtomic(SMARTPAY3_MINIMUM_GLC_DISPLAY, glc.tokenDecimals).toString() : "0";
  const rows: SmartPay3RulePreset[] = [];
  for (const setting of active) {
    const isUsdt = setting.tokenSymbol.toUpperCase() === "USDT";
    if (isUsdt && !glc) continue;
    for (const languageCode of LANGUAGES) for (const plan of TIERS) {
      const classId = `course_${languageCode}_${plan}`;
      const ids = cryptoSubscriptionIdsForCourse(classId);
      const fullPrimary = tokenAmountToAtomic(setting[amountKey(plan)], setting.tokenDecimals) * ANNUAL_MONTHS;
      const percent = Number.isInteger(setting.smartPay3UsdtPercent) ? setting.smartPay3UsdtPercent : 50;
      if (percent < 0 || percent > 100) throw new Error("SMARTPAY3_INVALID_USDT_PERCENT");
      let fullSecondary = 0n;
      if (isUsdt && glc) {
        const numerator = fullPrimary * SMARTPAY3_GLC_PER_USDT * (10n ** BigInt(glc.tokenDecimals));
        const denominator = 10n ** BigInt(setting.tokenDecimals);
        if (numerator % denominator !== 0n) throw new Error("SMARTPAY3_SECONDARY_AMOUNT_NOT_EXACT");
        fullSecondary = numerator / denominator;
      }
      rows.push({
        key: `${setting.id}:${glc?.id || "single"}:${classId}`, mode: isUsdt ? "dual" : "single", chainId, plan, months: 12,
        languageCode, classId, mainId: ids.mainId, secondId: ids.secondId,
        primarySettingId: setting.id, primarySettingLabel: setting.label, primaryTokenAddress: setting.tokenContract,
        primaryTokenSymbol: setting.tokenSymbol, primaryTokenDecimals: setting.tokenDecimals,
        primaryTokenAmount: atomicTokenAmountToDisplay(fullPrimary, setting.tokenDecimals), primaryTokenAmountAtomic: fullPrimary.toString(),
        secondarySettingId: isUsdt ? glc!.id : "", secondarySettingLabel: isUsdt ? glc!.label : "",
        secondaryTokenAddress: isUsdt ? glc!.tokenContract : ZERO_ADDRESS, secondaryTokenSymbol: isUsdt ? glc!.tokenSymbol : "",
        secondaryTokenDecimals: isUsdt ? glc!.tokenDecimals : 0,
        secondaryTokenAmount: isUsdt ? atomicTokenAmountToDisplay(fullSecondary, glc!.tokenDecimals) : "0",
        secondaryTokenAmountAtomic: fullSecondary.toString(), minimumSecondaryBalance: isUsdt ? SMARTPAY3_MINIMUM_GLC_DISPLAY : "0",
        minimumSecondaryBalanceAtomic: isUsdt ? minimumSecondaryBalanceAtomic : "0",
        primaryPercent: isUsdt ? percent : 100, secondaryPercent: isUsdt ? 100 - percent : 0,
      });
    }
  }
  return rows;
}

export function smartPay3RulePresetStatus(preset: SmartPay3RulePreset, rules: readonly ComparableSmartPay3Rule[]) {
  const rule = rules.find(candidate => candidate.primaryTokenAddress.toLowerCase() === preset.primaryTokenAddress.toLowerCase()
    && candidate.secondaryTokenAddress.toLowerCase() === preset.secondaryTokenAddress.toLowerCase()
    && candidate.mainId === preset.mainId && candidate.secondId === preset.secondId) || null;
  if (!rule) return { state: "missing" as const, rule };
  const configured = rule.enabled && rule.primaryTokenAmount === preset.primaryTokenAmountAtomic
    && rule.secondaryTokenAmount === preset.secondaryTokenAmountAtomic
    && rule.minimumSecondaryBalance === preset.minimumSecondaryBalanceAtomic;
  return { state: configured ? "configured" as const : "different" as const, rule };
}
