import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const personas = await tsImport("../lib/smartlingo-live-tutor-personas.ts", import.meta.url);

test("the three fictional tutor portraits and four GPT-Live voices are allowlisted and locally hosted", () => {
  assert.deepEqual(personas.SMARTLINGO_TUTOR_PORTRAITS.map(item => item.id), ["mei", "leo", "sofia"]);
  assert.deepEqual(personas.SMARTLINGO_TUTOR_PORTRAITS.map(item => [item.width, item.height]), [[1000, 914], [1000, 838], [1000, 914]]);
  assert.deepEqual(personas.SMARTLINGO_TUTOR_VOICES.map(item => item.id),
    ["marin", "gleam", "meridian", "willow"]);
  for (const item of personas.SMARTLINGO_TUTOR_PORTRAITS)
    assert.equal(existsSync(new URL(`../public${item.image}`, import.meta.url)), true);
  assert.equal(personas.validTutorPortrait("../../other-site.png"), false);
  assert.equal(personas.validTutorVoice("not-a-provider-voice"), false);
});

test("portrait and voice persist through a tutor session refresh and cannot be changed during a call", () => {
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
  const saved = sqlite.prepare(`UPDATE smartlingo_max_tutor_sessions
    SET portrait_key=?,voice_key=?,updated_at=? WHERE id=? AND user_id=? AND NOT EXISTS (
      SELECT 1 FROM smartlingo_max_live_tutor_calls
      WHERE user_id=? AND status IN ('connecting','active','closing'))
    RETURNING portrait_key AS portrait,voice_key AS voice`);
  assert.deepEqual({ ...saved.get("leo", "meridian", now, "session-1", "member-1", "member-1") },
    { portrait: "leo", voice: "meridian" });
  assert.equal(saved.get("sofia", "willow", now, "session-1", "other-user", "other-user"), undefined);
  sqlite.prepare(`INSERT INTO smartlingo_max_live_tutor_calls
    (id,user_id,tutor_session_id,usage_day,language,started_at,last_heartbeat_at,deadline_at,reserved_seconds,status)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run("call-1", "member-1", "session-1", day, "ja", now, now, now + 300, 300, "active");
  assert.equal(saved.get("sofia", "willow", now, "session-1", "member-1", "member-1"), undefined);
  sqlite.prepare("UPDATE smartlingo_max_live_tutor_calls SET status='closed',ended_at=?,used_seconds=15 WHERE id='call-1'").run(now + 15);
  sqlite.prepare("UPDATE smartlingo_max_tutor_sessions SET target_language='es',usage_day=? WHERE id='session-1'").run(day + 1);
  assert.deepEqual({ ...sqlite.prepare("SELECT portrait_key AS portrait,voice_key AS voice FROM smartlingo_max_tutor_sessions").get() },
    { portrait: "leo", voice: "meridian" });
  assert.throws(() => sqlite.prepare("UPDATE smartlingo_max_tutor_sessions SET voice_key='rogue' WHERE id='session-1'").run());
  sqlite.close();
});

test("the preference route is owner-scoped and the client exposes separate, accessible portrait and voice choices", () => {
  const route = readFileSync(new URL("../app/api/assistant/live/preferences/route.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/MaxLiveTutorCall.tsx", import.meta.url), "utf8");
  assert.match(route, /requestUser\(\)/);
  assert.match(route, /request\.headers\.get\("origin"\)/);
  assert.match(route, /validTutorPortrait\(body\.portrait\)/);
  assert.match(route, /validTutorVoice\(body\.voice\)/);
  assert.match(route, /tutorVoiceMatchesPortrait\(body\.portrait, body\.voice\)/);
  assert.match(route, /preferredTutorVoice\(portrait, row\.voice\)/);
  assert.match(route, /WHERE id=\? AND user_id=\?/);
  assert.match(client, /const previousPortrait = SMARTLINGO_TUTOR_PORTRAITS\[/);
  assert.match(client, /const nextPortrait = SMARTLINGO_TUTOR_PORTRAITS\[/);
  assert.match(client, /<select id="max-tutor-voice"/);
  assert.match(client, /function stepPortrait\(direction: -1 \| 1\)/);
  assert.match(client, /function stepPortrait\(direction: -1 \| 1\) \{\s+if \(state !== "idle" \|\| preferenceBusy \|\| !preferenceLoaded\) return;/);
  assert.match(client, /saveTutorChoice\(nextPortrait, preferredTutorVoice\(nextPortrait, voice\)\)/);
});

test("tutor voices match the selected portrait", () => {
  assert.deepEqual(personas.tutorVoiceOptions("leo").map(item => item.id), ["meridian"]);
  for (const portrait of ["mei", "sofia"])
    assert.deepEqual(personas.tutorVoiceOptions(portrait).map(item => item.id), ["gleam", "willow"]);
  assert.equal(personas.preferredTutorVoice("leo", "gleam"), "meridian");
  assert.equal(personas.preferredTutorVoice("mei", "meridian"), "gleam");
  assert.equal(personas.tutorVoiceMatchesPortrait("leo", "willow"), false);
  assert.equal(personas.tutorVoiceMatchesPortrait("sofia", "willow"), true);
});

test("portrait carousel preserves the selected tutor's full ratio, supports touch swipes, and leaves no duplicate tutor row", () => {
  const client = readFileSync(new URL("../components/MaxLiveTutorCall.tsx", import.meta.url), "utf8");
  const owner = readFileSync(new URL("../components/MaxVoiceTutor.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/[lang]/assistant/role-tutor/role-tutor.css", import.meta.url), "utf8");
  assert.match(css, /\.max-live-tutor-filmstrip\{[^}]*display:flex;align-items:center;justify-content:center/);
  assert.doesNotMatch(css, /\.max-live-tutor-filmstrip\{[^}]*display:grid/);
  assert.match(css, /\.max-live-tutor\{[^}]*container-type:inline-size/);
  assert.match(css, /@container \(min-width:820px\)\{\.max-live-tutor-stage\{height:min\(42vh,380px\)\}\.role-tutor-card \.max-live-tutor-preview\{display:flex\}\.role-tutor-card \.max-live-tutor-portrait-step\{display:none\}\}/);
  const image = client.indexOf('className={`max-live-tutor-stage');
  const voice = client.indexOf('className="max-live-tutor-voice-choice"');
  const actions = client.indexOf('className="max-live-tutor-actions"');
  assert.ok(image >= 0 && image < actions && actions < voice);
  assert.doesNotMatch(client, /max-live-tutor-choices|max-live-tutor-portrait-options/);
  assert.match(client, /onTouchStart=\{event =>/);
  assert.match(client, /onTouchEnd=\{event =>/);
  assert.match(client, /stepPortrait\(end < start \? 1 : -1\)/);
  assert.match(client, /className="max-live-tutor-preview previous" onClick=\{\(\) => stepPortrait\(-1\)\}/);
  assert.match(client, /className="max-live-tutor-preview next" onClick=\{\(\) => stepPortrait\(1\)\}/);
  assert.match(client, /className="max-live-tutor-preview previous" onClick=\{\(\) => stepPortrait\(-1\)\}\s+disabled=\{state !== "idle"/);
  assert.match(css, /\.max-live-tutor-voice-choice\{[^}]*position:relative/);
  assert.match(client, /id="max-tutor-voice" value=\{preferredTutorVoice\(portrait, voice\)\}/);
  assert.match(client, /disabled=\{state !== "idle" \|\| preferenceBusy \|\| !preferenceLoaded\}/);
  assert.match(css, /\.max-live-tutor-voice-choice:has\(select:disabled\)\{[^}]*background:#e9edeb/);
  assert.match(client, /className="max-live-tutor-actions"[\s\S]*className="max-live-tutor-chat-toggle"[\s\S]*className="max-live-tutor-call-controls"[\s\S]*className="max-live-tutor-voice-choice"/);
  assert.match(css, /\.max-live-tutor-actions\{[^}]*grid-template-columns:44px minmax\(0,1fr\) 44px/);
  assert.match(css, /\.role-tutor-card \.max-live-tutor-preview\{[^}]*opacity:\.38/);
  assert.match(css, /\.max-live-tutor-preview img\{[^}]*width:100%;height:100%;object-fit:cover/);
  assert.match(client, /className="max-live-tutor-portrait-step previous"[^>]*onClick=\{\(\) => stepPortrait\(-1\)\}/);
  assert.match(client, /className="max-live-tutor-portrait-step next"[^>]*onClick=\{\(\) => stepPortrait\(1\)\}/);
  assert.match(client, /aria-label=\{zh \? "上一位导师" : "Previous tutor"\}/);
  assert.match(client, /aria-label=\{zh \? "下一位导师" : "Next tutor"\}/);
  assert.match(css, /\.max-live-tutor-portrait-step:disabled\{[^}]*opacity:\.45/);
  assert.match(client, /const \[showTranscript, setShowTranscript\] = useState\(false\)/);
  assert.match(client, /className="max-live-tutor-chat-toggle" onClick=\{\(\) => setShowTranscript/);
  assert.match(client, /aria-controls="max-live-tutor-transcript" aria-expanded=\{showTranscript\}/);
  assert.match(client, /id="max-live-tutor-transcript"[^>]*hidden=\{!showTranscript\}/);
  assert.match(css, /\.max-live-tutor-transcript\{[^}]*overflow-y:auto/);
  assert.match(client, /width=\{selectedPortrait\.width\} height=\{selectedPortrait\.height\}/);
  assert.doesNotMatch(client, /className="max-live-tutor-photo"[^>]* fill /);
  assert.match(css, /\.max-live-tutor-stage\{[^}]*height:min\(45vh,440px\)[^}]*background:#fff/);
  assert.match(css, /\.max-live-tutor-photo\{[^}]*width:auto;height:100%;max-width:100%;flex:none;object-fit:contain/);
  assert.doesNotMatch(css, /\.max-live-tutor-stage\.speaking \.max-live-tutor-photo\{[^}]*transform:/);
  assert.doesNotMatch(owner, /role-tutor-avatar/);
  assert.match(owner, /<MaxLiveTutorCall sessionId=\{sessionId\} prepareSession=\{prepareSession\}/);
  assert.doesNotMatch(owner, /role-tutor-progress|role-tutor-lines|role-tutor-message/);
});
