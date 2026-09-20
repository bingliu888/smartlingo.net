import assert from "node:assert/strict";
import test from "node:test";
import { sendEvmWalletTransaction } from "../lib/evm-wallet-client.ts";

const address = "0x1111111111111111111111111111111111111111";

test("the connected EIP-1193 wallet owns the final gas limit", async () => {
  let request;
  const provider = { async request(input) { request = input; return "0xabc"; } };
  const hash = await sendEvmWalletTransaction(provider, {
    from: address,
    to: "0x2222222222222222222222222222222222222222",
    data: "0x1234",
    gas: "0xe8b0",
  });
  assert.equal(hash, "0xabc");
  assert.deepEqual(request, {
    method: "eth_sendTransaction",
    params: [{ from: address, to: "0x2222222222222222222222222222222222222222", data: "0x1234" }],
  });
});
