"use client";

import type { Hex } from "viem";

const hexBigInt = (value: unknown, error: string) => {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) throw new Error(error);
  return BigInt(value);
};

export function bufferedWalletGasLimit(value: unknown): Hex {
  const estimate = hexBigInt(value, "PAYMENT_GAS_ESTIMATE_INVALID");
  if (estimate <= 0n) throw new Error("PAYMENT_GAS_ESTIMATE_INVALID");
  return `0x${((estimate * 125n + 99n) / 100n).toString(16)}` as Hex;
}

export function walletRpcErrorData(error: unknown) {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  while (pending.length) {
    const value = pending.shift();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    if (typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)) return value.toLowerCase();
    if (typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    for (const key of ["data", "error", "cause", "originalError"]) if (record[key] != null) pending.push(record[key]);
  }
  return null;
}
