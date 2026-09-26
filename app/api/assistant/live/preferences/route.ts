import { getDatabase } from "../../../../../lib/auth";
import { requestUser } from "../../../../../lib/request-user";
import { maxLiveTutorDailyLimit } from "../../../../../lib/smartlingo-open-tutor-entitlement";
import { readSmartAiJsonRequest, safeSmartAiError } from "../../../../../lib/smartlingo-ai-gateway";
import { preferredTutorVoice, tutorVoiceMatchesPortrait, validTutorPortrait, validTutorVoice } from "../../../../../lib/smartlingo-live-tutor-personas";

function json(value: Record<string, unknown>, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

function uuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

export async function GET(request: Request) {
  const user = await requestUser();
  if (!user) return json({ error: "Sign in is required." }, 401);
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId && !uuid(sessionId)) return json({ error: "Invalid tutor session." }, 400);
  if (!sessionId && !await maxLiveTutorDailyLimit(user)) return json({ error: "An active Max plan is required." }, 403);
  const row = sessionId
    ? await getDatabase().prepare(`SELECT portrait_key AS portrait,voice_key AS voice
      FROM smartlingo_max_tutor_sessions WHERE id=? AND user_id=? LIMIT 1`)
      .bind(sessionId, user.id).first<{ portrait: string; voice: string }>()
    : await getDatabase().prepare(`SELECT portrait_key AS portrait,voice_key AS voice
      FROM smartlingo_max_tutor_sessions WHERE user_id=? LIMIT 1`)
      .bind(user.id).first<{ portrait: string; voice: string }>();
  if (!row && sessionId) return json({ error: "Tutor session not found." }, 404);
  if (!row) return json({ portrait: "mei", voice: preferredTutorVoice("mei", "gleam") });
  const portrait = validTutorPortrait(row.portrait) ? row.portrait : "mei";
  return json({ portrait, voice: preferredTutorVoice(portrait, row.voice) });
}

export async function PATCH(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);
  const user = await requestUser();
  if (!user) return json({ error: "Sign in is required." }, 401);
  if (!await maxLiveTutorDailyLimit(user)) return json({ error: "An active Max plan is required." }, 403);
  let body: { sessionId?: unknown; portrait?: unknown; voice?: unknown };
  try { body = await readSmartAiJsonRequest(request, 500); }
  catch (error) { const safe = safeSmartAiError(error, "en", "live"); return json({ error: safe.message }, safe.status); }
  if (typeof body.sessionId !== "string" || !uuid(body.sessionId) || !validTutorPortrait(body.portrait) || !validTutorVoice(body.voice)
    || !tutorVoiceMatchesPortrait(body.portrait, body.voice))
    return json({ error: "Choose a valid tutor portrait and voice." }, 400);
  const row = await getDatabase().prepare(`UPDATE smartlingo_max_tutor_sessions
    SET portrait_key=?,voice_key=?,updated_at=?
    WHERE id=? AND user_id=? AND NOT EXISTS (
      SELECT 1 FROM smartlingo_max_live_tutor_calls
      WHERE user_id=? AND status IN ('connecting','active','closing'))
    RETURNING portrait_key AS portrait,voice_key AS voice`)
    .bind(body.portrait, body.voice, Math.floor(Date.now() / 1_000), body.sessionId, user.id, user.id)
    .first<{ portrait: string; voice: string }>();
  if (!row) return json({ error: "End the current call before changing your tutor, then try again." }, 409);
  return json(row);
}
