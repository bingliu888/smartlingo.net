import type { CryptoSubscriptionPlan } from "./crypto-subscription";

type VerificationData = {
  verified?: boolean;
  paymentMode?: string;
  paymentId?: string | null;
  alreadyRecorded?: boolean;
  currentPeriodStart?: number;
  currentPeriodEnd?: number | null;
  error?: string;
};

const RETRYABLE_VERIFICATION_STATUSES = new Set([425, 429, 502, 503, 504]);

export async function verifyCryptoPaymentWithConfirmations(input: {
  settingId: string;
  plan: CryptoSubscriptionPlan;
  classId: string;
  txHash: string;
  paymentId?: string;
  memberId?: string;
  supervisorRefId?: string;
  attempts?: number;
  initialDelayMs?: number;
  intervalMs?: number;
  fetcher?: typeof fetch;
  pause?: (milliseconds: number) => Promise<void>;
  onRetry?: (input: {
    retryNumber: number;
    retriesRemaining: number;
    intervalMs: number;
    status: number;
    error?: string;
  }) => void;
  onInitialWait?: (milliseconds: number) => void;
}) {
  const fetcher = input.fetcher || fetch;
  const pause = input.pause || (milliseconds => new Promise(resolve => globalThis.setTimeout(resolve, milliseconds)));
  const requestedAttempts = Number.isFinite(input.attempts) ? Math.floor(input.attempts!) : 4;
  const requestedInitialDelay = Number.isFinite(input.initialDelayMs) ? Math.floor(input.initialDelayMs!) : 0;
  const requestedInterval = Number.isFinite(input.intervalMs) ? Math.floor(input.intervalMs!) : 10_000;
  const attempts = Math.min(4, Math.max(1, requestedAttempts));
  const initialDelayMs = Math.min(10_000, Math.max(0, requestedInitialDelay));
  const intervalMs = Math.min(30_000, Math.max(0, requestedInterval));
  if (initialDelayMs > 0) {
    input.onInitialWait?.(initialDelayMs);
    await pause(initialDelayMs);
  }
  let last: { response: Response; data: VerificationData } | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    let data: VerificationData;
    try {
      response = await fetcher("/api/billing/crypto/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: input.plan,
          classId: input.classId,
          settingId: input.settingId,
          txHash: input.txHash,
          ...(input.paymentId ? { paymentId: input.paymentId } : {}),
          ...(input.memberId ? { memberId: input.memberId } : {}),
          ...(input.supervisorRefId ? { supervisorRefId: input.supervisorRefId } : {}),
        })
      });
      data = await response.json().catch(() => ({})) as VerificationData;
    } catch {
      response = new Response(JSON.stringify({ error: "Payment verification request is temporarily unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" }
      });
      data = { error: "Payment verification request is temporarily unavailable" };
    }
    last = { response, data };
    if (!RETRYABLE_VERIFICATION_STATUSES.has(response.status) || attempt === attempts - 1) {
      return { ...last, attemptsUsed: attempt + 1 };
    }
    input.onRetry?.({
      retryNumber: attempt + 1,
      retriesRemaining: attempts - attempt - 1,
      intervalMs,
      status: response.status,
      error: data.error
    });
    await pause(intervalMs);
  }
  if (!last) throw new Error("PAYMENT_VERIFICATION_UNAVAILABLE");
  return { ...last, attemptsUsed: attempts };
}
