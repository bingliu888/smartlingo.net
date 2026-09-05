import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  approvedWebinarMediaAllowed,
  baseClassPublishAllowed,
  classMediaIdentityProjection,
  livestreamPublisherIdentityAllowed,
  missingWebinarMediaApprovals,
} from "../lib/class-publish-policy.ts";
import { participantIdentityTokenMatches } from "../lib/class-media-identity.ts";
import {
  BIND_VERIFIED_CLASS_COHOSTS_SQL,
  BIND_VERIFIED_CLASS_INVITES_SQL,
  BIND_VERIFIED_CLASS_SUBSCRIPTIONS_SQL,
  BIND_VERIFIED_STAGE_SPEAKERS_SQL,
  VERIFIED_REGISTERED_CLASS_USER_SQL,
} from "../lib/class-grant-binding.ts";
import { validateD1Migrations } from "../scripts/validate-d1-migrations.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("private staged rooms do not bypass per-device microphone and camera approval", () => {
  assert.equal(baseClassPublishAllowed(false, "group_call"), true);
  assert.equal(baseClassPublishAllowed(false, "webinar"), false);
  assert.equal(baseClassPublishAllowed(false, "livestream"), false);
  assert.equal(baseClassPublishAllowed(true, "webinar"), true);

  assert.equal(approvedWebinarMediaAllowed({ mic: true, camera: false }, ["audio"]), true);
  assert.equal(approvedWebinarMediaAllowed({ mic: false, camera: true }, ["audio"]), false);
  assert.equal(approvedWebinarMediaAllowed({ mic: true, camera: true }, ["audio"]), false);
  assert.equal(approvedWebinarMediaAllowed({ mic: true, camera: true }, ["audio", "video"]), true);
  assert.deepEqual(
    missingWebinarMediaApprovals(false, "webinar", { mic: true, camera: true }, ["audio"]),
    ["video"],
  );

  const routes = `${read("app/api/classrooms/[code]/join/route.ts")}\n${read("app/api/classrooms/[code]/media/route.ts")}`;
  assert.doesNotMatch(routes, /room\.classType\s*===\s*["']private["']/);
});

test("media identities are capabilities and livestream speakers require the same verified user", () => {
  const firstHash = "a".repeat(64);
  assert.equal(participantIdentityTokenMatches(null, null), false);
  assert.equal(participantIdentityTokenMatches(null, firstHash), false);
  assert.equal(participantIdentityTokenMatches(firstHash, firstHash), true);
  assert.equal(participantIdentityTokenMatches(firstHash, null), false);
  assert.equal(participantIdentityTokenMatches(firstHash, "b".repeat(64)), false);
  assert.deepEqual(classMediaIdentityProjection("device-secret", false), {});
  assert.deepEqual(classMediaIdentityProjection("device-secret", true), { identity: "device-secret" });
  assert.equal(livestreamPublisherIdentityAllowed({ id: "member-1", emailVerified: 1 }, "member-1"), true);
  assert.equal(livestreamPublisherIdentityAllowed({ id: "member-1", emailVerified: 0 }, "member-1"), false);
  assert.equal(livestreamPublisherIdentityAllowed({ id: "member-1", emailVerified: 1 }, "member-2"), false);
  assert.equal(livestreamPublisherIdentityAllowed(null, "member-1"), false);
});

