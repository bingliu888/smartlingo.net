import {
  readBoundedExternalResponseText,
  STRIPE_REQUEST_TIMEOUT_MS,
  withExternalRequestTimeout,
} from "./external-request-timeout";

export async function runtimeValue(name: string) {
  const { env } = await import("cloudflare:workers");
  return String((env as unknown as Record<string, string | undefined>)[name] || "").trim();
}

export async function stripeRequest<T>(path: string, init?: RequestInit) {
  const secret = await runtimeValue("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const { response, raw } = await withExternalRequestTimeout(async (signal) => {
    const response = await fetch(`https://api.stripe.com/v1${path}`, {
      ...init,
      signal,
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/x-www-form-urlencoded", ...init?.headers },
    });
    const raw = await readBoundedExternalResponseText(response, 256 * 1024);
    return { response, raw };
  }, STRIPE_REQUEST_TIMEOUT_MS);
  if (raw.truncated) throw new Error("STRIPE_RESPONSE_TOO_LARGE");
  let data = {} as T & { error?: { message?: string } };
  try { data = JSON.parse(raw.text) as typeof data; } catch { /* invalid upstream JSON */ }
  if (!response.ok) throw new Error(data.error?.message || "STRIPE_REQUEST_FAILED");
  return data;
}
