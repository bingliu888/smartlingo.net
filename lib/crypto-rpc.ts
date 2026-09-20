export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const addressTopic = (address: string) => `0x${address.toLowerCase().slice(2).padStart(64, "0")}`;

export const PUBLIC_RPC_URLS: Readonly<Record<number, readonly string[]>> = {
  1: ["https://ethereum-rpc.publicnode.com"],
  56: ["https://bsc-rpc.publicnode.com"],
  137: ["https://polygon.drpc.org", "https://polygon.publicnode.com", "https://1rpc.io/matic"],
  8453: ["https://base-rpc.publicnode.com"],
};

const LEGACY_PUBLIC_RPC_GROUPS: Readonly<Record<string, number>> = {
  "https://polygon-bor-rpc.publicnode.com": 137,
};

export function cryptoRpcCandidates(url: string) {
  const normalized = url.trim().replace(/\/$/, "");
  const publicGroup = Number(Object.entries(PUBLIC_RPC_URLS)
    .find(([, urls]) => urls.some(candidate => candidate.replace(/\/$/, "") === normalized))?.[0]
    || LEGACY_PUBLIC_RPC_GROUPS[normalized]
    || 0);
  const fallbacks = publicGroup ? PUBLIC_RPC_URLS[publicGroup] || [] : [];
  return [...new Set([normalized, ...fallbacks.map(candidate => candidate.replace(/\/$/, ""))])].filter(Boolean);
}

export async function cryptoRpcUrl(chainId: number) {
  const { env } = await import("cloudflare:workers");
  const values = env as unknown as Record<string, string | undefined>;
  return values[`CRYPTO_RPC_URL_${chainId}`] || values.CRYPTO_RPC_URL || PUBLIC_RPC_URLS[chainId]?.[0] || "";
}

type RpcFetch = typeof fetch;

async function rpcPayload(fetcher: RpcFetch, url: string, method: string, params: unknown[]) {
  const response = await withExternalRequestTimeout((signal) => fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  }), BLOCKCHAIN_RPC_REQUEST_TIMEOUT_MS);
  const raw = await readBoundedExternalResponseText(response, 512 * 1024);
  let payload: { result?: unknown; error?: { message?: string } } | null = null;
  if (!raw.truncated) {
    try { payload = JSON.parse(raw.text) as { result?: unknown; error?: { message?: string } }; }
    catch { /* invalid RPC JSON */ }
  }
  if (!response.ok || payload?.error) throw new Error(payload?.error?.message || "RPC_UNAVAILABLE");
  return payload;
}

export async function cryptoRpc<T = unknown>(url: string, method: string, params: unknown[], fetcher: RpcFetch = fetch): Promise<T> {
  let lastError: unknown = new Error("RPC_UNAVAILABLE");
  for (const candidate of cryptoRpcCandidates(url)) {
    try {
      const payload = await rpcPayload(fetcher, candidate, method, params);
      if (payload?.result == null) throw new Error("RPC_UNAVAILABLE");
      return payload.result as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function cryptoRpcNullable<T = unknown>(url: string, method: string, params: unknown[], fetcher: RpcFetch = fetch): Promise<T | null> {
  let lastError: unknown = null;
  let sawNull = false;
  for (const candidate of cryptoRpcCandidates(url)) {
    try {
      const payload = await rpcPayload(fetcher, candidate, method, params);
      if (payload?.result != null) return payload.result as T;
      sawNull = true;
    } catch (error) {
      lastError = error;
    }
  }
  if (sawNull) return null;
  throw lastError || new Error("RPC_UNAVAILABLE");
}
import {
  BLOCKCHAIN_RPC_REQUEST_TIMEOUT_MS,
  readBoundedExternalResponseText,
  withExternalRequestTimeout,
} from "./external-request-timeout.ts";
