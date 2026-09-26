import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
const {
  OPEN_TUTOR_MAX_TURNS, OPEN_TUTOR_PAID_SECONDS, OPEN_TUTOR_TRIAL_SECONDS,
  defaultOpenTutorProfile, openTutorInstructions, openTutorOpening,
  openTutorTurnContent, parseOpenTutorReply, resolveOpenTutorMission,
  validOpenTutorMessage,
} = await tsImport("../lib/smartlingo-open-tutor.ts", import.meta.url);

test("open tutor accepts a real language, disclosed AI identity and unconstrained learner topics", () => {
  const mission = resolveOpenTutorMission({ language: "ja", uiLanguage: "zh" });
  assert.equal(mission?.language.code, "ja");
  assert.match(openTutorOpening("zh"), /AI 导师/);
  assert.match(openTutorOpening("ja"), /AIの先生/);
  assert.ok(openTutorOpening("ja").length < 45);
  assert.match(openTutorInstructions(mission, 3), /OPEN conversation, not a fixed scenario/);
  assert.match(openTutorInstructions(mission, 3), /learner chooses topics/);
  assert.match(openTutorInstructions(mission, 3), /actual Japanese production/);
  assert.match(openTutorInstructions(mission, 3), /never claim to save it until the learner confirms/);
  assert.equal(resolveOpenTutorMission({ language: "xx", uiLanguage: "zh" }), null);
  const frenchSupport = resolveOpenTutorMission({ language: "ja", uiLanguage: "fr" });
  assert.equal(frenchSupport?.language.code, "ja");
  assert.equal(frenchSupport?.uiLanguage, "fr");
  assert.match(openTutorInstructions(frenchSupport, 3), /Write the reply in Japanese, not French/);
  assert.match(openTutorInstructions(frenchSupport, 3, true), /one short sentence of at most 12 words/);
  assert.match(openTutorOpening("fr"), /tuteur IA/);
  const route = readFileSync(new URL("../app/api/assistant/open-tutor/route.ts", import.meta.url), "utf8");
  assert.match(route, /openTutorOpening\(mission\.language\.code\)/);
  assert.equal(resolveOpenTutorMission({ language: "ja", uiLanguage: "xx" }), null);
  assert.equal(validOpenTutorMessage("I enjoy cooking"), true);
  assert.equal(validOpenTutorMessage("  "), false);
  assert.equal(validOpenTutorMessage("x".repeat(801)), false);
  const context = JSON.parse(openTutorTurnContent([{ learner: "I cook", tutor: "What do you cook?" }], "Noodles", "Hello", defaultOpenTutorProfile()));
  assert.equal(context.learnerMessage, "Noodles");
  assert.equal(context.tutorOpening, "Hello");
  assert.equal(context.priorExchanges.length, 1);
});

test("level is not judged from one answer; suggestions are bounded and malformed replies fail", () => {
  const prior = defaultOpenTutorProfile();
  const answer = JSON.stringify({ reply: "What do you enjoy cooking?", level: "intermediate", levelReason: "Used a past tense correctly", interests: "cooking", useCase: "daily_life", dailyMinutes: 15, planFocus: "Describe one recipe daily" });
  assert.equal(parseOpenTutorReply(answer, prior, 1)?.profile.level, "unknown");
  const parsed = parseOpenTutorReply(answer, prior, 2);
  assert.equal(parsed?.profile.level, "intermediate");
  assert.equal(parsed?.profile.interests, "cooking");
  assert.equal(parsed?.profile.dailyMinutes, 15);
  const invalid = parseOpenTutorReply(JSON.stringify({ reply: "Continue", level: "expert", dailyMinutes: 999 }), parsed.profile, 3);
  assert.equal(invalid?.profile.level, "intermediate");
  assert.equal(invalid?.profile.dailyMinutes, 10);
  assert.equal(parseOpenTutorReply("not JSON", prior, 2), null);
  assert.equal(OPEN_TUTOR_TRIAL_SECONDS, 600);
  assert.equal(OPEN_TUTOR_PAID_SECONDS, 1800);
  assert.equal(OPEN_TUTOR_MAX_TURNS, 180);
});

