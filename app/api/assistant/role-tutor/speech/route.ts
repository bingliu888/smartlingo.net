import { getDatabase } from "../../../../../lib/auth";
import { consumeAiDailyQuota } from "../../../../../lib/ai-daily-quota";
import { hasMaxCourseAccess } from "../../../../../lib/platform-entitlements";
import { requestUser } from "../../../../../lib/request-user";
import { isSmartAiGatewayError, transcribeSmartAiSpeech } from "../../../../../lib/smartlingo-ai-gateway";
import { resolveRoleTutorMission } from "../../../../../lib/smartlingo-role-tutor";

const MAX_AUDIO_BYTES = 750_000;

export async function POST(request: Request) {
  if (process.env.SMARTLINGO_ROLE_TUTOR_ENABLED === "0") return Response.json({ error: "Not found." }, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origin not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES + 80_000) {
    return Response.json({ error: "Audio is too large." }, { status: 413 });
  }
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!await hasMaxCourseAccess(user)) return Response.json({ error: "An active Max plan is required." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const sessionId = form?.get("sessionId");
  const audio = form?.get("audio");
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)
    || !(audio instanceof File) || audio.size < 256 || audio.size > MAX_AUDIO_BYTES
    || !audio.type.startsWith("audio/")) {
    return Response.json({ error: "Invalid speech input." }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1_000);
  const row = await getDatabase().prepare(`SELECT scene_id AS scene,language,level,role_id AS role,
    ui_language AS uiLanguage,expires_at AS expiresAt,turn_count AS turnCount
    FROM smartlingo_role_tutor_sessions WHERE id=? AND user_id=? LIMIT 1`)
    .bind(sessionId, user.id).first<{ scene: string; language: string; level: string; role: string;
      uiLanguage: string; expiresAt: number; turnCount: number }>();
  if (!row || row.expiresAt <= now || row.turnCount >= 12
    || !resolveRoleTutorMission(row)) {
    return Response.json({ error: "This practice round has ended." }, { status: 409 });
  }
  const quota = await consumeAiDailyQuota(user.id, "assistant");
  if (quota) return quota;
  try {
    const result = await transcribeSmartAiSpeech({
      subject: `user:${user.id}:role-tutor`, audio, language: row.language,
      deps: { database: getDatabase() },
    });
    return Response.json({ transcript: result.value.trim().slice(0, 400) },
      { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "Speech recognition is temporarily unavailable." },
      { status: isSmartAiGatewayError(error) ? error.status : 503 });
  }
}
