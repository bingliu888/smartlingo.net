import assert from "node:assert/strict";
import test from "node:test";
import { walletRpcErrorCode } from "../lib/wallet-rpc.ts";

test("wallet RPC error codes are found through nested provider wrappers", () => {
  assert.equal(walletRpcErrorCode({ data: { originalError: { code: -32602 } } }), -32602);
  assert.equal(walletRpcErrorCode({ error: { data: { code: "-32002" } } }), -32002);
});
