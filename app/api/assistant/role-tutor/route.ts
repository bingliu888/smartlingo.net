import { getDatabase } from "../../../../lib/auth";
import { consumeAiDailyQuota } from "../../../../lib/ai-daily-quota";
import { ensureSevenDayMaxTrial, hasMaxCourseAccess } from "../../../../lib/platform-entitlements";
import { requestUser } from "../../../../lib/request-user";
import {
  askSmartAi, readSmartAiJsonRequest, safeSmartAiError, smartAiRequestCountry,
} from "../../../../lib/smartlingo-ai-gateway";
import {
  ROLE_TUTOR_MAX_TURNS, ROLE_TUTOR_SECONDS, resolveRoleTutorMission,
  roleTutorInstructions, roleTutorTurnContent, validRoleTutorMessage,
} from "../../../../lib/smartlingo-role-tutor";

type TutorRequest = { action?: unknown; scene?: unknown; language?: unknown; level?: unknown; role?: unknown; uiLanguage?: unknown; sessionId?: unknown; message?: unknown };
type TutorRow = {
  id: string; userId: string; sceneId: string; roleId: string; language: string;
  level: string; uiLanguage: string; expiresAt: number; turnCount: number;
  transcriptJson: string;
};
type Exchange = { learner: string; tutor: string };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function localized(zh: boolean, chinese: string, english: string) {
  return zh ? chinese : english;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

function readHistory(value: string): Exchange[] {
  try {
    const history = JSON.parse(value);
    if (!Array.isArray(history)) return [];
    return history.slice(-4).filter((item): item is Exchange =>
      item && typeof item.learner === "string" && typeof item.tutor === "string"
      && item.learner.length <= 400 && item.tutor.length <= 1200);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  if (process.env.SMARTLINGO_ROLE_TUTOR_ENABLED === "0") return json({ error: "Not found." }, 404);
  if (!sameOrigin(request)) return json({ error: "Origin not allowed." }, 403);
  let body: TutorRequest;
  try {
    body = await readSmartAiJsonRequest<TutorRequest>(request, 2_000);
  } catch (error) {
    const safe = safeSmartAiError(error, "en", "guru");
    return json({ error: safe.message, code: safe.code }, safe.status);
  }
  const zh = body?.uiLanguage === "zh";
  const user = await requestUser();
  if (!user) return json({ error: localized(zh, "请先登录。", "Sign in is required.") }, 401);
  try {
    if (body.action === "start-trial") {
      if (await hasMaxCourseAccess(user)) return json({ active: true, trialStarted: false });
      const trial = await ensureSevenDayMaxTrial(user.id);
      return trial.active
        ? json({ active: true, trialStarted: trial.trialStarted, trialEndsAt: trial.trialEndsAt })
        : json({ error: localized(zh, "七天试用已使用，请选择 Max 方案。", "Your seven-day trial was already used. Choose a Max plan.") }, 403);
    }
    if (!await hasMaxCourseAccess(user)) {
      return json({ error: localized(zh, "需要有效 Max 方案。此操作不会启动试用。", "An active Max plan is required. This does not start a trial.") }, 403);
    }
    const database = getDatabase();
    const now = Math.floor(Date.now() / 1_000);
    if (body.action === "start") {
      const mission = resolveRoleTutorMission(body);
      if (!mission) return json({ error: localized(zh, "请选择有效场景、语言和等级。", "Choose a valid scene, language, and level.") }, 400);
      const expiresAt = now + ROLE_TUTOR_SECONDS;
      // Unique user ownership makes simultaneous/replayed starts one session;
      // an expired session may be replaced only after its full ten minutes.
      await database.prepare(`DELETE FROM smartlingo_role_tutor_sessions WHERE expires_at<=?`)
        .bind(now).run();
      await database.prepare(`INSERT INTO smartlingo_role_tutor_sessions
        (id,user_id,scene_id,role_id,language,level,ui_language,started_at,expires_at,turn_count,pending_until,transcript_json,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,0,0,'[]',?)
        ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,scene_id=excluded.scene_id,
          role_id=excluded.role_id,language=excluded.language,level=excluded.level,
          ui_language=excluded.ui_language,started_at=excluded.started_at,
          expires_at=excluded.expires_at,turn_count=0,pending_until=0,
          transcript_json='[]',updated_at=excluded.updated_at
        WHERE smartlingo_role_tutor_sessions.expires_at<=?`)
        .bind(crypto.randomUUID(), user.id, mission.scene.id, mission.role, mission.language.code,
          mission.level, mission.uiLanguage, now, expiresAt, now, now).run();
      const row = await database.prepare(`SELECT id,user_id AS userId,scene_id AS sceneId,role_id AS roleId,
        language,level,ui_language AS uiLanguage,expires_at AS expiresAt,turn_count AS turnCount,
        transcript_json AS transcriptJson FROM smartlingo_role_tutor_sessions
        WHERE user_id=? LIMIT 1`).bind(user.id).first<TutorRow>();
      if (!row || row.expiresAt <= now) return json({ error: "Session unavailable." }, 503);
      if (row.sceneId !== mission.scene.id || row.language !== mission.language.code
        || row.level !== mission.level || row.uiLanguage !== mission.uiLanguage) {
        return json({ error: localized(zh, "请先完成当前任务，稍后再切换场景。", "Finish this mission before changing scenes.") }, 409);
      }
      return json({ sessionId: row.id, expiresAt: row.expiresAt, turnCount: row.turnCount,
        maxTurns: ROLE_TUTOR_MAX_TURNS, role: row.roleId, scene: mission.scene.id,
        history: readHistory(row.transcriptJson) });
    }
    if (body.action !== "turn" || typeof body.sessionId !== "string"
      || !/^[0-9a-f-]{36}$/i.test(body.sessionId) || !validRoleTutorMessage(body.message)) {
      return json({ error: localized(zh, "请输入有效的一句话。", "Enter one valid message.") }, 400);
    }
    const row = await database.prepare(`SELECT id,user_id AS userId,scene_id AS sceneId,role_id AS roleId,
      language,level,ui_language AS uiLanguage,expires_at AS expiresAt,turn_count AS turnCount,
      transcript_json AS transcriptJson FROM smartlingo_role_tutor_sessions
      WHERE id=? AND user_id=? LIMIT 1`).bind(body.sessionId, user.id).first<TutorRow>();
    if (!row) return json({ error: "Session not found." }, 404);
    const mission = resolveRoleTutorMission({ scene: row.sceneId, language: row.language,
      level: row.level, role: row.roleId, uiLanguage: row.uiLanguage });
    if (!mission) return json({ error: "Session unavailable." }, 503);
    if (row.expiresAt <= now || row.turnCount >= ROLE_TUTOR_MAX_TURNS) {
      return json({ error: localized(zh, "本轮练习已结束。", "This practice round has ended.") }, 409);
    }
    // Both the daily quota and AI gateway are additional per-user cost caps.
    const quota = await consumeAiDailyQuota(user.id, "assistant");
    if (quota) return quota;
    // One SQLite statement is the concurrency gate. A pending request owns the
    // turn; a second request cannot reuse its stale transcript or bypass caps.
    const reserved = await database.prepare(`UPDATE smartlingo_role_tutor_sessions
      SET turn_count=turn_count+1,pending_until=?,updated_at=?
      WHERE id=? AND user_id=? AND expires_at>? AND turn_count<? AND pending_until<?
      RETURNING turn_count AS turnCount`)
      .bind(now + 25, now, row.id, user.id, now, ROLE_TUTOR_MAX_TURNS, now)
      .first<{ turnCount: number }>();
    if (!reserved) return json({ error: localized(zh, "上一句仍在处理，或练习已结束。", "The previous turn is still processing, or the session has ended.") }, 409);
    let completed = false;
    try {
      const message = body.message.trim();
      const history = readHistory(row.transcriptJson);
      const answer = await askSmartAi({
        feature: "chat_guru", subject: `user:${user.id}`, language: mission.uiLanguage,
        instructions: roleTutorInstructions(mission, reserved.turnCount),
        content: roleTutorTurnContent(history, message),
        deps: { providerPreference: user.aiProviderPreference ?? "auto", country: smartAiRequestCountry(request) },
      });
      if (answer.fallback) return json({ error: localized(zh, "导师暂时不可用，请稍后再试。", "The tutor is temporarily unavailable.") }, 503);
      const reply = answer.value.trim().slice(0, 1_200);
      if (!reply) return json({ error: "Tutor unavailable." }, 503);
      const transcript = JSON.stringify([...history, { learner: message, tutor: reply }].slice(-4));
      const saved = await database.prepare(`UPDATE smartlingo_role_tutor_sessions
        SET transcript_json=?,pending_until=0,updated_at=? WHERE id=? AND user_id=? AND turn_count=?
        RETURNING id`).bind(transcript, now, row.id, user.id, reserved.turnCount).first<{ id: string }>();
      if (!saved) return json({ error: localized(zh, "本次回复已过期，请重试。", "This reply expired. Please try again.") }, 409);
      completed = true;
      return json({ reply, turnCount: reserved.turnCount, maxTurns: ROLE_TUTOR_MAX_TURNS, expiresAt: row.expiresAt });
    } catch (error) {
      const safe = safeSmartAiError(error, mission.uiLanguage, "guru");
      return json({ error: safe.message, code: safe.code }, safe.status);
    } finally {
      if (!completed) {
        await database.prepare(`UPDATE smartlingo_role_tutor_sessions
          SET turn_count=turn_count-1,pending_until=0 WHERE id=? AND user_id=? AND turn_count=?`)
          .bind(row.id, user.id, reserved.turnCount).run();
      }
    }
  } catch {
    return json({ error: localized(zh, "导师暂时不可用，请稍后再试。", "The tutor is temporarily unavailable.") }, 503);
  }
}
