import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

async function importTypeScriptModule(path) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const primaryIdentity = await importTypeScriptModule("../lib/clerk-primary-identity.ts");
const rebind = await importTypeScriptModule("../lib/permanent-admin-rebind.ts");

function createIdentityDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE users(
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      clerk_identity_checked_at INTEGER NOT NULL DEFAULT 0,
      clerk_user_id TEXT,
      role TEXT NOT NULL DEFAULT 'member'
    );
    CREATE TABLE child_records(id TEXT PRIMARY KEY,user_id TEXT NOT NULL);
    CREATE TRIGGER test_users_clerk_id_rekey
    AFTER UPDATE OF id ON users
    FOR EACH ROW WHEN OLD.id<>NEW.id
    BEGIN
      UPDATE child_records SET user_id=NEW.id WHERE user_id=OLD.id;
    END;
  `);
  const database = {
    prepare(query) {
      let values = [];
      return {
        bind(...next) {
          values = next;
          return this;
        },
        async first() {
          return sqlite.prepare(query).get(...values) ?? null;
        },
      };
    },
  };
  return { sqlite, database };
}

test("only Clerk's exact active primary email resolves, while valid unverified members remain members", () => {
  const base = {
    id: "user_current",
    banned: false,
    locked: false,
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      { id: "email_secondary", emailAddress: "wrong@example.com", verification: { status: "verified" } },
      { id: "email_primary", emailAddress: " Member@Example.com ", verification: { status: "unverified" } },
    ],
  };
  assert.deepEqual(primaryIdentity.resolveActiveClerkPrimaryEmail(base), {
    email: "member@example.com",
    emailVerified: false,
  });
  for (const blocked of [
    null,
    { ...base, banned: true },
    { ...base, locked: true },
    { ...base, primaryEmailAddressId: null },
    { ...base, primaryEmailAddressId: "email_missing" },
  ]) {
    assert.equal(primaryIdentity.resolveActiveClerkPrimaryEmail(blocked), null);
  }
});

test("permanent-email ownership requires one verified active Clerk primary owned by the current subject", () => {
  const owner = {
    id: "user_admin",
    primaryEmailAddressId: "email_admin",
    emailAddresses: [{
      id: "email_admin",
      emailAddress: "bingliu@cybeye.com",
      verification: { status: "verified" },
    }],
  };
  assert.equal(primaryIdentity.isSoleVerifiedClerkEmailOwner(
    { data: [owner], totalCount: 1 },
    "user_admin",
    "BINGLIU@CYBEYE.COM",
  ), true);
  assert.equal(primaryIdentity.isSoleVerifiedClerkEmailOwner(
    { data: [owner, { ...owner, id: "user_other" }], totalCount: 2 },
    "user_admin",
    "bingliu@cybeye.com",
  ), false);
  assert.equal(primaryIdentity.isExactVerifiedClerkIdentity(
    owner,
    "user_admin",
    "bingliu@cybeye.com",
  ), true);
  assert.equal(primaryIdentity.isExactVerifiedClerkIdentity(
    { ...owner, id: "user_other" },
    "user_admin",
    "bingliu@cybeye.com",
  ), false);
  assert.equal(primaryIdentity.isSoleVerifiedClerkEmailOwner(
    { data: [{ ...owner, id: "user_other" }], totalCount: 1 },
    "user_admin",
    "bingliu@cybeye.com",
  ), false);
  assert.equal(primaryIdentity.isSoleVerifiedClerkEmailOwner(
    { data: [{ ...owner, banned: true }], totalCount: 1 },
    "user_admin",
    "bingliu@cybeye.com",
  ), false);
});

test("a unique verified legacy email owner binds once to the canonical Clerk subject and moves references", async () => {
  const { sqlite, database } = createIdentityDatabase();
  sqlite.prepare("INSERT INTO users(id,email,email_verified,clerk_identity_checked_at,clerk_user_id) VALUES(?,?,?,?,?)")
    .run("legacy-member", "member@example.com", 0, 0, null);
  sqlite.prepare("INSERT INTO child_records(id,user_id) VALUES(?,?)").run("child-1", "legacy-member");

  assert.equal(await rebind.bindVerifiedLegacyClerkUser({
    database,
    clerkUserId: "user_clerk_member",
    email: "MEMBER@example.com",
    emailVerified: true,
    identityCheckedAt: 1_788_566_400,
  }), true);
  assert.deepEqual(
    { ...sqlite.prepare("SELECT id,email,email_verified AS verified,clerk_user_id AS clerkId FROM users").get() },
    { id: "user_clerk_member", email: "member@example.com", verified: 1, clerkId: "user_clerk_member" },
  );
  assert.equal(sqlite.prepare("SELECT user_id AS userId FROM child_records").get().userId, "user_clerk_member");

  assert.equal(await rebind.bindVerifiedLegacyClerkUser({
    database,
    clerkUserId: "user_second",
    email: "member@example.com",
    emailVerified: true,
    identityCheckedAt: 1_788_566_401,
  }), false);
  sqlite.close();
});

test("legacy binding fails closed without verified email or when another Clerk subject is already bound", async () => {
  for (const fixture of [
    { emailVerified: false, existingClerkId: null },
    { emailVerified: true, existingClerkId: "user_other" },
  ]) {
    const { sqlite, database } = createIdentityDatabase();
    sqlite.prepare("INSERT INTO users(id,email,email_verified,clerk_identity_checked_at,clerk_user_id) VALUES(?,?,?,?,?)")
      .run("legacy-member", "member@example.com", 0, 0, fixture.existingClerkId);
    assert.equal(await rebind.bindVerifiedLegacyClerkUser({
      database,
      clerkUserId: "user_current",
      email: "member@example.com",
      emailVerified: fixture.emailVerified,
      identityCheckedAt: 1_788_566_400,
    }), false);
    assert.equal(sqlite.prepare("SELECT id FROM users").get().id, "legacy-member");
    sqlite.close();
  }
});

test("a verified legacy row already keyed by the Clerk subject can bind, but an unverified one cannot", async () => {
  for (const emailVerified of [false, true]) {
    const { sqlite, database } = createIdentityDatabase();
    sqlite.prepare("INSERT INTO users(id,email,email_verified,clerk_identity_checked_at,clerk_user_id) VALUES(?,?,?,?,?)")
      .run("user_current", "member@example.com", 0, 0, null);
    assert.equal(await rebind.bindVerifiedLegacyClerkUser({
      database,
      clerkUserId: "user_current",
      email: "member@example.com",
      emailVerified,
      identityCheckedAt: 1_788_566_400,
    }), emailVerified);
    assert.equal(
      sqlite.prepare("SELECT clerk_user_id AS clerkId FROM users").get().clerkId,
      emailVerified ? "user_current" : null,
    );
    sqlite.close();
  }
});

test("a previously linked row and the proven permanent administrator rekey atomically", async () => {
  {
    const { sqlite, database } = createIdentityDatabase();
    sqlite.prepare("INSERT INTO users(id,email,email_verified,clerk_identity_checked_at,clerk_user_id) VALUES(?,?,?,?,?)")
      .run("legacy-linked", "member@example.com", 1, 100, "user_current");
    sqlite.prepare("INSERT INTO child_records(id,user_id) VALUES(?,?)").run("child-linked", "legacy-linked");
    assert.equal(await rebind.rekeyLinkedClerkUser({
      database,
      clerkUserId: "user_current",
      email: "member@example.com",
      emailVerified: true,
      identityCheckedAt: 1_788_566_400,
    }), true);
    assert.equal(sqlite.prepare("SELECT user_id AS userId FROM child_records").get().userId, "user_current");
    sqlite.close();
  }

  {
    const { sqlite, database } = createIdentityDatabase();
    sqlite.prepare("INSERT INTO users(id,email,email_verified,clerk_identity_checked_at,clerk_user_id,role) VALUES(?,?,?,?,?,?)")
      .run("old-admin-id", "bingliu@cybeye.com", 1, 100, "old_clerk_admin", "admin");
    assert.equal(await rebind.rebindPermanentAdminClerkId({
      database,
      clerkUserId: "new_clerk_admin",
      email: "bingliu@cybeye.com",
      identityCheckedAt: 1_788_566_400,
      clerkOwnershipConfirmed: false,
    }), false);
    assert.equal(await rebind.rebindPermanentAdminClerkId({
      database,
      clerkUserId: "new_clerk_admin",
      email: "bingliu@cybeye.com",
      identityCheckedAt: 1_788_566_400,
      clerkOwnershipConfirmed: true,
    }), true);
    assert.deepEqual(
      { ...sqlite.prepare("SELECT id,clerk_user_id AS clerkId,role FROM users").get() },
      { id: "new_clerk_admin", clerkId: "new_clerk_admin", role: "admin" },
    );
    sqlite.close();
  }
});

test("Gold 3 identity routes create no temporary-password users and wallet metadata stays optional and non-unique", async () => {
  const [adminRoute, adminPatch, passwordRoute, walletBinding, walletMigration, schema, auth, migration] = await Promise.all([
    read("../app/api/admin/members/route.ts"),
    read("../app/api/admin/members/[memberId]/route.ts"),
    read("../app/api/account/password/route.ts"),
    read("../lib/wallet-binding.ts"),
    read("../drizzle/0175_gold_v2_identity_commerce.sql"),
    read("../db/schema.ts"),
    read("../lib/auth.ts"),
    read("../drizzle/0180_gold3_clerk_identity.sql"),
  ]);
  assert.doesNotMatch(adminRoute, /createUser|temporaryPassword|password:/);
  assert.match(adminRoute, /email_verified=1[\s\S]*clerk_identity_checked_at>\?[\s\S]*clerk_user_id=id/);
  assert.match(adminRoute, /now - 5 \* 60/);
  assert.match(adminRoute, /confirmVerifiedClerkGrantTarget\(target\)/);
  assert.match(adminPatch, /consumeAccountRequestLimit/);
  assert.match(adminPatch, /boundedJsonBody<\{ action\?: RoleAction \}>\(request, 4 \* 1024\)/);
  assert.match(adminPatch, /identityCheckedAt <= now - 5 \* 60/);
  assert.match(adminPatch, /confirmVerifiedClerkGrantTarget\(value\.target\)/);
  assert.doesNotMatch(adminPatch, /request\.json\(\)/);
  assert.match(passwordRoute, /verifyPassword\(\{userId:session\.userId,password:input\.currentPassword\}\)/);
  assert.match(passwordRoute, /updateUser\(session\.userId, \{ password, signOutOfOtherSessions: false \}\)/);
  assert.doesNotMatch(passwordRoute, /emailAddress|verification.*verified/);
  assert.match(walletBinding, /if \(!wallet\)[\s\S]*DELETE FROM smartpay_wallet_bindings/);
  assert.match(walletMigration, /user_id TEXT PRIMARY KEY/);
  assert.doesNotMatch(walletMigration, /wallet_address TEXT[^\n]*UNIQUE/);
  assert.match(schema, /emailVerified: integer\("email_verified"\)\.notNull\(\)\.default\(0\)/);
  assert.match(auth, /\^\[A-Z0-9_-\]\{6,32\}\$/);
  assert.match(auth, /slice\(0, 32\)/);
  assert.match(migration, /UPDATE sessions SET user_id=NEW\.id/);
  assert.match(migration, /CREATE TRIGGER smartlingo_users_verified_identity_update/);
  assert.doesNotMatch(migration, /UPDATE [^;]+ SET (?:payer_id|ref_id)=/);
});
