import { getDatabase } from "./auth";

export type AiDailyQuotaKind = "assistant" | "class-share-image" | "referral-image";

const POLICY: Record<AiDailyQuotaKind, { defaultLimit: number; hardLimit: number; env: string }> = {
  assistant: { defaultLimit: 40, hardLimit: 120, env: "AI_TEXT_DAILY_LIMIT" },
  "class-share-image": { defaultLimit: 4, hardLimit: 12, env: "CLASS_SHARE_IMAGE_DAILY_LIMIT" },
  "referral-image": { defaultLimit: 3, hardLimit: 8, env: "REFERRAL_IMAGE_DAILY_LIMIT" },
};

function configuredLimit(kind: AiDailyQuotaKind, values: Record<string, unknown>) {
  const policy = POLICY[kind];
  const value = Number(values[policy.env]);
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, policy.hardLimit)
    : policy.defaultLimit;
}

export async function consumeAiDailyQuota(userId: string, kind: AiDailyQuotaKind) {
  const now = Math.floor(Date.now() / 1_000);
  const usageDay = Math.floor(now / 86_400);
  try {
    const { env } = await import("cloudflare:workers");
    const limit = configuredLimit(kind, env as unknown as Record<string, unknown>);
    const consumed = await getDatabase().prepare(`INSERT INTO member_ai_daily_quotas(
      user_id,quota_kind,usage_day,used_count,created_at,updated_at
    ) VALUES(?,?,?,1,?,?) ON CONFLICT(user_id,quota_kind) DO UPDATE SET
      usage_day=excluded.usage_day,
      used_count=CASE WHEN member_ai_daily_quotas.usage_day=excluded.usage_day
        THEN member_ai_daily_quotas.used_count+1 ELSE 1 END,
      created_at=CASE WHEN member_ai_daily_quotas.usage_day=excluded.usage_day
        THEN member_ai_daily_quotas.created_at ELSE excluded.created_at END,
      updated_at=excluded.updated_at
    WHERE member_ai_daily_quotas.usage_day<>excluded.usage_day
      OR member_ai_daily_quotas.used_count<?
    RETURNING used_count AS usedCount`).bind(
      userId,
      kind,
      usageDay,
      now,
      now,
      limit,
    ).first<{ usedCount: number }>();
    if (consumed) return null;
    return Response.json({ error: "Daily AI request limit reached" }, {
      status: 429,
      headers: {
        "retry-after": String(Math.max(1, (usageDay + 1) * 86_400 - now)),
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "AI quota protection is temporarily unavailable" }, {
      status: 503,
      headers: { "retry-after": "60", "cache-control": "no-store" },
    });
  }
}
