import { getDatabase } from "../../../../lib/auth";
import { requestUser } from "../../../../lib/request-user";
import { maxLiveTutorDailyLimit } from "../../../../lib/smartlingo-open-tutor-entitlement";
import { readSmartAiJsonRequest, safeSmartAiError } from "../../../../lib/smartlingo-ai-gateway";
import { resolveOpenTutorMission } from "../../../../lib/smartlingo-open-tutor";

type TutorRequest = { action?: unknown; language?: unknown; uiLanguage?: unknown };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

// Keep the existing owner-bound session row used by the verified Live voice route.
// Text tutor turns and text-time billing are no longer available.
export async function POST(request: Request) {
  if (process.env.SMARTLINGO_ROLE_TUTOR_ENABLED === "0") return json({ error: "Not found." }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed." }, 403);
  let body: TutorRequest;
  try { body = await readSmartAiJsonRequest<TutorRequest>(request, 500); }
  catch (error) { const safe = safeSmartAiError(error, "en", "live"); return json({ error: safe.message }, safe.status); }
  const user = await requestUser();
  if (!user) return json({ error: "Sign in is required." }, 401);
  if (body.action !== "start") return json({ error: "Only live voice sessions are available." }, 400);
  const mission = resolveOpenTutorMission(body);
  if (!mission) return json({ error: "Choose a valid learning language." }, 400);
  const now = Math.floor(Date.now() / 1_000);
  if (!await maxLiveTutorDailyLimit(user, now)) return json({ error: "An active Max plan is required." }, 403);
  const day = Math.floor(now / 86_400);
  const database = getDatabase();
  await database.prepare(`INSERT INTO smartlingo_max_tutor_sessions
    (id,user_id,target_language,ui_language,usage_day,used_seconds,last_active_at,
     turn_count,pending_until,opening_text,transcript_json,profile_json,created_at,updated_at)
    VALUES(?,?,?,?,?,0,?,0,0,'','[]','{}',?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      id=excluded.id,target_language=excluded.target_language,ui_language=excluded.ui_language,
      usage_day=excluded.usage_day,used_seconds=0,last_active_at=excluded.last_active_at,
      turn_count=0,pending_until=0,opening_text='',transcript_json='[]',profile_json='{}',
      created_at=excluded.created_at,updated_at=excluded.updated_at
    WHERE smartlingo_max_tutor_sessions.usage_day<>excluded.usage_day
      OR smartlingo_max_tutor_sessions.target_language<>excluded.target_language`)
    .bind(crypto.randomUUID(), user.id, mission.language.code, mission.uiLanguage, day, now, now, now).run();
  await database.prepare(`UPDATE smartlingo_max_tutor_sessions SET ui_language=?,updated_at=?
    WHERE user_id=? AND usage_day=? AND target_language=? AND ui_language<>?`)
    .bind(mission.uiLanguage, now, user.id, day, mission.language.code, mission.uiLanguage).run();
  const row = await database.prepare(`SELECT id FROM smartlingo_max_tutor_sessions WHERE user_id=? AND usage_day=?
    AND target_language=? LIMIT 1`).bind(user.id, day, mission.language.code).first<{ id: string }>();
  if (!row) return json({ error: "Tutor session unavailable." }, 503);
  return json({ sessionId: row.id });
}
