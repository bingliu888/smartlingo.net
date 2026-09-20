import assert from "node:assert/strict";
import test from "node:test";
import { waitForSmartPayApprovalTransition } from "../lib/smartpay-approval-sync.ts";

test("approval synchronization stops when the next wallet action changes", async () => {
  const states = [
    { nextAction: "approve-primary" },
    { nextAction: "approve-primary" },
    { nextAction: "pay" },
  ];
  let reads = 0;
  const result = await waitForSmartPayApprovalTransition({
    previousAction: "approve-primary",
    read: async () => states[Math.min(reads++, states.length - 1)],
    wait: async () => undefined,
  });
  assert.equal(result.transitioned, true);
  assert.equal(result.state.nextAction, "pay");
  assert.equal(reads, 3);
});

test("approval synchronization does not claim a transition when allowance stays stale", async () => {
  const result = await waitForSmartPayApprovalTransition({
    previousAction: "approve-secondary",
    read: async () => ({ nextAction: "approve-secondary" }),
    attempts: 2,
    wait: async () => undefined,
  });
  assert.equal(result.transitioned, false);
});