test("SQLite session is owner-bound, one per learner, has an atomic daily cap and follows user rekey", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY);");
  db.prepare("INSERT INTO users(id) VALUES(?)").run("member-1");
  const migration = readFileSync(new URL("../drizzle/0191_max_open_tutor.sql", import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) db.exec(statement);
  const now = 1_800_000_000;
  db.prepare(`INSERT INTO smartlingo_max_tutor_sessions
    (id,user_id,target_language,ui_language,usage_day,last_active_at,opening_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run("session-1", "member-1", "ja", "zh", 20_833, now, "Hello", now, now);
  assert.throws(() => db.prepare(`INSERT INTO smartlingo_max_tutor_sessions
    (id,user_id,target_language,ui_language,usage_day,last_active_at,opening_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run("session-2", "member-1", "en", "zh", 20_833, now, "Hello", now, now), /UNIQUE/);
  const tick = db.prepare(`UPDATE smartlingo_max_tutor_sessions
    SET used_seconds=MIN(?,used_seconds+MIN(30,MAX(0,?-last_active_at))),last_active_at=?
    WHERE id=? AND user_id=? AND usage_day=? RETURNING used_seconds AS usedSeconds`);
  assert.equal(tick.get(600, now + 15, now + 15, "session-1", "other", 20_833), undefined);
  assert.equal(tick.get(600, now + 15, now + 15, "session-1", "member-1", 20_833).usedSeconds, 15);
  assert.equal(tick.get(600, now + 315, now + 315, "session-1", "member-1", 20_833).usedSeconds, 45, "a long idle gap costs no more than one tick");
  db.prepare("UPDATE smartlingo_max_tutor_sessions SET used_seconds=590 WHERE id=?").run("session-1");
  assert.equal(tick.get(600, now + 330, now + 330, "session-1", "member-1", 20_833).usedSeconds, 600);
  const reserve = db.prepare(`UPDATE smartlingo_max_tutor_sessions SET turn_count=turn_count+1,pending_until=?
    WHERE id=? AND user_id=? AND usage_day=? AND used_seconds<? AND turn_count<? AND pending_until<? RETURNING turn_count`);
  assert.equal(reserve.get(now + 355, "session-1", "member-1", 20_833, 600, 60, now + 330), undefined);
  db.prepare("UPDATE users SET id=? WHERE id=?").run("member-1-rekeyed", "member-1");
  assert.equal(db.prepare("SELECT user_id FROM smartlingo_max_tutor_sessions WHERE id=?").get("session-1").user_id, "member-1-rekeyed");
  db.close();
});

test("open tutor route gates Max, metered chat, speech, explicit plan saving and short-lived context", () => {
  const route = readFileSync(new URL("../app/api/assistant/open-tutor/route.ts", import.meta.url), "utf8");
  const speech = readFileSync(new URL("../app/api/assistant/open-tutor/speech/route.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/RoleTutor.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/[lang]/max/tutor/page.tsx", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(route, /maxTutorDailyLimit\(user, now\)/);
  assert.match(route, /used_seconds<\?/);
  assert.match(route, /pending_until<\?/);
  assert.match(route, /consumeAiDailyQuota\(user\.id, "assistant"\)/);
  assert.match(route, /readHistory\(row\.transcriptJson\)/);
  assert.match(route, /parsed\.slice\(-8\)/);
  assert.match(speech, /maxTutorDailyLimit\(user/);
  assert.match(speech, /transcribeSmartAiSpeech/);
  assert.match(client, /document\.visibilityState === "hidden"/);
  assert.match(client, /mode === "open"/);
  assert.match(client, /"\/api\/learning-plan"/);
  assert.match(client, /fetch\("\/api\/learning-plan", \{ credentials: "same-origin" \}\)/);
  assert.match(client, /data\.plans\?\.find\(plan => plan\.targetLanguage === language\)/);
  assert.match(client, /if \(saved\) applySavedPlan\(saved\)/);
  assert.match(client, /if \(!savedPlanRef\.current && !planEditedRef\.current\)/);
  assert.match(client, /onClick=\{savePlan\}/);
  assert.match(page, /ensureSevenDayMaxTrial\(user\.id\)/);
  assert.match(worker, /DELETE FROM smartlingo_max_tutor_sessions WHERE usage_day<\?/);
  assert.doesNotMatch(route, /clientSecret|sdp/);
});