test("legacy classroom grants remain unbound until the verified-user binding path runs", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL);
    CREATE TABLE live_class_rooms(id TEXT PRIMARY KEY);
    CREATE TABLE live_class_invites(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,email TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(room_id,email));
    CREATE TABLE live_class_stage_speakers(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,member_email TEXT NOT NULL,added_by_user_id TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(room_id,member_email));
    CREATE TABLE live_class_cohosts(room_id TEXT NOT NULL,user_id TEXT NOT NULL,added_by_user_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(room_id,user_id));
    CREATE TABLE live_class_subscriptions(room_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL,trial_started_at INTEGER,trial_ends_at INTEGER,added_by_user_id TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(room_id,user_id));
    CREATE TABLE live_class_chat_messages(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,sender_user_id TEXT,sender_name TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE live_class_join_history(user_id TEXT NOT NULL,room_id TEXT NOT NULL,first_joined_at INTEGER NOT NULL,last_joined_at INTEGER NOT NULL,PRIMARY KEY(user_id,room_id));
    CREATE TABLE live_class_media_presence(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,identity TEXT NOT NULL,user_id TEXT,display_name TEXT NOT NULL,is_member INTEGER NOT NULL DEFAULT 0,mic_on INTEGER NOT NULL DEFAULT 0,camera_on INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,last_seen_at INTEGER NOT NULL,UNIQUE(room_id,identity));
    CREATE TABLE class_playlist_state(room_id TEXT PRIMARY KEY,updated_by_user_id TEXT);
    CREATE TABLE live_class_stage_requests(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,identity TEXT NOT NULL,user_id TEXT,display_name TEXT NOT NULL,media_kind TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(room_id,identity,media_kind));
    INSERT INTO users VALUES('member-1','member@example.com'),('admin-1','admin@example.com');
    INSERT INTO live_class_rooms VALUES('room-1');
    INSERT INTO live_class_invites VALUES('invite-1','room-1','MEMBER@example.com',1);
    INSERT INTO live_class_stage_speakers VALUES('speaker-1','room-1','member@example.com','admin-1',1);
    INSERT INTO live_class_cohosts VALUES('room-1','member-1','admin-1',1);
    INSERT INTO live_class_subscriptions VALUES('room-1','member-1','active',NULL,NULL,'admin-1',1,1);
  `);
  database.exec(read("drizzle/0181_gold3_classroom_identity.sql"));

  assert.equal(database.prepare("SELECT user_id FROM live_class_invites").get().user_id, null);
  assert.equal(database.prepare("SELECT user_id FROM live_class_stage_speakers").get().user_id, null);
  assert.equal(database.prepare("SELECT identity_bound_at FROM live_class_cohosts").get().identity_bound_at, 0);
  assert.equal(database.prepare("SELECT identity_bound_at FROM live_class_subscriptions").get().identity_bound_at, 0);

  database.exec(`
    INSERT INTO users VALUES('late-cohost','late-cohost@example.com');
    INSERT INTO users VALUES('late-subscriber','late-subscriber@example.com');
    INSERT INTO live_class_cohosts(room_id,user_id,added_by_user_id,created_at)
      VALUES('room-1','late-cohost','admin-1',2);
    INSERT INTO live_class_subscriptions(
      room_id,user_id,status,trial_started_at,trial_ends_at,added_by_user_id,created_at,updated_at
    ) VALUES('room-1','late-subscriber','active',NULL,NULL,'admin-1',2,2);
  `);
  assert.deepEqual(
    { ...database.prepare(`SELECT granted_email AS email,identity_bound_at AS boundAt
      FROM live_class_cohosts WHERE user_id='late-cohost'`).get() },
    { email: "late-cohost@example.com", boundAt: 0 },
  );
  assert.deepEqual(
    { ...database.prepare(`SELECT email,identity_bound_at AS boundAt
      FROM live_class_subscriptions WHERE user_id='late-subscriber'`).get() },
    { email: "late-subscriber@example.com", boundAt: 0 },
  );

  database.prepare(BIND_VERIFIED_CLASS_INVITES_SQL).run("member-1", "member@example.com", "member-1");
  database.prepare(BIND_VERIFIED_STAGE_SPEAKERS_SQL).run("member-1", "member@example.com", "member-1");
  database.prepare(BIND_VERIFIED_CLASS_COHOSTS_SQL).run(100, "member-1", "member@example.com");
  database.prepare(BIND_VERIFIED_CLASS_SUBSCRIPTIONS_SQL).run(100, "member-1", "member@example.com");

  assert.equal(database.prepare("SELECT user_id FROM live_class_invites").get().user_id, "member-1");
  assert.equal(database.prepare("SELECT user_id FROM live_class_stage_speakers").get().user_id, "member-1");
  assert.equal(database.prepare("SELECT identity_bound_at FROM live_class_cohosts WHERE user_id='member-1'").get().identity_bound_at, 100);
  assert.equal(database.prepare("SELECT identity_bound_at FROM live_class_subscriptions WHERE user_id='member-1'").get().identity_bound_at, 100);

  database.exec("UPDATE users SET id='member-2' WHERE id='member-1'");
  assert.equal(database.prepare("SELECT user_id FROM live_class_invites").get().user_id, "member-2");
  assert.equal(database.prepare("SELECT user_id FROM live_class_stage_speakers").get().user_id, "member-2");
  assert.equal(database.prepare("SELECT user_id FROM live_class_cohosts WHERE granted_email='member@example.com'").get().user_id, "member-2");
  assert.equal(database.prepare("SELECT user_id FROM live_class_subscriptions WHERE email='member@example.com'").get().user_id, "member-2");
});

test("tracked classroom migrations pass fresh D1 replay and a second no-op", () => {
  const result = validateD1Migrations();
  assert.equal(result.newestMigration, "0182_smartpay5_payment_item_states");
  assert.equal(result.firstRunApplied, result.migrationCount);
  assert.equal(result.secondRunApplied, 0);
  assert.equal(result.foreignKeyViolations, 0);
});

test("course administration and paid-room entry require a verified bound classroom identity", () => {
  const classRoute = read("app/api/classes/[classId]/route.ts");
  const studentsRoute = read("app/api/classes/[classId]/students/route.ts");
  const detailPage = read("app/[lang]/classrooms/[code]/page.tsx");
  const roomPage = read("app/[lang]/classrooms/[code]/room/page.tsx");
  const sharePage = read("app/[lang]/classrooms/[code]/share/page.tsx");

  assert.match(classRoute, /canManageClass\(/);
  assert.match(studentsRoute, /canManageClass\(/);
  assert.match(studentsRoute, /verifiedRegisteredUser\(email\)/);
  assert.match(studentsRoute, /boundedJsonBody/);
  assert.match(studentsRoute, /consumeAccountRequestLimit/);
  assert.doesNotMatch(`${classRoute}\n${studentsRoute}`, /FROM live_class_cohosts/);
  for (const source of [detailPage, roomPage, sharePage]) {
    assert.match(source, /VERIFIED_EMAIL_REQUIRED/);
    assert.match(source, /notice=verify-email/);
  }
});

test("email-address classroom grants reject unverified, stale, and noncanonical Clerk rows", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE users(
    id TEXT PRIMARY KEY,email TEXT NOT NULL,email_verified INTEGER NOT NULL,
    clerk_identity_checked_at INTEGER NOT NULL,clerk_user_id TEXT,
    display_name TEXT NOT NULL
  )`);
  const insert = database.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)");
  insert.run("fresh","fresh@example.com",1,1_000,"fresh","Fresh");
  insert.run("unverified","unverified@example.com",0,1_000,"unverified","Unverified");
  insert.run("stale","stale@example.com",1,699,"stale","Stale");
  insert.run("mismatch","mismatch@example.com",1,1_000,"different-clerk-id","Mismatch");
  const resolve = database.prepare(VERIFIED_REGISTERED_CLASS_USER_SQL);
  assert.equal(resolve.get("fresh@example.com", 700).id, "fresh");
  assert.equal(resolve.get("unverified@example.com", 700), undefined);
  assert.equal(resolve.get("stale@example.com", 700), undefined);
  assert.equal(resolve.get("mismatch@example.com", 700), undefined);
});

