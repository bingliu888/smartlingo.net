import assert from "node:assert/strict";
import test from "node:test";
import { cryptoRpc, cryptoRpcCandidates, cryptoRpcNullable, PUBLIC_RPC_URLS } from "../lib/crypto-rpc.ts";

test("Polygon uses a current endpoint with independent public fallbacks", () => {
  assert.equal(PUBLIC_RPC_URLS[137][0], "https://polygon.drpc.org");
  assert.deepEqual(cryptoRpcCandidates("https://polygon.drpc.org"), [
    "https://polygon.drpc.org",
    "https://polygon.publicnode.com",
    "https://1rpc.io/matic",
  ]);
  assert.deepEqual(cryptoRpcCandidates("https://private.example/rpc"), ["https://private.example/rpc"]);
});

test("read RPC retries another Polygon provider after failure", async () => {
  const urls = [];
  const fetcher = async url => {
    urls.push(String(url));
    if (urls.length === 1) return Response.json({ jsonrpc: "2.0", id: 1, error: { message: "rate limited" } }, { status: 429 });
    return Response.json({ jsonrpc: "2.0", id: 1, result: "0x89" });
  };
  assert.equal(await cryptoRpc("https://polygon.drpc.org", "eth_chainId", [], fetcher), "0x89");
  assert.deepEqual(urls, ["https://polygon.drpc.org", "https://polygon.publicnode.com"]);
});

test("nullable receipt reads continue past a lagging provider", async () => {
  const urls = [];
  const fetcher = async url => {
    urls.push(String(url));
    return Response.json({ jsonrpc: "2.0", id: 1, result: urls.length === 1 ? null : { status: "0x1" } });
  };
  assert.deepEqual(await cryptoRpcNullable("https://polygon.drpc.org", "eth_getTransactionReceipt", ["0xabc"], fetcher), { status: "0x1" });
});
