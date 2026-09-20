import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MANAGED_REOWN_PROJECT_ID = "d80a9b985c7086328f1c42a7ff7bdf46";
const RETIRED_REOWN_PROJECT_ID = "0d850a98123d379c16d0d9f2555d39bb";

test("all SmartLingo wallet surfaces use the managed Reown project", async () => {
  const commerce = await readFile("lib/smartlingo-commerce-wallet.ts", "utf8");

  assert.match(commerce, new RegExp(MANAGED_REOWN_PROJECT_ID));
  assert.doesNotMatch(commerce, new RegExp(RETIRED_REOWN_PROJECT_ID));
  assert.doesNotMatch(commerce, /WALLETCONNECT_PROJECT_ID/);
});
