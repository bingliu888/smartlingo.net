import { getDatabase } from "../../../../lib/auth";
import { consumeAiDailyQuota } from "../../../../lib/ai-daily-quota";
import { requestUser } from "../../../../lib/request-user";
import { maxTutorDailyLimit } from "../../../../lib/smartlingo-open-tutor-entitlement";
import { askSmartAi, readSmartAiJsonRequest, safeSmartAiError, smartAiRequestCountry } from "../../../../lib/smartlingo-ai-gateway";
import {
  OPEN_TUTOR_ACTIVE_TICK_SECONDS, OPEN_TUTOR_MAX_TURNS,
  openTutorInstructions, openTutorOpening, openTutorTurnContent,
  parseOpenTutorReply, readOpenTutorProfile, resolveOpenTutorMission, validOpenTutorMessage,
} from "../../../../lib/smartlingo-open-tutor";

type TutorRequest = { action?: unknown; language?: unknown; uiLanguage?: unknown; sessionId?: unknown; message?: unknown; shortAnswer?: unknown };
type TutorRow = {
  id: string; userId: string; language: string; uiLanguage: string; usageDay: number;
  usedSeconds: number; lastActiveAt: number; turnCount: number; opening: string;
  transcriptJson: string; profileJson: string;
};
type Exchange = { learner: string; tutor: string };

const SELECT = `SELECT id,user_id AS userId,target_language AS language,ui_language AS uiLanguage,
  usage_day AS usageDay,used_seconds AS usedSeconds,last_active_at AS lastActiveAt,
  turn_count AS turnCount,opening_text AS opening,transcript_json AS transcriptJson,
  profile_json AS profileJson FROM smartlingo_max_tutor_sessions`;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function readHistory(value: string): Exchange[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-8).filter((item): item is Exchange => item && typeof item.learner === "string"
      && typeof item.tutor === "string" && item.learner.length <= 800 && item.tutor.length <= 1_200);
  } catch { return []; }
}

async function accountActiveTime(database: ReturnType<typeof getDatabase>, row: TutorRow, now: number, limit: number) {
  return database.prepare(`UPDATE smartlingo_max_tutor_sessions
    SET used_seconds=MIN(?,used_seconds+MIN(?,MAX(0,?-last_active_at))),
      last_active_at=?,updated_at=?
    WHERE id=? AND user_id=? AND usage_day=?
    RETURNING used_seconds AS usedSeconds`)
    .bind(limit, OPEN_TUTOR_ACTIVE_TICK_SECONDS, now, now, now, row.id, row.userId, row.usageDay)
    .first<{ usedSeconds: number }>();
}

