import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  SMARTPAY4_FACTORY_ADDRESS,
  smartPay4DeploymentData,
  smartPay4FactoryDeployment,
  smartPay4DeploymentGasLimit,
} from "../lib/smartpay-deployment.ts";
import { smartPay4SourceVerificationPayload } from "../lib/smartpay-source-verification.ts";
import { configuredSmartPay4CheckoutScopes, smartPayCheckoutDisplayAmount, smartPayOptionsForLanguage } from "../lib/smartpay-checkout.ts";
import { smartPayWithdrawalPreflight } from "../lib/crypto-amount.ts";
import { verifyCryptoPaymentWithConfirmations } from "../lib/crypto-payment-verification.ts";
import { smartPayOwnerActionFeedback, smartPayOwnerConnectionError } from "../lib/smartpay-admin-wallet-ui.ts";

const root = new URL("..", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const owner = "0x1111111111111111111111111111111111111111";

test("course reconciliation requires normalized payer identity and a language-scoped three-month package", async () => {
  const source = await read("lib/smartpay-reconciliation.ts");
  assert.match(source, /record\.payerId\.trim\(\)\.toUpperCase\(\) === payer/);
  assert.match(source, /record\.refId\.trim\(\)\.toUpperCase\(\) === owner/);
  assert.match(source, /cryptoSubscriptionPlanForIds\(record\.mainId, record\.secondId\)/);
  assert.doesNotMatch(source, /smartlingo_course_annual|secondId:\s*classId/);
});

test("checkout shows the full on-chain price before connection and the eligible split afterward", () => {
  const option = {
    key: "polygon-usdt:course_es_basic", settingId: "polygon-usdt", plan: "basic", months: 3,
    languageCode: "es", classId: "course_es_basic", chainId: 137, chainName: "Polygon",
    contractAddress: "0x2222222222222222222222222222222222222222",
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", tokenSymbol: "USDT", tokenDecimals: 6,
    tokenAmountAtomic: "30000000", tokenAmount: "30", mainId: "smartlingo_course_basic_3m",
    secondId: "es", minConfirmations: 12,
    smartPay4Offer: {
      mode: "dual", contractAddress: "0x2222222222222222222222222222222222222222",
      primaryTokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", primaryTokenSymbol: "USDT",
      primaryTokenDecimals: 6, primaryTokenAmountAtomic: "15000000", primaryTokenAmount: "15", primaryPercent: 50,
      secondaryTokenAddress: "0x6aa3a471765e8a9884e0e6edcb0f796bf9f0b325", secondaryTokenSymbol: "GLC",
      secondaryTokenDecimals: 18, secondaryTokenAmountAtomic: "15000000000000000000000000",
      secondaryTokenAmount: "15000000", secondaryPercent: 50,
      minimumSecondaryBalanceAtomic: "1000000000000000000000000000", minimumSecondaryBalance: "1000000000",
      mainId: "smartlingo_course_basic_3m", secondId: "es", minConfirmations: 12,
    },
  };
  assert.equal(smartPayCheckoutDisplayAmount(option), "30 USDT");
  assert.equal(smartPayCheckoutDisplayAmount(option, true), "15 USDT + 15000000 GLC");
});

test("language checkout shows every enabled tier while course checkout remains locked", () => {
  const option = (languageCode, plan) => ({ languageCode, plan, classId: `course_${languageCode}_${plan}` });
  const options = [option("ja", "basic"), option("ja", "intermediate"), option("it", "basic")];
  assert.deepEqual(smartPayOptionsForLanguage(options, "ja").map(item => item.plan), ["basic", "intermediate"]);
  assert.deepEqual(smartPayOptionsForLanguage(options, "ja", "course_ja_basic").map(item => item.plan), ["basic"]);
  assert.deepEqual(smartPayOptionsForLanguage(options, "it").map(item => item.classId), ["course_it_basic"]);
});

test("payment verification waits 6 seconds and retries three more times at 10 seconds", async () => {
  const pauses = [];
  let calls = 0;
  const result = await verifyCryptoPaymentWithConfirmations({
    settingId: "polygon-usdt", plan: "basic", classId: "course_es_basic", txHash: `0x${"ab".repeat(32)}`,
    attempts: 4, initialDelayMs: 6000, intervalMs: 10000,
    fetcher: async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: "pending" }), { status: 425, headers: { "content-type": "application/json" } });
    },
    pause: async milliseconds => { pauses.push(milliseconds); },
  });
  assert.equal(calls, 4);
  assert.equal(result.attemptsUsed, 4);
  assert.deepEqual(pauses, [6000, 10000, 10000, 10000]);
});

test("deployment bundle is reproducible and site-specific", async () => {
  const artifact = JSON.parse(await read("contracts/artifacts/SmartPay4.json"));
  const publicAbi = JSON.parse(await read("public/contracts/SmartPay4.abi.json"));
  assert.deepEqual(publicAbi, artifact.abi);
  const creation = smartPay4DeploymentData({ ...artifact, constructorInputs: ["initialOwner"] }, owner, artifact.abi);
  const deployment = smartPay4FactoryDeployment(creation, owner, 137, "smartlingo.net", "release-20260826");
  assert.equal(deployment.factoryAddress, SMARTPAY4_FACTORY_ADDRESS);
  assert.match(deployment.contractAddress, /^0x[0-9a-f]{40}$/i);
  assert.equal(smartPay4DeploymentGasLimit("0x186a0"), "0x1e848");
  const payload = smartPay4SourceVerificationPayload(artifact, owner);
  assert.equal(payload.sourcify.contractIdentifier, "contracts/SmartPay4.sol:SmartPay4");
});

