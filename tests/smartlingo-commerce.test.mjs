import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

async function commerceModule() {
  const source = await read("../lib/smartlingo-commerce.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("first successful learner-and-class payment receives 15% off before the exact 70/30 split", async () => {
  const commerce = await commerceModule();
  const first = commerce.quoteClassOrder({
    subtotalCents: 10_000,
    hasPriorPaidOrderForLearnerAndClass: false,
  });

  assert.deepEqual(first, {
    subtotalCents: 10_000,
    firstClassPayment: true,
    discountBasisPoints: 1_500,
    discountCents: 1_500,
    discountedPreTaxCents: 8_500,
    ownerShareCents: 5_950,
    platformFeeCents: 2_550,
  });
  assert.equal(first.ownerShareCents + first.platformFeeCents, first.discountedPreTaxCents);
});

test("later payments for the same learner and class have no first-payment discount", async () => {
  const commerce = await commerceModule();
  const later = commerce.quoteClassOrder({
    subtotalCents: 10_001,
    hasPriorPaidOrderForLearnerAndClass: true,
  });

  assert.equal(later.firstClassPayment, false);
  assert.equal(later.discountBasisPoints, 0);
  assert.equal(later.discountedPreTaxCents, 10_001);
  assert.equal(later.ownerShareCents, 7_000);
  assert.equal(later.platformFeeCents, 3_001);
  assert.equal(later.ownerShareCents + later.platformFeeCents, later.discountedPreTaxCents);
  assert.throws(
    () => commerce.quoteClassOrder({ subtotalCents: 1.5, hasPriorPaidOrderForLearnerAndClass: false }),
    /integer number of cents/,
  );
});

test("introducer rewards are exclusive to paid platform subscription invoices", async () => {
  const commerce = await commerceModule();
  const common = {
    eventType: "invoice.paid",
    status: "paid",
    amountCents: 699,
    subscriberUserId: "learner-1",
    introducerUserId: "introducer-1",
  };

  assert.equal(commerce.canCreateIntroducerReward({ ...common, source: "platform_subscription" }), true);
  assert.equal(commerce.canCreateIntroducerReward({ ...common, source: "member_class" }), false);
  assert.equal(commerce.canCreateIntroducerReward({ ...common, source: "platform_subscription", eventType: "checkout.session.completed" }), false);
  assert.equal(commerce.canCreateIntroducerReward({ ...common, source: "platform_subscription", status: "pending" }), false);
  assert.equal(commerce.canCreateIntroducerReward({ ...common, source: "platform_subscription", introducerUserId: "learner-1" }), false);
});

test("Stripe Connect readiness requires completed onboarding plus charges and payouts", async () => {
  const commerce = await commerceModule();
  assert.equal(commerce.connectedAccountCanReceiveClassPayments({
    onboardingStatus: "ready",
    chargesEnabled: true,
    payoutsEnabled: true,
  }), true);
  assert.equal(commerce.connectedAccountCanReceiveClassPayments({
    onboardingStatus: "ready",
    chargesEnabled: true,
    payoutsEnabled: false,
  }), false);
});
