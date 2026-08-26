import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  SMARTPAY3_FACTORY_ADDRESS,
  smartPay3DeploymentData,
  smartPay3FactoryDeployment,
  smartPay3DeploymentGasLimit,
} from "../lib/smartpay-deployment.ts";
import { smartPay3SourceVerificationPayload } from "../lib/smartpay-source-verification.ts";
import { configuredSmartPay3CheckoutScopes, smartPayCheckoutDisplayAmount } from "../lib/smartpay-checkout.ts";
import { smartPayWithdrawalPreflight } from "../lib/crypto-amount.ts";
import { verifyCryptoPaymentWithConfirmations } from "../lib/crypto-payment-verification.ts";
import { smartPayRecipientMatches, smartPayTransactionNeedsReconciliation } from "../lib/smartpay-reconciliation.ts";

const root = new URL("..", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const owner = "0x1111111111111111111111111111111111111111";

test("course recipient matching is wallet-normalized and RefID case-insensitive", () => {
  const record = {
    wallet: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    refId: "AbC234",
    mainId: "smartlingo_course_annual",
    secondId: "course_es_basic",
    subscriptionRecorded: false,
  };
  assert.equal(smartPayRecipientMatches(record, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "ABC234"), true);
  assert.equal(smartPayTransactionNeedsReconciliation(record, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "abc234"), true);
  assert.equal(smartPayTransactionNeedsReconciliation({ ...record, secondId: "bad" }, record.wallet, record.refId), false);
});

test("checkout shows the full on-chain price before connection and the eligible split afterward", () => {
  const option = {
    key: "polygon-usdt:course_es_basic", settingId: "polygon-usdt", plan: "basic", months: 12,
    languageCode: "es", classId: "course_es_basic", chainId: 137, chainName: "Polygon",
    contractAddress: "0x2222222222222222222222222222222222222222",
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", tokenSymbol: "USDT", tokenDecimals: 6,
    tokenAmountAtomic: "240000000", tokenAmount: "240", mainId: "smartlingo_course_annual",
    secondId: "course_es_basic", minConfirmations: 12,
    smartPay3Offer: {
      mode: "dual", contractAddress: "0x2222222222222222222222222222222222222222",
      primaryTokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", primaryTokenSymbol: "USDT",
      primaryTokenDecimals: 6, primaryTokenAmountAtomic: "120000000", primaryTokenAmount: "120", primaryPercent: 50,
      secondaryTokenAddress: "0x6aa3a471765e8a9884e0e6edcb0f796bf9f0b325", secondaryTokenSymbol: "GLC",
      secondaryTokenDecimals: 18, secondaryTokenAmountAtomic: "120000000000000000000000000",
      secondaryTokenAmount: "120000000", secondaryPercent: 50,
      minimumSecondaryBalanceAtomic: "1000000000000000000000000000", minimumSecondaryBalance: "1000000000",
      mainId: "smartlingo_course_annual", secondId: "course_es_basic", minConfirmations: 12,
    },
  };
  assert.equal(smartPayCheckoutDisplayAmount(option), "240 USDT");
  assert.equal(smartPayCheckoutDisplayAmount(option, true), "120 USDT + 120000000 GLC");
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
  const artifact = JSON.parse(await read("contracts/artifacts/SmartPay3.json"));
  const publicAbi = JSON.parse(await read("public/contracts/SmartPay3.abi.json"));
  assert.deepEqual(publicAbi, artifact.abi);
  const creation = smartPay3DeploymentData({ ...artifact, constructorInputs: ["initialOwner"] }, owner, artifact.abi);
  const deployment = smartPay3FactoryDeployment(creation, owner, 137, "smartlingo.net", "release-20260826");
  assert.equal(deployment.factoryAddress, SMARTPAY3_FACTORY_ADDRESS);
  assert.match(deployment.contractAddress, /^0x[0-9a-f]{40}$/i);
  assert.equal(smartPay3DeploymentGasLimit("0x186a0"), "0x1e848");
  const payload = smartPay3SourceVerificationPayload(artifact, owner);
  assert.equal(payload.sourcify.contractIdentifier, "contracts/SmartPay3.sol:SmartPay3");
});

test("user pages hide contract implementation names and admin identifiers", async () => {
  const [checkout, account, profile, admin, migration] = await Promise.all([
    read("components/CryptoCheckout.tsx"),
    read("app/[lang]/account/page.tsx"),
    read("components/ProfileEditor.tsx"),
    read("components/SmartPayAdminConsole.tsx"),
    read("drizzle/0172_smartpay3_course_refid.sql"),
  ]);
  const setting = { id: "polygon-usdt", enabled: 1, chainId: 137, smartPay3Contract: "0x2222222222222222222222222222222222222222" };
  assert.deepEqual(configuredSmartPay3CheckoutScopes([setting]), [{ chainId: 137, contractAddress: setting.smartPay3Contract }]);
  assert.doesNotMatch(checkout, />[^<{\n]*(SmartPay3|mainID|secondID|\bOPC\b)[^<{\n]*</i);
  assert.doesNotMatch(account, />[^<{\n]*(SmartPay3|mainID|secondID|\bOPC\b)[^<{\n]*</i);
  assert.match(profile, /profile-copy-button/);
  assert.match(checkout, /prepared\.refId/);
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
