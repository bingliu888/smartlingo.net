export type SmartPay5ChainRuleState = "missing" | "configured" | "different" | "disabled";
export type SmartPay5PaymentItemDatabaseState = "unconfirmed" | "enabled" | "stopped" | "stale";
export type SmartPay5ConfirmablePreset = { key: string; mode: "dual" | "single"; primaryTokenAddress: string; secondaryTokenAddress: string; mainId: string; secondId: string; primaryTokenAmountAtomic: string; secondaryTokenAmountAtomic: string; minimumSecondaryBalanceAtomic: string };
export type SmartPay5PaymentItemStateRow = { presetKey: string; presetFingerprint: string; enabled: number };

export function smartPay5PresetFingerprint(preset: SmartPay5ConfirmablePreset) {
  return JSON.stringify([preset.mode, preset.primaryTokenAddress.toLowerCase(), preset.secondaryTokenAddress.toLowerCase(), preset.mainId, preset.secondId, preset.primaryTokenAmountAtomic, preset.secondaryTokenAmountAtomic, preset.minimumSecondaryBalanceAtomic]);
}

export function smartPay5PaymentItemStateSets(presets: readonly SmartPay5ConfirmablePreset[], rows: readonly SmartPay5PaymentItemStateRow[]) {
  const currentFingerprints = new Map(presets.map(preset => [preset.key, smartPay5PresetFingerprint(preset)]));
  const enabledPresetKeys = new Set<string>();
  const knownPresetKeys = new Set<string>();
  const stalePresetKeys = new Set<string>();
  for (const row of rows) {
    const currentFingerprint = currentFingerprints.get(row.presetKey);
    if (!currentFingerprint) continue;
    knownPresetKeys.add(row.presetKey);
    if (row.enabled === 1 && row.presetFingerprint === currentFingerprint) enabledPresetKeys.add(row.presetKey);
    else if (row.enabled === 1) stalePresetKeys.add(row.presetKey);
  }
  return { enabledPresetKeys, knownPresetKeys, stalePresetKeys };
}

export function smartPay5ConfirmationControl(state: SmartPay5ChainRuleState, databaseState: SmartPay5PaymentItemDatabaseState) {
  if (databaseState === "enabled") return { showStop: true, showConfirm: false, confirmKind: null };
  return { showStop: false, showConfirm: true, confirmKind: databaseState === "unconfirmed" && state === "missing" ? "confirm" as const : "reconfirm" as const };
}

export function smartPay5EnabledPresets<T extends { key: string }>(presets: readonly T[], enabledPresetKeys: ReadonlySet<string>) {
  return presets.filter(preset => enabledPresetKeys.has(preset.key));
}
