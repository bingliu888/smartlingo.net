import { getDatabase } from "../../../../../lib/auth";
import { consumeAiDailyQuota } from "../../../../../lib/ai-daily-quota";
import { maxTutorDailyLimit } from "../../../../../lib/smartlingo-open-tutor-entitlement";
import { requestUser } from "../../../../../lib/request-user";
import { isSmartAiGatewayError, transcribeSmartAiSpeech } from "../../../../../lib/smartlingo-ai-gateway";
import { isSmartLingoCommunityLanguage } from "../../../../../lib/smartlingo-language-communities";

// Uses the same bounded, server-transcribed push-to-talk flow as scene role-play.
const MAX_AUDIO_BYTES = 750_000;

export async function POST(request: Request) {
  if (process.env.SMARTLINGO_ROLE_TUTOR_ENABLED === "0") return Response.json({ error: "Not found." }, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origin not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES + 80_000) {
    return Response.json({ error: "Audio is too large." }, { status: 413 });
  }
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const now = Math.floor(Date.now() / 1_000);
  const limit = await maxTutorDailyLimit(user, now);
  if (!limit) return Response.json({ error: "An active Max plan is required." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const sessionId = form?.get("sessionId");
  const audio = form?.get("audio");
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)
    || !(audio instanceof File) || audio.size < 256 || audio.size > MAX_AUDIO_BYTES
    || !audio.type.startsWith("audio/")) {
    return Response.json({ error: "Invalid speech input." }, { status: 400 });
  }
  const row = await getDatabase().prepare(`SELECT target_language AS language,usage_day AS usageDay,
    used_seconds AS usedSeconds,turn_count AS turnCount
    FROM smartlingo_max_tutor_sessions WHERE id=? AND user_id=? LIMIT 1`)
    .bind(sessionId, user.id).first<{ language: string; usageDay: number; usedSeconds: number; turnCount: number }>();
  if (!row || row.usageDay !== Math.floor(now / 86_400) || row.usedSeconds >= limit
    || row.turnCount >= 60 || !isSmartLingoCommunityLanguage(row.language)) {
    return Response.json({ error: "Today's tutor time has ended." }, { status: 409 });
  }
  const quota = await consumeAiDailyQuota(user.id, "assistant");
  if (quota) return quota;
  try {
    const result = await transcribeSmartAiSpeech({
      subject: `user:${user.id}:open-tutor`, audio, language: row.language,
      deps: { database: getDatabase() },
    });
    return Response.json({ transcript: result.value.trim().slice(0, 800) },
      { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "Speech recognition is temporarily unavailable." },
      { status: isSmartAiGatewayError(error) ? error.status : 503 });
  }
}
