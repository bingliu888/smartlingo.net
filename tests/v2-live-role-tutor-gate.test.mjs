import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const live = await tsImport("../lib/smartlingo-max-live-tutor.ts", import.meta.url);

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY);");
  sqlite.prepare("INSERT INTO users(id) VALUES(?)").run("member-1");
  for (const file of ["0191_max_open_tutor.sql", "0192_max_live_tutor_calls.sql", "0194_live_voice_quota.sql", "0195_live_tutor_personas.sql"]) {
    const migration = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) sqlite.exec(statement);
  }
  const now = 1_800_000_000;
  const day = Math.floor(now / 86_400);
  sqlite.prepare(`INSERT INTO smartlingo_max_tutor_sessions
    (id,user_id,target_language,ui_language,usage_day,last_active_at,opening_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run("session-1", "member-1", "ja", "zh", day, now, "Hello", now, now);
  const database = { prepare(sql) {
    const statement = sqlite.prepare(sql);
    return { bind(...values) { return {
      first: async () => statement.get(...values) || null,
      run: async () => { statement.run(...values); return { success: true }; },
      all: async () => ({ results: statement.all(...values) }),
    }; } };
  } };
  return { sqlite, database, now, day };
}

function attachedSession({ closed = true } = {}) {
  const listeners = {};
  const socket = { accept() {}, addEventListener(type, handler) { listeners[type] = handler; },
    send(value) { assert.equal(JSON.parse(value).type, "session.close");
      if (closed) queueMicrotask(() => listeners.message?.({ data: JSON.stringify({ type: "session.closed" }) })); },
    close() {}, };
  return Object.assign(new Response(null, { status: 200 }), { webSocket: socket });
}

test("Max Live voice has independent daily time, rejects another call, and reconnects with unused time", async () => {
  const { sqlite, database, now } = fixture();
  const first = await live.reserveMaxLiveTutorCall({ database, userId: "member-1", tutorSessionId: "session-1",
    language: "ja", limit: 300, now, id: "call-1" });
  assert.equal(first.reservedSeconds, 300);
  assert.equal(sqlite.prepare("SELECT used_seconds FROM smartlingo_max_tutor_sessions").get().used_seconds, 0);
  assert.equal(await live.reserveMaxLiveTutorCall({ database, userId: "member-1", tutorSessionId: "session-1",
    language: "ja", limit: 300, now, id: "call-2" }), null);
  assert.equal(await live.activateMaxLiveTutorCall(database, "call-1", "member-1", "bad"), false);
  assert.equal(await live.activateMaxLiveTutorCall(database, "call-1", "member-1", "live_test123"), true);
  assert.equal(await live.heartbeatMaxLiveTutorCall(database, "call-1", "other", now + 10), null);
  assert.equal(await live.heartbeatMaxLiveTutorCall(database, "call-1", "member-1", now + 10), 290);
  let hangups = 0;
  const closed = await live.closeMaxLiveTutorCall({ database, id: "call-1", userId: "member-1",
    now: now + 25, credentialSource: { OPENAI_API_KEY: "inert-test-key" }, fetcher: async url => {
      assert.equal(url, "https://api.openai.com/v1/live/sessions/live_test123/attach");
      hangups++; return attachedSession();
    } });
  assert.equal(closed.usedSeconds, 25);
  assert.equal(hangups, 1);
  assert.equal(sqlite.prepare("SELECT used_seconds FROM smartlingo_max_tutor_sessions").get().used_seconds, 0);
  assert.equal((await live.closeMaxLiveTutorCall({ database, id: "call-1", userId: "member-1", now: now + 26 })).ended, true);
  assert.equal((await live.readMaxLiveTutorUsage(database, "member-1", now + 26, 300)).remainingSeconds, 275);
  const restarted = await live.reserveMaxLiveTutorCall({ database, userId: "member-1", tutorSessionId: "session-1",
    language: "ja", limit: 300, now: now + 27, id: "call-restarted" });
  assert.equal(restarted?.reservedSeconds, 275, "a closed call can immediately start again with unused voice time");
  sqlite.close();
});

test("abandoned calls are closed by cleanup; provider failure never grants a second call", async () => {
  const { sqlite, database, now } = fixture();
  const reserved = await live.reserveMaxLiveTutorCall({ database, userId: "member-1", tutorSessionId: "session-1",
    language: "ja", limit: 900, now, id: "call-3" });
  assert.equal(reserved.reservedSeconds, 900);
  assert.equal(await live.activateMaxLiveTutorCall(database, "call-3", "member-1", "live_live123"), true);
  const failed = await live.closeMaxLiveTutorCall({ database, id: "call-3", now: now + 60,
    credentialSource: { OPENAI_API_KEY: "inert-test-key" }, fetcher: async () => new Response(null, { status: 503 }) });
  assert.equal(failed, null);
  assert.equal(sqlite.prepare("SELECT status FROM smartlingo_max_live_tutor_calls").get().status, "active");
  let hangups = 0;
  await live.cleanupMaxLiveTutorCalls({ database, now: now + 61, credentialSource: { OPENAI_API_KEY: "inert-test-key" },
    fetcher: async () => { hangups++; return attachedSession(); } });
  assert.equal(hangups, 1);
  assert.equal(sqlite.prepare("SELECT status,used_seconds FROM smartlingo_max_live_tutor_calls").get().status, "closed");
  assert.equal(sqlite.prepare("SELECT used_seconds FROM smartlingo_max_live_tutor_calls").get().used_seconds, 61);
  sqlite.close();
});

test("a live call never runs past Max expiry even when daily minutes remain", async () => {
  const { sqlite, database, now } = fixture();
  const reserved = await live.reserveMaxLiveTutorCall({ database, userId: "member-1", tutorSessionId: "session-1",
    language: "ja", limit: 900, now, id: "expiry-call", accessEndsAt: now + 37 });
  assert.equal(reserved.deadlineAt, now + 37);
  assert.equal(await live.activateMaxLiveTutorCall(database, "expiry-call", "member-1", "live_expiry123"), true);
  assert.equal(await live.heartbeatMaxLiveTutorCall(database, "expiry-call", "member-1", now + 38), null);
  await live.cleanupMaxLiveTutorCalls({ database, now: now + 38, credentialSource: { OPENAI_API_KEY: "inert-test-key" },
    fetcher: async () => attachedSession() });
  assert.equal(sqlite.prepare("SELECT status FROM smartlingo_max_live_tutor_calls").get().status, "closed");
  assert.equal(sqlite.prepare("SELECT used_seconds FROM smartlingo_max_live_tutor_calls").get().used_seconds, 38);
  sqlite.close();
});

test("the forward migration preserves refund for an in-flight legacy Realtime call", async () => {
  const { sqlite, database, now, day } = fixture();
  sqlite.prepare("UPDATE smartlingo_max_tutor_sessions SET used_seconds=600 WHERE id='session-1'").run();
  sqlite.prepare(`INSERT INTO smartlingo_max_live_tutor_calls
    (id,user_id,tutor_session_id,usage_day,language,provider_call_id,started_at,
     last_heartbeat_at,deadline_at,reserved_seconds,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run("legacy-call", "member-1", "session-1", day, "ja", "rtc_legacy123", now, now, now + 600, 600, "active");
  await live.closeMaxLiveTutorCall({ database, id: "legacy-call", now: now + 25,
    credentialSource: { OPENAI_API_KEY: "inert-test-key" },
    fetcher: async url => {
      assert.equal(url, "https://api.openai.com/v1/realtime/calls/rtc_legacy123/hangup");
      return new Response(null, { status: 204 });
    } });
  assert.equal(sqlite.prepare("SELECT used_seconds FROM smartlingo_max_tutor_sessions").get().used_seconds, 25);
  assert.equal((await live.readMaxLiveTutorUsage(database, "member-1", now + 26, 300)).remainingSeconds, 300,
    "legacy shared calls must not reduce the new independent voice budget");
  sqlite.close();
});

