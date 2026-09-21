export const SMARTPAY5_GLC_PER_USDT = 1_000_000n;

const ONE_HUNDRED_DOLLARS_IN_CENTS = 10_000n;
const TEN_DOLLARS_IN_CENTS = 1_000n;

// Keep SmartLingo aligned with the reviewed Konectible/SmartMeeting convention:
// stablecoin prices stay exact, while the GLC equivalent rounds up to the next
// 10-token bucket below $100 and the next 100-token bucket from $100 upward.
export function smartPay5RoundedStableAmountForUsdCents(usdCents: number) {
  if (!Number.isSafeInteger(usdCents) || usdCents <= 0) {
    throw new RangeError("USD cents must be a positive safe integer");
  }
  const cents = BigInt(usdCents);
  const bucketCents = cents < ONE_HUNDRED_DOLLARS_IN_CENTS
    ? TEN_DOLLARS_IN_CENTS
    : ONE_HUNDRED_DOLLARS_IN_CENTS;
  const bucketTokens = cents < ONE_HUNDRED_DOLLARS_IN_CENTS ? 10n : 100n;
  return (((cents + bucketCents - 1n) / bucketCents) * bucketTokens).toString();
}

export function smartPay5GlcDisplayAmountForUsdCents(usdCents: number) {
  return (BigInt(smartPay5RoundedStableAmountForUsdCents(usdCents)) * SMARTPAY5_GLC_PER_USDT).toString();
}
