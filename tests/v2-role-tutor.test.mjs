import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  ROLE_TUTOR_MAX_TURNS, ROLE_TUTOR_SECONDS, resolveRoleTutorMission,
  roleTutorInstructions, roleTutorTurnContent, validRoleTutorMessage,
} from "../lib/smartlingo-role-tutor.ts";

test("role tutor accepts only fixed scene, language, level and scene-owned role", () => {
  const cafe = resolveRoleTutorMission({ scene: "cafe", language: "ja", level: "beginner", uiLanguage: "zh" });
  assert.equal(cafe?.role, "coffee shop barista");
  assert.match(roleTutorInstructions(cafe), /simulated AI coffee shop barista/);
  assert.match(roleTutorInstructions(cafe), /not a real person/);
  assert.match(roleTutorInstructions(cafe, 2), /guided opening/);
  assert.match(roleTutorInstructions(cafe, 5), /situational variation/);
  assert.match(roleTutorInstructions(cafe, 10), /independent transfer/);
  for (const bad of [
    { scene: "invented", language: "ja", level: "beginner", uiLanguage: "zh" },
    { scene: "cafe", language: "xx", level: "beginner", uiLanguage: "zh" },
    { scene: "cafe", language: "ja", level: "expert", uiLanguage: "zh" },
    { scene: "cafe", language: "ja", level: "beginner", uiLanguage: "fr" },
    { scene: "cafe", language: "ja", level: "beginner", uiLanguage: "zh", role: "doctor" },
  ]) assert.equal(resolveRoleTutorMission(bad), null);
  assert.equal(validRoleTutorMessage("hello"), true);
  assert.equal(validRoleTutorMessage(" "), false);
  assert.equal(validRoleTutorMessage("x".repeat(401)), false);
  assert.deepEqual(JSON.parse(roleTutorTurnContent([], "hello")), { priorExchanges: [], learnerMessage: "hello" });
});

test("SQLite user ownership and atomic reservation reject replay, overlap, expiry and turn 13", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY);");
  database.prepare("INSERT INTO users(id) VALUES(?)").run("member-1");
  const migration = readFileSync(new URL("../drizzle/0187_role_tutor_sessions.sql", import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) database.exec(statement);
  const now = 1_800_000_000;
  const insert = database.prepare(`INSERT OR IGNORE INTO smartlingo_role_tutor_sessions
    (id,user_id,scene_id,role_id,language,level,ui_language,started_at,expires_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`);
  insert.run("session-1", "member-1", "cafe", "coffee shop barista", "ja", "beginner", "zh", now, now + ROLE_TUTOR_SECONDS, now);
  insert.run("session-2", "member-1", "bank", "bank reception desk attendant", "ja", "advanced", "zh", now, now + ROLE_TUTOR_SECONDS, now);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM smartlingo_role_tutor_sessions").get().count, 1);
  const reserve = database.prepare(`UPDATE smartlingo_role_tutor_sessions
    SET turn_count=turn_count+1,pending_until=?,updated_at=?
    WHERE id=? AND user_id=? AND expires_at>? AND turn_count<? AND pending_until<?
    RETURNING turn_count AS turnCount`);
  assert.equal(reserve.get(now + 25, now, "session-1", "other-user", now, ROLE_TUTOR_MAX_TURNS, now), undefined);
  assert.equal(reserve.get(now + 25, now, "session-1", "member-1", now, ROLE_TUTOR_MAX_TURNS, now).turnCount, 1);
  assert.equal(reserve.get(now + 25, now, "session-1", "member-1", now, ROLE_TUTOR_MAX_TURNS, now), undefined, "concurrent/replayed turn is refused");
  for (let turn = 2; turn <= ROLE_TUTOR_MAX_TURNS; turn += 1) {
    database.prepare("UPDATE smartlingo_role_tutor_sessions SET pending_until=0 WHERE id=?").run("session-1");
    assert.equal(reserve.get(now + 25, now, "session-1", "member-1", now, ROLE_TUTOR_MAX_TURNS, now).turnCount, turn);
  }
  database.prepare("UPDATE smartlingo_role_tutor_sessions SET pending_until=0 WHERE id=?").run("session-1");
  assert.equal(reserve.get(now + 25, now, "session-1", "member-1", now, ROLE_TUTOR_MAX_TURNS, now), undefined, "turn 13 is refused");
  assert.equal(reserve.get(now + 625, now + 601, "session-1", "member-1", now + 601, ROLE_TUTOR_MAX_TURNS, now + 601), undefined, "expired session is refused");
  database.prepare("UPDATE users SET id=? WHERE id=?").run("member-1-rekeyed", "member-1");
  assert.equal(database.prepare("SELECT user_id AS userId FROM smartlingo_role_tutor_sessions WHERE id=?").get("session-1").userId, "member-1-rekeyed");
  database.close();
});

test("role tutor uses explicit trial, speech authorization and keeps legacy live SDP disabled", () => {
  const route = readFileSync(new URL("../app/api/assistant/role-tutor/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/[lang]/assistant/role-tutor/page.tsx", import.meta.url), "utf8");
  const live = readFileSync(new URL("../app/api/assistant/live/route.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/RoleTutor.tsx", import.meta.url), "utf8");
  const everyday = readFileSync(new URL("../app/[lang]/play/everyday/page.tsx", import.meta.url), "utf8");
  const player = readFileSync(new URL("../components/EverydaySpeakingPlayer.tsx", import.meta.url), "utf8");
  const speech = readFileSync(new URL("../app/api/assistant/role-tutor/speech/route.ts", import.meta.url), "utf8");
  assert.match(route, /SMARTLINGO_ROLE_TUTOR_ENABLED === "0"/);
  assert.match(page, /SMARTLINGO_ROLE_TUTOR_ENABLED === "0"/);
  assert.match(route, /body\.action === "start-trial"/);
  assert.match(route, /ensureSevenDayMaxTrial\(user\.id\)/);
  assert.match(client, /onClick=\{startTrial\}/);
  assert.match(client, /getUserMedia/);
  assert.match(client, /speakLearningText/);
  assert.match(speech, /hasMaxCourseAccess\(user\)/);
  assert.match(speech, /WHERE id=\? AND user_id=\?/);
  assert.match(speech, /transcribeSmartAiSpeech/);
  assert.match(speech, /consumeAiDailyQuota\(user\.id, "assistant"\)/);
  assert.match(route, /hasMaxCourseAccess\(user\)/);
  assert.match(route, /consumeAiDailyQuota\(user\.id, "assistant"\)/);
  assert.match(route, /origin === new URL\(request\.url\)\.origin/);
  assert.match(live, /SMARTLINGO_MAX_ROLE_TUTOR_ENABLED !== "1"/);
  assert.match(worker, /DELETE FROM smartlingo_role_tutor_sessions WHERE expires_at<=\?/);
  assert.match(client, /last four exchanges are kept briefly for context and cleared/);
  assert.match(everyday, /siteLang=\{lang\}/);
  assert.match(player, /\$\{siteLang\}\/assistant\/role-tutor/);
  assert.doesNotMatch(route, /clientSecret|sdp/);
});
