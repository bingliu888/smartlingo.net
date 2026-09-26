import { getDatabase } from "../../../../lib/auth";
import { hangupSmartAiLiveVoice, openSmartAiLiveVoice, readSmartAiRequestText, safeSmartAiError, smartAiLiveVoiceConfigured } from "../../../../lib/smartlingo-ai-gateway";
import { maxTutorDailyLimit } from "../../../../lib/smartlingo-open-tutor-entitlement";
import {
  activateMaxLiveTutorCall, closeMaxLiveTutorCall,
  heartbeatMaxLiveTutorCall, reserveMaxLiveTutorCall,
} from "../../../../lib/smartlingo-max-live-tutor";
import { readOpenTutorProfile, resolveOpenTutorMission } from "../../../../lib/smartlingo-open-tutor";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../../../../lib/smartlingo-language-communities";
import { requestUser } from "../../../../lib/request-user";

function json(value: Record<string, unknown>, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

function uuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requestUser();
  if (!user) return json({ error: "Sign in is required." }, 401);
  const tutorSessionId = request.headers.get("x-tutor-session-id");
  const language = request.headers.get("x-learning-language") || "";
  if (!uuid(tutorSessionId)) return json({ error: "Start a Max tutor session first." }, 400);
  const limit = await maxTutorDailyLimit(user);
  if (!limit) return json({ error: "An active Max plan is required." }, 403);
  if (!smartAiLiveVoiceConfigured()) return json({ error: "Live voice is temporarily unavailable." }, 503);
  let sdp: string;
  try { sdp = await readSmartAiRequestText(request, 100_000); }
  catch (error) {
    const safe = safeSmartAiError(error, user.preferredLanguage === "zh" ? "zh" : "en", "live");
    return json({ error: safe.message, code: safe.code }, safe.status);
  }
  if (!sdp.startsWith("v=") || !sdp.includes("m=audio")) return json({ error: "Invalid voice connection request." }, 400);
  const database = getDatabase();
  const subscription = await database.prepare(`SELECT current_period_ends_at AS endsAt
    FROM subscriptions WHERE user_id=? AND cadence='max' AND status='active' LIMIT 1`)
    .bind(user.id).first<{ endsAt: number }>();
  const tutor = await database.prepare(`SELECT target_language AS language,ui_language AS uiLanguage,
    profile_json AS profileJson FROM smartlingo_max_tutor_sessions WHERE id=? AND user_id=? LIMIT 1`)
    .bind(tutorSessionId, user.id).first<{ language: string; uiLanguage: string; profileJson: string }>();
  const mission = resolveOpenTutorMission({ language, uiLanguage: tutor?.uiLanguage });
  if (!tutor || tutor.language !== language || !mission) return json({ error: "Invalid tutor language." }, 400);
  const now = Math.floor(Date.now() / 1_000);
  const id = crypto.randomUUID();
  const reservation = await reserveMaxLiveTutorCall({ database, userId: user.id,
    tutorSessionId, language, limit, now, id,
    accessEndsAt: Number(subscription?.endsAt || 0) > now ? subscription?.endsAt : undefined });
  if (!reservation) return json({ error: "Voice time is used up, or another call is active." }, 429);
  const profile = readOpenTutorProfile(tutor.profileJson);
  const support = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === mission.uiLanguage)?.nameEn || "English";
  const instructions = `You are a clearly disclosed AI language tutor, not a real person. Hold a natural, interruptible one-to-one voice conversation with a learner of ${mission.language.nameEn} (${mission.language.nativeName}). The learner chooses topics, including interests, daily life, travel, study, and culture. Listen and respond to what they actually say. Ask one short follow-up at a time, adapt difficulty to their demonstrated language, and gently correct at most one useful error per reply. Use ${support} briefly only when the learner needs support. Known practice level: ${profile.level}; learning focus: ${profile.useCase}. After several turns, offer to discuss a realistic 5/10/15/20-minute study plan, but never claim it was saved: the learner confirms plans in the page's text controls. Do not claim to be human, record raw audio, grant scores or subscriptions, or give professional medical, legal, or financial advice. Do not ask for sensitive information. Keep responses concise and warm.`;
  try {
    const answer = await openSmartAiLiveVoice({ userId: user.id, subject: `user:${user.id}`,
      paid: true, sdp, instructions, onConnected: async callId => {
        if (!await activateMaxLiveTutorCall(database, id, user.id, callId)) {
          await hangupSmartAiLiveVoice(callId);
          throw new Error("Voice connection could not be recorded.");
        }
      } });
    return new Response(answer.value.sdp, { status: 201, headers: {
      "content-type": "application/sdp", "cache-control": "no-store",
      "x-live-call-id": id, "x-live-deadline": String(reservation.deadlineAt),
    } });
  } catch (error) {
    await closeMaxLiveTutorCall({ database, id, userId: user.id,
      now: Math.floor(Date.now() / 1_000) }).catch(() => null);
    const safe = safeSmartAiError(error, user.preferredLanguage === "zh" ? "zh" : "en", "live");
    return json({ error: safe.message, code: safe.code }, safe.status);
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requestUser();
  if (!user) return json({ error: "Sign in is required." }, 401);
  const id = request.headers.get("x-live-call-id");
  if (!uuid(id)) return json({ error: "Invalid live call." }, 400);
  if (!await maxTutorDailyLimit(user)) {
    await closeMaxLiveTutorCall({ database: getDatabase(), id, userId: user.id,
      now: Math.floor(Date.now() / 1_000) });
    return json({ error: "Max access has ended." }, 403);
  }
  const remainingSeconds = await heartbeatMaxLiveTutorCall(getDatabase(), id, user.id,
    Math.floor(Date.now() / 1_000));
  if (remainingSeconds === null) return json({ error: "The live call has ended." }, 410);
  return json({ remainingSeconds });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requestUser();
  if (!user) return json({ error: "Sign in is required." }, 401);
  const id = request.headers.get("x-live-call-id");
  if (!uuid(id)) return json({ error: "Invalid live call." }, 400);
  const result = await closeMaxLiveTutorCall({ database: getDatabase(), id, userId: user.id,
    now: Math.floor(Date.now() / 1_000) });
  if (!result) return json({ error: "The call could not be closed yet. It will be retried automatically." }, 503);
  const limit = await maxTutorDailyLimit(user);
  return json({ ended: true, remainingSeconds: typeof result.usedSeconds === "number"
    ? Math.max(0, limit - result.usedSeconds) : null });
}
