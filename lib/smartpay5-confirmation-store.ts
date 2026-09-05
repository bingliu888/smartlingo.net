import { database } from "./db";
import { smartPay5PaymentItemStateSets, type SmartPay5ConfirmablePreset, type SmartPay5PaymentItemStateRow } from "./smartpay5-confirmation-control";

export async function smartPay5PaymentItemDatabaseState(chainId: number, presets: readonly SmartPay5ConfirmablePreset[]) {
  const result = await database().prepare(`SELECT preset_key AS presetKey, preset_fingerprint AS presetFingerprint, enabled FROM smartpay5_payment_item_states WHERE chain_id=?`).bind(chainId).all<SmartPay5PaymentItemStateRow>();
  return smartPay5PaymentItemStateSets(presets, result.results || []);
}
