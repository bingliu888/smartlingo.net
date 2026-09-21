export const SMARTPAY5_GLC_PER_USDT = 1_000_000n;

const TEN_DOLLARS_IN_CENTS = 1_000n;

// Keep SmartLingo aligned with the reviewed Konectible/SmartMeeting convention:
// stablecoin prices stay exact, while the GLC equivalent rounds up to the next
// 10-token bucket.
export function smartPay5RoundedStableAmountForUsdCents(usdCents: number) {
  if (!Number.isSafeInteger(usdCents) || usdCents <= 0) {
    throw new RangeError("USD cents must be a positive safe integer");
  }
  const cents = BigInt(usdCents);
  return (((cents + TEN_DOLLARS_IN_CENTS - 1n) / TEN_DOLLARS_IN_CENTS) * 10n).toString();
}

export function smartPay5GlcDisplayAmountForUsdCents(usdCents: number) {
  return (BigInt(smartPay5RoundedStableAmountForUsdCents(usdCents)) * SMARTPAY5_GLC_PER_USDT).toString();
}