test("a failed new Live connection cannot refund unrelated text tutor time", async () => {
  const { sqlite, database, now } = fixture();
  sqlite.prepare("UPDATE smartlingo_max_tutor_sessions SET used_seconds=100 WHERE id='session-1'").run();
  assert.ok(await live.reserveMaxLiveTutorCall({ database, userId: "member-1", tutorSessionId: "session-1",
    language: "ja", limit: 300, now, id: "failed-live" }));
  const closed = await live.closeMaxLiveTutorCall({ database, id: "failed-live", now: now + 1 });
  assert.equal(closed.ended, true);
  assert.equal(sqlite.prepare("SELECT used_seconds FROM smartlingo_max_tutor_sessions").get().used_seconds, 100);
  sqlite.close();
});

test("live API exposes server-validated SDP, Max entitlement, heartbeats, and cleanup rather than the old closed flag", () => {
  const route = readFileSync(new URL("../app/api/assistant/live/route.ts", import.meta.url), "utf8");
  const usage = readFileSync(new URL("../app/api/assistant/live/usage/route.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/MaxLiveTutorCall.tsx", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(route, /readSmartAiRequestText\(request, 100_000\)/);
  assert.match(route, /maxLiveTutorDailyLimit\(user\)/);
  assert.match(route, /reserveMaxLiveTutorCall/);
  assert.match(route, /closeMaxLiveTutorCall/);
  assert.match(route, /sameOrigin\(request\)/);
  assert.doesNotMatch(route, /SMARTLINGO_MAX_ROLE_TUTOR_ENABLED/);
  assert.match(usage, /maxLiveTutorDailyLimit\(user\)/);
  assert.match(client, /RTCPeerConnection/);
  assert.match(client, /getUserMedia/);
  assert.match(client, /session\.output_transcript\.delta/);
  assert.match(client, /cleanupMedia\(\)/);
  assert.match(worker, /cleanupMaxLiveTutorCalls/);
  const entitlement = readFileSync(new URL("../lib/smartlingo-open-tutor-entitlement.ts", import.meta.url), "utf8");
  assert.match(entitlement, /textLimit === OPEN_TUTOR_TRIAL_SECONDS \? 5 \* 60 : textLimit > 0 \? 15 \* 60/);
});
