import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartPay5 course payment items fail closed while preserving language-specific checkout", async () => {
  const { smartPay5ConfirmationControl, smartPay5EnabledPresets, smartPay5PaymentItemStateSets, smartPay5PresetFingerprint } = await import(new URL("../lib/smartpay5-confirmation-control.ts", import.meta.url));
  const preset = { key: "polygon-usdt:polygon-glc:basic", mode: "dual", primaryTokenAddress: "0x0000000000000000000000000000000000000001", secondaryTokenAddress: "0x0000000000000000000000000000000000000002", mainId: "course_basic", secondId: "", primaryTokenAmountAtomic: "100000000", secondaryTokenAmountAtomic: "100000000000000", minimumSecondaryBalanceAtomic: "1000000000000000000" };
  assert.deepEqual(smartPay5ConfirmationControl("configured", "enabled"), { showStop: true, showConfirm: false, confirmKind: null });
  assert.deepEqual(smartPay5ConfirmationControl("configured", "stopped"), { showStop: false, showConfirm: true, confirmKind: "reconfirm" });
  assert.deepEqual(smartPay5EnabledPresets([{ key: "enabled" }], new Set()), []);
  const fingerprint = smartPay5PresetFingerprint(preset);
  assert.deepEqual([...smartPay5PaymentItemStateSets([preset], [{ presetKey: preset.key, presetFingerprint: fingerprint, enabled: 1 }]).enabledPresetKeys], [preset.key]);
  assert.deepEqual([...smartPay5PaymentItemStateSets([{ ...preset, primaryTokenAmountAtomic: "200000000" }], [{ presetKey: preset.key, presetFingerprint: fingerprint, enabled: 1 }]).stalePresetKeys], [preset.key]);
  const [admin, route, checkout, optionsRoute, prepareRoute, migration] = await Promise.all([read("components/SmartPayAdminConsole.tsx"), read("app/api/admin/crypto-payments/rules/route.ts"), read("lib/smartpay-checkout-server.ts"), read("app/api/billing/crypto/smartpay/options/route.ts"), read("app/api/billing/crypto/smartpay/prepare/route.ts"), read("drizzle/0182_smartpay5_payment_item_states.sql")]);
  assert.match(admin, /stopSmartPay5Preset/); assert.doesNotMatch(admin, /sendOwnerTransaction\(contractState\?\.paused \? "unpause" : "pause"/);
  assert.match(route, /smartPay5RulePresetStatus\(preset, rules\)\.state !== "configured"/); assert.match(route, /enabled=0/); assert.match(route, /enabled=1/);
  assert.match(checkout, /smartPay5PaymentItemDatabaseState/); assert.match(checkout, /smartPay5EnabledPresets\(presets, state\.enabledPresetKeys\)/);
  assert.match(checkout, /cryptoSubscriptionIdsForCourse\(languageCode, preset\.plan\)/);
  assert.doesNotMatch(checkout, /smartPay5PaymentRules|verifySmartPay5Identity|smartPay5PayoutConfigurationRaw/);
  assert.doesNotMatch(optionsRoute, /smartpay5_payment_item_states|enabledPresetKeys/); assert.doesNotMatch(prepareRoute, /smartpay5_payment_item_states|enabledPresetKeys/);
  const db = new DatabaseSync(":memory:"); db.exec(migration);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM smartpay5_payment_item_states").get().count, 0); db.close();
});
