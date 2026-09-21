import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("SmartPay5 source and ABI support only platform-scoped SmartLingo products", async () => {
  const [contract, abi, presets, checkout, claim, admin] = await Promise.all([
    read("../contracts/SmartPay5.sol"), read("../contracts/artifacts/SmartPay5.json"),
    read("../lib/smartpay5-presets.ts"), read("../lib/smartpay-checkout-server.ts"),
    read("../lib/smartlingo-smartpay-claim.ts"), read("../components/SmartPayAdminConsole.tsx"),
  ]);
  for (const id of ["smartlingo_platform_max_6m", "smartlingo_platform_max_12m", "smartlingo_platform_aigc_1000"]) {
    assert.match(`${contract}\n${abi}`, new RegExp(id));
  }
  assert.match(contract, /keccak256\(bytes\(secondId\)\) != keccak256\(bytes\(PLATFORM_SECOND_ID\)\)/);
  assert.match(presets, /SMARTLINGO_PLATFORM_PRODUCTS/);
  assert.match(checkout, /smartPay5EnabledPresets/);
  assert.match(claim, /smartPayPlanForIds/);
  assert.match(claim, /platformProduct\(plan\)/);
  assert.match(admin, /Only three on-chain items remain/);
  assert.doesNotMatch(`${contract}\n${presets}\n${checkout}`, /smartlingo_course_(?:basic|intermediate|advanced)_3m/);
});

test("SmartPay payment-item enablement remains fail closed", async () => {
  const source = await read("../lib/smartpay5-confirmation-control.ts");
  assert.match(source, /enabledPresetKeys/);
  assert.match(source, /row\.enabled === 1 && row\.presetFingerprint === currentFingerprint/);
  assert.match(source, /smartPay5EnabledPresets/);
});
