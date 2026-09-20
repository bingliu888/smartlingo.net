import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checkout = await readFile(new URL("../components/CryptoCheckout.tsx", import.meta.url), "utf8");

test("wallet refresh is a compact icon beside the connected address", () => {
  assert.match(checkout, /className="connected-wallet-line"/);
  assert.match(checkout, /className="wallet-refresh-button"/);
  assert.match(checkout, /width: 32/);
  assert.match(checkout, /<svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(checkout, />Refresh balances (?:and|&amp;|&) gas</);
});
