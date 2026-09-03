export type SmartPay5ReceiptLog = { address?: string; topics?: string[]; data?: string };
export type SmartPay5LocatedReceipt = {
  transactionHash?: string;
  status?: string;
  blockNumber?: string;
  logs?: SmartPay5ReceiptLog[];
};

type RpcBlock = { timestamp?: string };
type RpcEventLog = { transactionHash?: string };
type RpcCall = <T>(method: string, params: unknown[]) => Promise<T>;

const rpcQuantity = (value: bigint) => `0x${value.toString(16)}`;

async function firstBlockAtOrAfter(rpc: RpcCall, latest: bigint, timestamp: bigint) {
  let low = 0n;
  let high = latest + 1n;
  while (low < high) {
    const midpoint = (low + high) / 2n;
    const block = await rpc<RpcBlock>("eth_getBlockByNumber", [rpcQuantity(midpoint), false]);
    if (!block.timestamp) throw new Error("BLOCK_TIMESTAMP_UNAVAILABLE");
    if (BigInt(block.timestamp) < timestamp) low = midpoint + 1n;
    else high = midpoint;
  }
  return low;
}

export async function locateSmartPay5Receipt(input: {
  rpc: RpcCall;
  contract: string;
  transactionId: string;
  transactionTopic: string;
  timestamp: number;
}) {
  if (!Number.isSafeInteger(input.timestamp) || input.timestamp < 1)
    throw new Error("INVALID_TRANSACTION_TIMESTAMP");
  const latest = BigInt(await input.rpc<string>("eth_blockNumber", []));
  const targetTimestamp = BigInt(input.timestamp);
  const first = await firstBlockAtOrAfter(input.rpc, latest, targetTimestamp);
  if (first > latest) throw new Error("TRANSACTION_EVENT_NOT_FOUND");
  const nextTimestamp = await firstBlockAtOrAfter(input.rpc, latest, targetTimestamp + 1n);
  const fromBlock = first > 2n ? first - 2n : 0n;
  const toBlock = nextTimestamp <= latest
    ? (nextTimestamp + 2n > latest ? latest : nextTimestamp + 2n)
    : latest;
  const logs = await input.rpc<RpcEventLog[]>("eth_getLogs", [{
    address: input.contract,
    fromBlock: rpcQuantity(fromBlock),
    toBlock: rpcQuantity(toBlock),
    topics: [input.transactionTopic, input.transactionId],
  }]);
  const hashes = [...new Set(logs.map((log) => log.transactionHash?.toLowerCase())
    .filter((value): value is string => Boolean(value)))];
  if (hashes.length !== 1) throw new Error("TRANSACTION_EVENT_NOT_FOUND");
  const receipt = await input.rpc<SmartPay5LocatedReceipt>(
    "eth_getTransactionReceipt", [hashes[0]],
  );
  if (!receipt.transactionHash || receipt.transactionHash.toLowerCase() !== hashes[0]
    || receipt.status !== "0x1" || !receipt.blockNumber)
    throw new Error("TRANSACTION_RECEIPT_INVALID");
  return receipt;
}