test("SmartPay4 stores three shared price products and records the selected learning language on payment", async () => {
  const [contract, presets, server, optionsRoute] = await Promise.all([
    read("contracts/SmartPay4.sol"),
    read("lib/smartpay4-presets.ts"),
    read("lib/smartpay-checkout-server.ts"),
    read("app/api/billing/crypto/smartpay/options/route.ts"),
  ]);
  for (const mainId of ["smartlingo_course_basic_3m", "smartlingo_course_intermediate_3m", "smartlingo_course_advanced_3m"]) {
    assert.match(contract, new RegExp(mainId));
  }
  assert.doesNotMatch(contract, /opc_3_month|opc_6_month|opc_12_month/);
  assert.match(contract, /_ruleKey\(primaryTokenAddress, secondaryTokenAddress, mainId, SUBSCRIPTION_SECOND_ID\)/);
  assert.match(contract, /_isSupportedLanguage\(secondId\)/);
  assert.match(presets, /cryptoSubscriptionRuleIds/);
  assert.match(server, /cryptoSubscriptionIdsForCourse\(languageCode, preset\.plan\)/);
  assert.match(optionsRoute, /Choose a supported learning language/);
});

test("user pages hide contract implementation names and admin identifiers", async () => {
  const [checkout, account, profile, admin, migration] = await Promise.all([
    read("components/CryptoCheckout.tsx"),
    read("app/[lang]/account/page.tsx"),
    read("components/ProfileEditor.tsx"),
    read("components/SmartPayAdminConsole.tsx"),
    read("drizzle/0172_smartpay3_course_refid.sql"),
  ]);
  const setting = { id: "polygon-usdt", enabled: 1, chainId: 137, smartPay4Contract: "0x2222222222222222222222222222222222222222" };
  assert.deepEqual(configuredSmartPay4CheckoutScopes([setting]), [{ chainId: 137, contractAddress: setting.smartPay4Contract }]);
  assert.doesNotMatch(checkout, />[^<{\n]*(SmartPay4|mainID|secondID|\bOPC\b)[^<{\n]*</i);
  assert.doesNotMatch(checkout, /window\.confirm|USER_CANCELLED|confirm the balance prompt|确认余额提示/);
  assert.match(checkout, /wallet directly requests any required approval or payment/);
  assert.doesNotMatch(account, />[^<{\n]*(SmartPay4|mainID|secondID|\bOPC\b)[^<{\n]*</i);
  assert.match(profile, /profile-copy-button/);
  assert.match(checkout, /prepared\.refId/);
  assert.match(checkout, /prepared\.payerId/);
  assert.doesNotMatch(checkout, /saveWallet\(|Save payer wallet/);
  assert.match(admin, /Redeploy \$\{contractName\}/);
  assert.match(migration, /ref_id TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK\(length\(ref_id\)=6\)/);
  assert.deepEqual(smartPayWithdrawalPreflight("100", 18, "0"), {
    ok: false, reason: "insufficient-balance", amountAtomic: 100000000000000000000n, balanceAtomic: 0n,
  });
});

test("retired SmartPay1 and SmartPay2 authored files and routes are absent", async () => {
  for (const path of [
    "contracts/SmartPay1.sol", "contracts/SmartPay2.sol", "public/contracts/SmartPay1.abi.json",
    "public/contracts/SmartPay2.abi.json", "lib/smartpay.ts", "lib/smartpay2.ts",
    "app/api/contracts/smartpay1/route.ts", "app/api/contracts/smartpay2/route.ts",
  ]) await assert.rejects(access(new URL(path, root)), /ENOENT/);
});

test("a connected non-owner receives an immediate SmartPay4 owner reminder", () => {
  const contractOwner = "0x1111111111111111111111111111111111111111";
  const connectedNonOwner = "0x2222222222222222222222222222222222222222";
  assert.equal(smartPayOwnerConnectionError(contractOwner, contractOwner, connectedNonOwner), "NOT_OWNER");
  assert.equal(smartPayOwnerConnectionError(contractOwner, connectedNonOwner, connectedNonOwner), "NOT_OWNER");
  assert.equal(smartPayOwnerConnectionError(contractOwner, connectedNonOwner, contractOwner), "OWNER_FIELD_MISMATCH");
  assert.equal(smartPayOwnerConnectionError(contractOwner, contractOwner, contractOwner), null);
  assert.deepEqual(smartPayOwnerActionFeedback("en", "NOT_OWNER"), {
    message: "Your connected wallet is not the SmartPay4 owner.",
    interruptive: true,
  });
  assert.deepEqual(smartPayOwnerActionFeedback("zh", "NOT_OWNER"), {
    message: "您连接的钱包不是 SmartPay4 Owner。",
    interruptive: true,
  });
});