test("Gold 3 classroom migration is additive and deployment applies D1 before build", () => {
  const migration = read("drizzle/0181_gold3_classroom_identity.sql");
  const journal = JSON.parse(read("drizzle/meta/_journal.json"));
  const workflow = read(".github/workflows/deploy-cloudflare.yml");
  const migrationStep = workflow.indexOf("npx wrangler d1 migrations apply smartlingo-net-cutover-20260801-d1");
  const buildStep = workflow.indexOf("- name: Build exact production Worker");
  const deployStep = workflow.indexOf("- name: Deploy Worker");

  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|COLUMN)/i);
  assert.deepEqual(journal.entries.slice(-2).map(({ idx, tag }) => ({ idx, tag })), [
    { idx: 75, tag: "0181_gold3_classroom_identity" },
    { idx: 76, tag: "0182_smartpay5_payment_item_states" },
  ]);
  assert.ok(migrationStep >= 0 && migrationStep < buildStep && buildStep < deployStep);
});

test("SmartLingo classroom runtime uses only site-owned D1, R2, and RealtimeKit resources", () => {
  const config = read("wrangler.cloudflare.jsonc");
  const runtime = [
    "lib/live-class-realtimekit.ts",
    "app/api/classrooms/[code]/materials/route.ts",
    "app/api/classrooms/[code]/playlist/route.ts",
    "app/api/classrooms/[code]/recording/route.ts",
  ].map(read).join("\n");
  assert.match(config, /"database_name": "smartlingo-net-cutover-20260801-d1"/);
  assert.match(config, /"binding": "CLASS_FILES"[\s\S]*"bucket_name": "smartlingo-net-class-files"/);
  assert.match(config, /"REALTIMEKIT_APP_ID": "816eb53a-1dc8-4939-9716-500747e385db"/);
  assert.doesNotMatch(runtime, /smartmeeting|smartnct|geniuswallet|konectible|greatlove/i);
  assert.doesNotMatch(runtime, /CLOUDFLARE_API_TOKEN/);
});
