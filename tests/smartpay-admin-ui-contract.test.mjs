import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartPay4 admin layout matches SmartMeeting and uses the connected wallet as Owner", async () => {
  const [page, dashboard, consoleSource] = await Promise.all([
    read("app/[lang]/admin/crypto-payments/page.tsx"),
    read("components/AdminDashboard.tsx"),
    read("components/SmartPayAdminConsole.tsx"),
  ]);
  assert.match(page, /SmartPayAdminConsole/);
  assert.doesNotMatch(page, /AdminCryptoSettings|PRODUCT ITEMS/);
  assert.match(dashboard, /AdminCryptoSettings/);
  assert.match(consoleSource, /setConnectedWallet\(result\.address\)/);
  assert.match(consoleSource, /setOwnerWallet\(result\.address\)/);
  assert.match(consoleSource, /const initialOwner = active\.address/);
  assert.match(consoleSource, /Only the three 3-month Beginner, Intermediate, and Advanced price products are stored on-chain/);
  assert.doesNotMatch(consoleSource, /classId: record\.secondId/);
});
