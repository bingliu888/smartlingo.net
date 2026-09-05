export type ComparableSmartPay5Rule = { primaryTokenAddress: string; secondaryTokenAddress: string; mainId: string; secondId: string; primaryTokenAmount: string; secondaryTokenAmount: string; minimumSecondaryBalance: string; enabled: boolean };
export type ComparableSmartPay5Preset = { primaryTokenAddress: string; secondaryTokenAddress: string; mainId: string; secondId: string; primaryTokenAmountAtomic: string; secondaryTokenAmountAtomic: string; minimumSecondaryBalanceAtomic: string };

export function smartPay5RulePresetStatus(preset: ComparableSmartPay5Preset, rules: readonly ComparableSmartPay5Rule[]) {
  const rule = rules.find(candidate => candidate.primaryTokenAddress.toLowerCase() === preset.primaryTokenAddress.toLowerCase() && candidate.secondaryTokenAddress.toLowerCase() === preset.secondaryTokenAddress.toLowerCase() && candidate.mainId === preset.mainId && candidate.secondId === preset.secondId) || null;
  if (!rule) return { state: "missing" as const, rule };
  if (!rule.enabled) return { state: "disabled" as const, rule };
  const configured = rule.primaryTokenAmount === preset.primaryTokenAmountAtomic && rule.secondaryTokenAmount === preset.secondaryTokenAmountAtomic && rule.minimumSecondaryBalance === preset.minimumSecondaryBalanceAtomic;
  return { state: configured ? "configured" as const : "different" as const, rule };
}