export async function POST(request: Request) {
  if (process.env.SMARTLINGO_ROLE_TUTOR_ENABLED === "0") return json({ error: "Not found." }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed." }, 403);
  let body: TutorRequest;
  try { body = await readSmartAiJsonRequest<TutorRequest>(request, 2_000); }
  catch (error) { const safe = safeSmartAiError(error, "en", "guru"); return json({ error: safe.message, code: safe.code }, safe.status); }
  const zh = body?.uiLanguage === "zh";
  const user = await requestUser();
  if (!user) return json({ error: zh ? "请先登录。" : "Sign in is required." }, 401);
  try {
    const now = Math.floor(Date.now() / 1_000);
    const day = Math.floor(now / 86_400);
    const limit = await maxTutorDailyLimit(user, now);
    if (!limit) return json({ error: zh ? "需要有效旗舰版方案。" : "An active Max plan is required." }, 403);
    const database = getDatabase();
    if (body.action === "start") {
      const mission = resolveOpenTutorMission(body);
      if (!mission) return json({ error: zh ? "请选择有效学习语言。" : "Choose a valid learning language." }, 400);
      const opening = openTutorOpening(mission.language.code);
      await database.prepare(`INSERT INTO smartlingo_max_tutor_sessions
        (id,user_id,target_language,ui_language,usage_day,used_seconds,last_active_at,
         turn_count,pending_until,opening_text,transcript_json,profile_json,created_at,updated_at)
        VALUES(?,?,?,?,?,0,?,0,0,?,'[]','{}',?,?)
        ON CONFLICT(user_id) DO UPDATE SET
          id=excluded.id,target_language=excluded.target_language,ui_language=excluded.ui_language,
          usage_day=excluded.usage_day,used_seconds=CASE WHEN smartlingo_max_tutor_sessions.usage_day=excluded.usage_day
            THEN smartlingo_max_tutor_sessions.used_seconds ELSE 0 END,
          last_active_at=excluded.last_active_at,turn_count=0,pending_until=0,
          opening_text=excluded.opening_text,transcript_json='[]',profile_json='{}',
          created_at=excluded.created_at,updated_at=excluded.updated_at
        WHERE smartlingo_max_tutor_sessions.usage_day<>excluded.usage_day
          OR smartlingo_max_tutor_sessions.target_language<>excluded.target_language`)
        .bind(crypto.randomUUID(), user.id, mission.language.code, mission.uiLanguage, day, now, opening, now, now).run();
      // Switching the site language changes the learner's support language,
      // without changing the selected learning language or resetting progress.
      await database.prepare(`UPDATE smartlingo_max_tutor_sessions
        SET ui_language=?,opening_text=?,updated_at=?
        WHERE user_id=? AND usage_day=? AND target_language=? AND (ui_language<>? OR opening_text<>?)`)
        .bind(mission.uiLanguage, opening, now, user.id, day, mission.language.code, mission.uiLanguage, opening).run();
      const row = await database.prepare(`${SELECT} WHERE user_id=? LIMIT 1`).bind(user.id).first<TutorRow>();
      if (!row || row.usageDay !== day || row.language !== mission.language.code) return json({ error: "Tutor session unavailable." }, 503);
      const charged = await accountActiveTime(database, row, now, limit);
      if (!charged) return json({ error: "Tutor session unavailable." }, 503);
      return json({ sessionId: row.id, opening: row.opening, history: readHistory(row.transcriptJson),
        profile: readOpenTutorProfile(row.profileJson), turnCount: row.turnCount,
        maxTurns: OPEN_TUTOR_MAX_TURNS, remainingSeconds: Math.max(0, limit - charged.usedSeconds),
        dailyLimitSeconds: limit, expiresAt: (day + 1) * 86_400 });
    }
    if ((body.action !== "heartbeat" && body.action !== "turn")
      || typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sessionId)
      || (body.action === "turn" && !validOpenTutorMessage(body.message))) {
      return json({ error: zh ? "请求无效。" : "Invalid tutor request." }, 400);
    }
    const row = await database.prepare(`${SELECT} WHERE id=? AND user_id=? LIMIT 1`)
      .bind(body.sessionId, user.id).first<TutorRow>();
    if (!row || row.usageDay !== day) return json({ error: zh ? "今天的导师会话已结束，请重新开始。" : "Today's tutor session ended. Start again." }, 409);
    const charged = await accountActiveTime(database, row, now, limit);
    if (!charged) return json({ error: "Tutor session unavailable." }, 503);
    const remainingSeconds = Math.max(0, limit - charged.usedSeconds);
    if (body.action === "heartbeat") return json({ remainingSeconds, dailyLimitSeconds: limit, expiresAt: (day + 1) * 86_400 });
    if (!remainingSeconds || row.turnCount >= OPEN_TUTOR_MAX_TURNS) {
      return json({ error: zh ? "今日导师时间或回复次数已用完。" : "Today's tutor time or replies are used up.", remainingSeconds }, 429);
    }
    const quota = await consumeAiDailyQuota(user.id, "assistant");
    if (quota) return quota;
    const reserved = await database.prepare(`UPDATE smartlingo_max_tutor_sessions
      SET turn_count=turn_count+1,pending_until=?,updated_at=?
      WHERE id=? AND user_id=? AND usage_day=? AND used_seconds<? AND turn_count<? AND pending_until<?
      RETURNING turn_count AS turnCount`)
      .bind(now + 25, now, row.id, user.id, day, limit, OPEN_TUTOR_MAX_TURNS, now)
      .first<{ turnCount: number }>();
    if (!reserved) return json({ error: zh ? "上一句仍在处理，或时间已用完。" : "The previous turn is processing, or time is up." }, 409);
    let completed = false;
    try {
      const mission = resolveOpenTutorMission({ language: row.language, uiLanguage: row.uiLanguage });
      if (!mission) return json({ error: "Tutor session unavailable." }, 503);
      const history = readHistory(row.transcriptJson);
      const profile = readOpenTutorProfile(row.profileJson);
      const message = (body.message as string).trim();
      const answer = await askSmartAi({
        feature: "chat_guru", subject: `user:${user.id}`,
        language: mission.uiLanguage === "zh" ? "zh" : "en",
        instructions: openTutorInstructions(mission, reserved.turnCount, body.shortAnswer === true),
        content: openTutorTurnContent(history, message, row.opening, profile),
        deps: { providerPreference: user.aiProviderPreference ?? "auto", country: smartAiRequestCountry(request) },
      });
      if (answer.fallback) return json({ error: zh ? "导师暂时不可用，请稍后重试。" : "The tutor is temporarily unavailable." }, 503);
      const parsed = parseOpenTutorReply(answer.value, profile, reserved.turnCount);
      if (!parsed) return json({ error: zh ? "导师回复暂时不可用，请重试。" : "The tutor response is unavailable. Try again." }, 503);
      const transcript = JSON.stringify([...history, { learner: message, tutor: parsed.reply }].slice(-8));
      const saved = await database.prepare(`UPDATE smartlingo_max_tutor_sessions
        SET transcript_json=?,profile_json=?,pending_until=0,updated_at=?
        WHERE id=? AND user_id=? AND turn_count=? RETURNING id`)
        .bind(transcript, JSON.stringify(parsed.profile), now, row.id, user.id, reserved.turnCount)
        .first<{ id: string }>();
      if (!saved) return json({ error: zh ? "本次回复已过期，请重试。" : "This reply expired. Try again." }, 409);
      completed = true;
      return json({ reply: parsed.reply, profile: parsed.profile, turnCount: reserved.turnCount,
        maxTurns: OPEN_TUTOR_MAX_TURNS, remainingSeconds });
    } catch (error) {
      const safe = safeSmartAiError(error, row.uiLanguage === "zh" ? "zh" : "en", "guru");
      return json({ error: safe.message, code: safe.code }, safe.status);
    } finally {
      if (!completed) await database.prepare(`UPDATE smartlingo_max_tutor_sessions
        SET turn_count=turn_count-1,pending_until=0 WHERE id=? AND user_id=? AND turn_count=?`)
        .bind(row.id, user.id, reserved.turnCount).run();
    }
  } catch {
    return json({ error: zh ? "导师暂时不可用，请稍后再试。" : "The tutor is temporarily unavailable." }, 503);
  }
}
