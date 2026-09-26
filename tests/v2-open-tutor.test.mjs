import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { resolveOpenTutorMission } = await tsImport("../lib/smartlingo-open-tutor.ts", import.meta.url);

test("live tutor validates the selected learning and support languages", () => {
  const japanese = resolveOpenTutorMission({ language: "ja", uiLanguage: "zh" });
  assert.equal(japanese?.language.code, "ja");
  assert.equal(japanese?.uiLanguage, "zh");
  assert.equal(resolveOpenTutorMission({ language: "xx", uiLanguage: "zh" }), null);
  assert.equal(resolveOpenTutorMission({ language: "ja", uiLanguage: "xx" }), null);
});

test("the existing session row remains owner-bound and unique per learner", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY);");
  db.prepare("INSERT INTO users(id) VALUES(?)").run("member-1");
  const migration = readFileSync(new URL("../drizzle/0191_max_open_tutor.sql", import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) db.exec(statement);
  const now = 1_800_000_000;
  db.prepare(`INSERT INTO smartlingo_max_tutor_sessions
    (id,user_id,target_language,ui_language,usage_day,last_active_at,opening_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run("session-1", "member-1", "ja", "zh", 20_833, now, "", now, now);
  assert.throws(() => db.prepare(`INSERT INTO smartlingo_max_tutor_sessions
    (id,user_id,target_language,ui_language,usage_day,last_active_at,opening_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run("session-2", "member-1", "en", "zh", 20_833, now, "", now, now), /UNIQUE/);
  assert.equal(db.prepare("SELECT id FROM smartlingo_max_tutor_sessions WHERE id=? AND user_id=?").get("session-1", "other"), undefined);
  db.prepare("UPDATE users SET id=? WHERE id=?").run("member-1-rekeyed", "member-1");
  assert.equal(db.prepare("SELECT user_id FROM smartlingo_max_tutor_sessions WHERE id=?").get("session-1").user_id, "member-1-rekeyed");
  db.close();
});

test("opening the voice stage preserves same-day tutor choice and never charges text time", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY);");
  db.prepare("INSERT INTO users(id) VALUES(?)").run("member-1");
  for (const file of ["0191_max_open_tutor.sql", "0192_max_live_tutor_calls.sql",
    "0194_live_voice_quota.sql", "0195_live_tutor_personas.sql"]) {
    const migration = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) db.exec(statement);
  }
  const route = readFileSync(new URL("../app/api/assistant/open-tutor/route.ts", import.meta.url), "utf8");
  const sql = route.match(/await database\.prepare\(`(INSERT INTO smartlingo_max_tutor_sessions[\s\S]*?)`\)/)?.[1];
  assert.ok(sql, "test runs the actual Live session upsert");
  const start = db.prepare(sql);
  start.run("session-1", "member-1", "ja", "zh", 20_833, 1_800_000_000, 1_800_000_000, 1_800_000_000);
  db.prepare("UPDATE smartlingo_max_tutor_sessions SET portrait_key='leo',voice_key='meridian' WHERE user_id=?").run("member-1");
  start.run("session-2", "member-1", "ja", "en", 20_833, 1_800_000_010, 1_800_000_010, 1_800_000_010);
  assert.deepEqual({ ...db.prepare("SELECT id,portrait_key,voice_key,used_seconds FROM smartlingo_max_tutor_sessions WHERE user_id=?").get("member-1") },
    { id: "session-1", portrait_key: "leo", voice_key: "meridian", used_seconds: 0 });
  start.run("session-3", "member-1", "en", "en", 20_833, 1_800_000_020, 1_800_000_020, 1_800_000_020);
  assert.equal(db.prepare("SELECT id FROM smartlingo_max_tutor_sessions WHERE user_id=?").get("member-1").id, "session-3");
  db.close();
});

test("Max tutor uses voice-only sessions without text tutor endpoints or controls", () => {
  const route = readFileSync(new URL("../app/api/assistant/open-tutor/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/[lang]/max/tutor/page.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/MaxVoiceTutor.tsx", import.meta.url), "utf8");
  const stage = readFileSync(new URL("../components/MaxLiveTutorCall.tsx", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(route, /maxLiveTutorDailyLimit\(user, now\)/);
  assert.match(route, /body\.action !== "start"/);
  assert.match(route, /Only live voice sessions are available/);
  assert.doesNotMatch(route, /consumeAiDailyQuota|transcriptJson|accountActiveTime|"turn"|"heartbeat"/);
  assert.match(page, /<MaxVoiceTutor/);
  assert.match(page, /ensureSevenDayMaxTrial\(user\.id\)/);
  assert.match(client, /<MaxLiveTutorCall/);
  assert.doesNotMatch(client, /role-tutor-message|text time|文字导师额度/);
  assert.match(stage, /<audio ref=\{audioRef\}/);
  assert.match(worker, /DELETE FROM smartlingo_max_tutor_sessions WHERE usage_day<\?/);
});
