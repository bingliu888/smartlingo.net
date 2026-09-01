import { getDatabase } from "./auth";

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function durableNetworkActor(request: Request) {
  const address = (request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0] || "").trim();
  if (!address) return null;
  return (await sha256(address)).slice(0, 32);
}

export async function consumeAccountRequestLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  userId?: string | null;
  unavailableMessage?: string;
  limitedMessage?: string;
}) {
  const network = await durableNetworkActor(input.request);
  const actor = input.userId
    ? `member:${(await sha256(input.userId)).slice(0, 32)}`
    : network ? `network:${network}` : null;
  if (!actor)
    return Response.json({
      error: input.unavailableMessage || "Request protection is temporarily unavailable",
    }, {
      status: 503,
      headers: { "retry-after": "60", "cache-control": "no-store" },
    });
  const now = nowSeconds();
  const windowSeconds = Math.max(1, Math.min(3_600, Math.floor(input.windowSeconds)));
  const limit = Math.max(1, Math.min(10_000, Math.floor(input.limit)));
  try {
    const consumed = await getDatabase().prepare(`INSERT INTO account_request_limits(
      scope,actor_key,window_started_at,request_count,blocked_until,updated_at
    ) VALUES(?,?,?,1,0,?) ON CONFLICT(scope,actor_key) DO UPDATE SET
      window_started_at=CASE WHEN account_request_limits.window_started_at<=?
        THEN excluded.window_started_at ELSE account_request_limits.window_started_at END,
      request_count=CASE WHEN account_request_limits.window_started_at<=?
        THEN 1 ELSE account_request_limits.request_count+1 END,
      blocked_until=0,updated_at=excluded.updated_at
    WHERE account_request_limits.window_started_at<=?
      OR account_request_limits.request_count<?
    RETURNING request_count AS requestCount`).bind(
      input.scope.slice(0, 120),
      actor,
      now,
      now,
      now - windowSeconds,
      now - windowSeconds,
      now - windowSeconds,
      limit,
    ).first<{ requestCount: number }>();
    if (consumed) return null;
    return Response.json({
      error: input.limitedMessage || "Too many requests. Try again shortly.",
    }, {
      status: 429,
      headers: { "retry-after": String(windowSeconds), "cache-control": "no-store" },
    });
  } catch {
    return Response.json({
      error: input.unavailableMessage || "Request protection is temporarily unavailable",
    }, {
      status: 503,
      headers: { "retry-after": "60", "cache-control": "no-store" },
    });
  }
}
