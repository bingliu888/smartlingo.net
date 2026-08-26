export function normalizeTokenAmount(value: unknown, decimals: number) {
  const raw = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error("INVALID_TOKEN_AMOUNT");
  const [wholeRaw, fractionRaw = ""] = raw.split(".");
  if (fractionRaw.length > decimals) throw new Error("INVALID_TOKEN_AMOUNT");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const fraction = fractionRaw.replace(/0+$/, "");
  if (whole === "0" && !fraction) throw new Error("INVALID_TOKEN_AMOUNT");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function tokenAmountToAtomic(value: string, decimals: number) {
  const normalized = normalizeTokenAmount(value, decimals);
  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(paddedFraction || "0");
}

export function atomicTokenAmountToDisplay(value: bigint | string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error("INVALID_TOKEN_DECIMALS");
  const atomic = typeof value === "bigint" ? value : BigInt(value);
  if (atomic < 0n) throw new Error("INVALID_TOKEN_AMOUNT");
  if (decimals === 0) return atomic.toString();
  const digits = atomic.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export type SmartPayWithdrawalPreflight =
  | { ok: true; amountAtomic: bigint; balanceAtomic: bigint }
  | { ok: false; reason: "invalid-amount" | "balance-unavailable" | "insufficient-balance"; amountAtomic?: bigint; balanceAtomic?: bigint };

export function smartPayWithdrawalPreflight(
  amount: string,
  decimals: number,
  balanceAtomic: string | null
): SmartPayWithdrawalPreflight {
  let amountAtomic: bigint;
  try {
    amountAtomic = tokenAmountToAtomic(amount, decimals);
  } catch {
    return { ok: false, reason: "invalid-amount" };
  }
  if (balanceAtomic == null) return { ok: false, reason: "balance-unavailable", amountAtomic };
  try {
    const available = BigInt(balanceAtomic);
    if (available < 0n) return { ok: false, reason: "balance-unavailable", amountAtomic };
    if (amountAtomic > available) {
      return { ok: false, reason: "insufficient-balance", amountAtomic, balanceAtomic: available };
    }
    return { ok: true, amountAtomic, balanceAtomic: available };
  } catch {
    return { ok: false, reason: "balance-unavailable", amountAtomic };
  }
}
