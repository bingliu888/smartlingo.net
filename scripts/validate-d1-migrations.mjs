import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const drizzleDirectory = join(projectRoot, "drizzle");
const journalPath = join(drizzleDirectory, "meta", "_journal.json");
const migrationTable = "__drizzle_migrations";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function readMigrationManifest() {
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  assert.equal(journal.dialect, "sqlite");
  assert.ok(Array.isArray(journal.entries));

  const tags = new Set();
  return journal.entries.map((entry, position) => {
    assert.equal(entry.idx, position, `migration index ${position} must be contiguous`);
    assert.match(entry.tag, /^\d{4}_[a-z0-9_]+$/);
    assert.ok(!tags.has(entry.tag), `duplicate migration tag: ${entry.tag}`);
    tags.add(entry.tag);

    const path = join(drizzleDirectory, `${entry.tag}.sql`);
    const sql = readFileSync(path, "utf8");
    assert.ok(sql.trim(), `${entry.tag} must not be empty`);
    return {
      tag: entry.tag,
      createdAt: entry.when,
      hash: sha256(sql),
      sql,
    };
  });
}

export function applyTrackedMigrations(database, migrations) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ${migrationTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL UNIQUE
    )
  `);

  const findApplied = database.prepare(
    `SELECT tag, hash, created_at AS createdAt FROM ${migrationTable} WHERE tag = ? LIMIT 1`,
  );
  const recordApplied = database.prepare(
    `INSERT INTO ${migrationTable} (tag, hash, created_at) VALUES (?, ?, ?)`,
  );
  const result = { applied: [], skipped: [] };

  for (const migration of migrations) {
    const applied = findApplied.get(migration.tag);
    if (applied) {
      assert.equal(applied.hash, migration.hash, `${migration.tag} changed after it was applied`);
      assert.equal(Number(applied.createdAt), migration.createdAt);
      result.skipped.push(migration.tag);
      continue;
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      recordApplied.run(migration.tag, migration.hash, migration.createdAt);
      database.exec("COMMIT");
      result.applied.push(migration.tag);
    } catch (error) {
      database.exec("ROLLBACK");
      throw new Error(`failed to apply ${migration.tag}`, { cause: error });
    }
  }

  return result;
}

function migrationState(database) {
  const migrations = database.prepare(
    `SELECT tag, hash, created_at AS createdAt FROM ${migrationTable} ORDER BY created_at, tag`,
  ).all();
  const schema = database.prepare(`
    SELECT type, name, tbl_name AS tableName, sql
    FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%' AND name != ?
    ORDER BY type, name
  `).all(migrationTable);
  const templates = database.prepare(
    "SELECT id, slug, approval_status AS approvalStatus FROM smartlingo_course_templates ORDER BY id",
  ).all();
  return JSON.stringify({ migrations, schema, templates });
}

function assertDatabaseIntegrity(database) {
  const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(foreignKeyErrors, [], "fresh migrations must have no foreign-key violations");

  const integrity = database.prepare("PRAGMA integrity_check").get();
  assert.equal(integrity.integrity_check, "ok");
}

function runD1Smoke(database) {
  const now = 1_785_487_400;

  const insertUser = database.prepare(`
    INSERT INTO users
      (id, email, clerk_user_id, display_name, password_hash, preferred_language, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    "d1-smoke-user",
    "d1-smoke@example.invalid",
    "user_d1_smoke",
    "D1 Smoke",
    "disabled",
    "zh",
    now,
  );
  insertUser.run(
    "d1-smoke-learner",
    "d1-smoke-learner@example.invalid",
    "user_d1_smoke_learner",
    "D1 Smoke Learner",
    "disabled",
    "en",
    now,
  );
  insertUser.run(
    "d1-smoke-introducer",
    "d1-smoke-introducer@example.invalid",
    "user_d1_smoke_introducer",
    "D1 Smoke Introducer",
    "disabled",
    "zh",
    now,
  );
  database.prepare(`
    INSERT INTO sessions (id, user_id, clerk_session_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run("d1-smoke-session", "d1-smoke-user", "sess_d1_smoke", now + 3600, now);
  database.prepare(`
    INSERT INTO smartlingo_memberships
      (user_id, tier, status, created_at, updated_at)
    VALUES (?, 'bronze', 'active', ?, ?)
  `).run("d1-smoke-user", now, now);

  const member = database.prepare(`
    SELECT u.clerk_user_id AS clerkUserId, s.clerk_session_id AS clerkSessionId, m.tier
    FROM users u
    JOIN sessions s ON s.user_id = u.id
    JOIN smartlingo_memberships m ON m.user_id = u.id
    WHERE u.id = ?
  `).get("d1-smoke-user");
  assert.deepEqual(
    { ...member },
    {
      clerkUserId: "user_d1_smoke",
      clerkSessionId: "sess_d1_smoke",
      tier: "bronze",
    },
  );

  const course = database.prepare(`
    SELECT id, approval_status AS approvalStatus, directory_status AS directoryStatus
    FROM smartlingo_course_templates
    WHERE id = 'tpl_ai_foundations_2026'
  `).get();
  assert.deepEqual(
    { ...course },
    {
      id: "tpl_ai_foundations_2026",
      approvalStatus: "approved",
      directoryStatus: "public",
    },
  );

  database.prepare(`
    INSERT INTO smartlingo_media_assets
      (id, owner_user_id, kind, scope_type, scope_id, object_key, mime_type,
       size_bytes, sha256, etag, visibility, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', 'ready', ?, ?)
  `).run(
    "d1-smoke-media",
    "d1-smoke-user",
    "avatar",
    "user",
    "d1-smoke-user",
    "smoke/users/d1-smoke/avatar.webp",
    "image/webp",
    128,
    "0".repeat(64),
    "smoke-etag",
    now,
    now,
  );
  const media = database.prepare(`
    SELECT owner_user_id AS ownerUserId, kind, visibility, status
    FROM smartlingo_media_assets WHERE id = ?
  `).get("d1-smoke-media");
  assert.deepEqual(
    { ...media },
    {
      ownerUserId: "d1-smoke-user",
      kind: "avatar",
      visibility: "private",
      status: "ready",
    },
  );
  const insertMedia = database.prepare(`
    INSERT INTO smartlingo_media_assets
      (id, owner_user_id, kind, scope_type, scope_id, object_key, mime_type,
       size_bytes, sha256, visibility, status, created_at, updated_at)
    VALUES (?, 'd1-smoke-user', ?, ?, ?, ?, 'application/octet-stream',
      ?, ?, 'private', 'ready', ?, ?)
  `);
  assert.throws(
    () => insertMedia.run(
      "d1-smoke-media-zero",
      "avatar",
      "user",
      "d1-smoke-user",
      "smoke/users/d1-smoke/zero.bin",
      0,
      "0".repeat(64),
      now,
      now,
    ),
    /CHECK constraint failed: smartlingo_media_size_ck/,
  );
  assert.throws(
    () => insertMedia.run(
      "d1-smoke-media-uppercase-sha",
      "avatar",
      "user",
      "d1-smoke-user",
      "smoke/users/d1-smoke/uppercase.bin",
      1,
      "A".repeat(64),
      now,
      now,
    ),
    /CHECK constraint failed: smartlingo_media_sha256_ck/,
  );
  assert.throws(
    () => insertMedia.run(
      "d1-smoke-media-wrong-scope",
      "avatar",
      "language_class",
      "not-the-owner",
      "smoke/users/d1-smoke/wrong-scope.bin",
      1,
      "a".repeat(64),
      now,
      now,
    ),
    /CHECK constraint failed: smartlingo_media_scope_ck/,
  );
  insertMedia.run(
    "d1-smoke-voice-practice",
    "voice_practice",
    "user",
    "d1-smoke-user",
    "smoke/users/d1-smoke/voice-practice.webm",
    256,
    "b".repeat(64),
    now,
    now,
  );

  const incrementWindow = database.prepare(`
    INSERT INTO smartlingo_ai_usage_windows
      (id, feature, subject_hash, window_start, window_seconds, request_count,
       input_units, output_units, created_at, updated_at)
    VALUES (?, ?, ?, ?, 60, 1, ?, ?, ?, ?)
    ON CONFLICT(feature, subject_hash, window_start) DO UPDATE SET
      request_count = request_count + excluded.request_count,
      input_units = input_units + excluded.input_units,
      output_units = output_units + excluded.output_units,
      updated_at = excluded.updated_at
    RETURNING id, request_count AS requestCount, input_units AS inputUnits,
      output_units AS outputUnits
  `);
  incrementWindow.get("d1-smoke-window", "ask_guru", "subject-hash-only", now, 3, 2, now, now);
  const window = incrementWindow.get(
    "d1-smoke-window-duplicate",
    "ask_guru",
    "subject-hash-only",
    now,
    4,
    1,
    now,
    now + 1,
  );
  assert.deepEqual(
    { ...window },
    {
      id: "d1-smoke-window",
      requestCount: 2,
      inputUnits: 7,
      outputUnits: 3,
    },
  );

  database.prepare(`
    INSERT INTO smartlingo_ai_requests
      (id, usage_window_id, feature, subject_hash, model, status, input_units,
       output_units, fallback_used, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, 'succeeded', ?, ?, 0, ?, ?)
  `).run(
    "d1-smoke-ai-request",
    "d1-smoke-window",
    "ask_guru",
    "subject-hash-only",
    "test-model",
    7,
    3,
    now,
    now + 1,
  );
  const request = database.prepare(`
    SELECT feature, subject_hash AS subjectHash, status, input_units AS inputUnits,
      output_units AS outputUnits
    FROM smartlingo_ai_requests WHERE id = ?
  `).get("d1-smoke-ai-request");
  assert.deepEqual(
    { ...request },
    {
      feature: "ask_guru",
      subjectHash: "subject-hash-only",
      status: "succeeded",
      inputUnits: 7,
      outputUnits: 3,
    },
  );

  const aiRequestColumns = database.prepare(
    "SELECT name FROM pragma_table_info('smartlingo_ai_requests') ORDER BY cid",
  ).all().map(row => row.name);
  assert.ok(
    aiRequestColumns.every(name => !/(?:prompt|response|transcript|raw_content|message_body)/i.test(name)),
    "AI usage audit must not have raw-content columns",
  );

  const languagePath = database.prepare(`
    SELECT id, slug, target_language AS targetLanguage, level, status, version
    FROM smartlingo_language_paths
    WHERE id = 'path_en_a1'
  `).get();
  assert.deepEqual(
    { ...languagePath },
    {
      id: "path_en_a1",
      slug: "english-a1",
      targetLanguage: "en",
      level: "A1",
      status: "published",
      version: "2026.07.31",
    },
  );
  const publishedLanguages = database.prepare(`
    SELECT target_language AS code
    FROM smartlingo_language_paths
    WHERE status = 'published'
    ORDER BY CASE target_language
      WHEN 'zh' THEN 0 WHEN 'en' THEN 1 WHEN 'es' THEN 2 WHEN 'ja' THEN 3
      WHEN 'ko' THEN 4 WHEN 'fr' THEN 5 WHEN 'de' THEN 6 WHEN 'ru' THEN 7
      WHEN 'it' THEN 8 WHEN 'pt' THEN 9 ELSE 10 END
  `).all().map(row => row.code);
  assert.deepEqual(publishedLanguages, ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt"]);
  const officialCommunities = database.prepare(`
    SELECT c.id, c.target_language AS targetLanguage, c.class_kind AS classKind,
      c.status, c.visibility, c.price_cents AS priceCents
    FROM smartlingo_language_classes c
    WHERE c.class_kind = 'official_language'
    ORDER BY CASE c.target_language
      WHEN 'zh' THEN 0 WHEN 'en' THEN 1 WHEN 'es' THEN 2 WHEN 'ja' THEN 3
      WHEN 'ko' THEN 4 WHEN 'fr' THEN 5 WHEN 'de' THEN 6 WHEN 'ru' THEN 7
      WHEN 'it' THEN 8 WHEN 'pt' THEN 9 ELSE 10 END
  `).all().map(row => ({ ...row }));
  assert.equal(officialCommunities.length, 10);
  assert.deepEqual(
    officialCommunities.map(community => community.targetLanguage),
    publishedLanguages,
  );
  for (const community of officialCommunities) {
    assert.equal(community.classKind, "official_language");
    assert.equal(community.status, "open");
    assert.equal(community.visibility, "public");
    assert.equal(community.priceCents, 0);
  }
  database.prepare(`
    INSERT INTO smartlingo_language_class_members
      (id, class_id, user_id, role, status, joined_at, updated_at)
    VALUES ('d1-smoke-same-language-membership', 'class_official_zh',
      'd1-smoke-user', 'student', 'active', ?, ?)
  `).run(now, now);
  const sameLanguageMembership = database.prepare(`
    SELECT member.id, member.status, path.target_language AS targetLanguage,
      user.preferred_language AS preferredLanguage
    FROM smartlingo_language_class_members member
    JOIN smartlingo_language_classes class ON class.id = member.class_id
    JOIN smartlingo_language_paths path ON path.id = class.path_id
    JOIN users user ON user.id = member.user_id
    WHERE member.id = 'd1-smoke-same-language-membership'
  `).get();
  assert.deepEqual(
    { ...sameLanguageMembership },
    {
      id: "d1-smoke-same-language-membership",
      status: "active",
      targetLanguage: "zh",
      preferredLanguage: "zh",
    },
  );
  database.prepare(`
    INSERT INTO smartlingo_exercises
      (id, path_id, stable_key, version, skill, title_zh, title_en,
       instruction_zh, instruction_en, target_content, answer_content,
       source_type, review_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'listening', ?, ?, ?, ?, ?, ?,
      'smartlingo_original', 'approved', ?, ?)
  `).run(
    "d1-smoke-exercise",
    "path_en_a1",
    "greeting-listen-001",
    "2026.08.01.1",
    "听辨初次问候",
    "Hear a first greeting",
    "先听问候，再用中文写出说话人的意图。",
    "Listen first, then describe the speaker's intent in English.",
    "Hello, it is good to meet you.",
    '{"accepted":["初次见面问候","a first-time greeting"]}',
    now,
    now,
  );
  database.prepare(`
    INSERT INTO smartlingo_language_progress
      (id, user_id, path_id, exercise_id, exercise_version, status,
       best_score, attempt_count, due_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'in_progress', 82, 1, ?, ?)
  `).run(
    "d1-smoke-progress",
    "d1-smoke-learner",
    "path_en_a1",
    "d1-smoke-exercise",
    "2026.08.01.1",
    now + 86_400,
    now,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_language_progress
        (id, user_id, path_id, exercise_id, exercise_version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "d1-smoke-progress-wrong-version",
      "d1-smoke-learner",
      "path_en_a1",
      "d1-smoke-exercise",
      "2026.08.01.2",
      now,
    ),
    /smartlingo progress must reference the exact exercise path and version/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_language_paths
        (id, slug, target_language, level, title_en, title_zh, status, version,
         created_at, updated_at)
      VALUES (?, ?, 'xx', 'A1', 'Invalid', '无效', 'draft', '', ?, ?)
    `).run("d1-smoke-invalid-path", "invalid-path", now, now),
    /smartlingo language path requires a supported language and version/,
  );

  database.prepare(`
    INSERT INTO smartlingo_connected_accounts
      (user_id, provider, provider_account_id, onboarding_status, charges_enabled,
       payouts_enabled, requirements_due, updated_at)
    VALUES (?, 'stripe_connect', ?, 'ready', 1, 1, '[]', ?)
  `).run("d1-smoke-user", "acct_d1_smoke", now);

  database.prepare(`
    INSERT INTO smartlingo_language_classes
      (id, owner_user_id, path_id, owner_role, title, summary, target_language,
       level, schedule, status, visibility, price_cents, currency, capacity,
       created_at, updated_at)
    VALUES (?, ?, ?, 'teacher', ?, ?, 'en', 'A1', 'Tuesday 18:00', 'open',
      'private', 10000, 'USD', 30, ?, ?)
  `).run(
    "d1-smoke-language-class",
    "d1-smoke-user",
    "path_en_a1",
    "English conversation lab",
    "D1 migration smoke class",
    now,
    now,
  );
  database.prepare(`
    INSERT INTO smartlingo_language_class_members
      (id, class_id, user_id, role, status, joined_at, updated_at)
    VALUES (?, ?, ?, 'owner', 'active', ?, ?)
  `).run(
    "d1-smoke-language-class-owner",
    "d1-smoke-language-class",
    "d1-smoke-user",
    now,
    now,
  );
  database.prepare(`
    INSERT INTO smartlingo_language_class_invites
      (id, class_id, created_by_user_id, code_hash, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(
    "d1-smoke-language-class-invite",
    "d1-smoke-language-class",
    "d1-smoke-user",
    "1".repeat(64),
    now + 86_400,
    now,
  );

  database.prepare(`
    INSERT INTO smartlingo_language_class_orders
      (id, class_id, learner_user_id, owner_user_id, provider,
       provider_checkout_id, provider_payment_id, subtotal_cents,
       discount_basis_points, discounted_pre_tax_cents, tax_cents,
       owner_share_cents, platform_fee_cents, currency, first_class_payment,
       status, webhook_event_id, paid_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'stripe_connect', ?, ?, 101, 1500, 86, 0,
      60, 26, 'USD', 1, 'paid', ?, ?, ?, ?)
  `).run(
    "d1-smoke-language-class-order",
    "d1-smoke-language-class",
    "d1-smoke-learner",
    "d1-smoke-user",
    "cs_d1_smoke",
    "pi_d1_smoke",
    "evt_d1_smoke_class_paid",
    now,
    now,
    now,
  );
  const classOrder = database.prepare(`
    SELECT discount_basis_points AS discountBasisPoints,
      discounted_pre_tax_cents AS discountedPreTaxCents,
      owner_share_cents AS ownerShareCents,
      platform_fee_cents AS platformFeeCents,
      first_class_payment AS firstClassPayment,
      status
    FROM smartlingo_language_class_orders
    WHERE id = 'd1-smoke-language-class-order'
  `).get();
  assert.deepEqual(
    { ...classOrder },
    {
      discountBasisPoints: 1500,
      discountedPreTaxCents: 86,
      ownerShareCents: 60,
      platformFeeCents: 26,
      firstClassPayment: 1,
      status: "paid",
    },
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_language_class_orders
        (id, class_id, learner_user_id, owner_user_id, subtotal_cents,
         discount_basis_points, discounted_pre_tax_cents, owner_share_cents,
         platform_fee_cents, created_at, updated_at)
      VALUES ('d1-smoke-invalid-split', 'd1-smoke-language-class',
        'd1-smoke-learner', 'd1-smoke-user', 10000, 0, 9999, 6999, 3000, ?, ?)
    `).run(now, now),
    /CHECK constraint failed: smartlingo_language_class_order_discount_math_ck/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_language_class_orders
        (id, class_id, learner_user_id, owner_user_id, subtotal_cents,
         discount_basis_points, discounted_pre_tax_cents, owner_share_cents,
         platform_fee_cents, first_class_payment, status, paid_at,
         created_at, updated_at)
      VALUES ('d1-smoke-refunded-bypass', 'd1-smoke-language-class',
        'd1-smoke-introducer', 'd1-smoke-user', 101, 0, 101, 70, 31,
        0, 'refunded', ?, ?, ?)
    `).run(now, now, now),
    /smartlingo first successful class payment discount is single-use/,
  );
  database.prepare(`
    UPDATE smartlingo_language_class_orders
    SET status = 'refunded', refunded_at = ?, updated_at = ?
    WHERE id = 'd1-smoke-language-class-order'
  `).run(now + 1, now + 1);
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_language_class_orders
        (id, class_id, learner_user_id, owner_user_id, subtotal_cents,
         discount_basis_points, discounted_pre_tax_cents, owner_share_cents,
         platform_fee_cents, first_class_payment, status, paid_at,
         created_at, updated_at)
      VALUES ('d1-smoke-repeat-first-discount', 'd1-smoke-language-class',
        'd1-smoke-learner', 'd1-smoke-user', 101, 1500, 86, 60, 26,
        1, 'paid', ?, ?, ?)
    `).run(now + 2, now + 2, now + 2),
    /(?:smartlingo first successful class payment discount is single-use|UNIQUE constraint failed)/,
  );
  database.prepare(`
    INSERT INTO smartlingo_language_class_orders
      (id, class_id, learner_user_id, owner_user_id, subtotal_cents,
       discount_basis_points, discounted_pre_tax_cents, owner_share_cents,
       platform_fee_cents, first_class_payment, status, paid_at,
       created_at, updated_at)
    VALUES ('d1-smoke-repeat-full-price', 'd1-smoke-language-class',
      'd1-smoke-learner', 'd1-smoke-user', 101, 0, 101, 70, 31,
      0, 'paid', ?, ?, ?)
  `).run(now + 2, now + 2, now + 2);
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_language_class_orders
        (id, class_id, learner_user_id, owner_user_id, subtotal_cents,
         discount_basis_points, discounted_pre_tax_cents, owner_share_cents,
         platform_fee_cents, status, created_at, updated_at)
      VALUES ('d1-smoke-wrong-owner', 'd1-smoke-language-class',
        'd1-smoke-learner', 'd1-smoke-introducer', 101, 0, 101, 70, 31,
        'pending', ?, ?)
    `).run(now, now),
    /smartlingo class order owner must match the class owner/,
  );

  database.prepare(`
    INSERT INTO referral_codes (id, user_id, code, created_at)
    VALUES (?, ?, ?, ?)
  `).run("d1-smoke-referral-code", "d1-smoke-introducer", "D1SMOKE", now);
  database.prepare(`
    INSERT INTO referrals
      (id, referral_code_id, referred_user_id, status, discount_percent,
       created_at, updated_at)
    VALUES (?, ?, ?, 'attributed', 0, ?, ?)
  `).run(
    "d1-smoke-direct-referral",
    "d1-smoke-referral-code",
    "d1-smoke-learner",
    now,
    now,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO referrals
        (id, referral_code_id, referred_user_id, status, discount_percent,
         created_at, updated_at)
      VALUES (?, ?, ?, 'attributed', 0, ?, ?)
    `).run(
      "d1-smoke-self-referral",
      "d1-smoke-referral-code",
      "d1-smoke-introducer",
      now,
      now,
    ),
    /smartlingo direct referral cannot be self-attributed/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_platform_subscription_payments
        (id, provider_invoice_id, subscriber_user_id, introducer_user_id,
         amount_cents, currency, status, paid_at, created_at)
      VALUES (?, ?, ?, ?, 699, 'USD', 'paid', ?, ?)
    `).run(
      "d1-smoke-platform-missing-referral",
      "in_d1_smoke_missing_referral",
      "d1-smoke-learner",
      "d1-smoke-introducer",
      now,
      now,
    ),
    /smartlingo platform payment must match one direct referral/,
  );
  const insertPlatformPayment = database.prepare(`
    INSERT INTO smartlingo_platform_subscription_payments
      (id, provider_invoice_id, subscriber_user_id, introducer_user_id,
       direct_referral_id, amount_cents, currency, status, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?)
  `);
  insertPlatformPayment.run(
    "d1-smoke-platform-subscription",
    "in_d1_smoke",
    "d1-smoke-learner",
    "d1-smoke-introducer",
    "d1-smoke-direct-referral",
    699,
    "paid",
    now,
    now,
  );
  insertPlatformPayment.run(
    "d1-smoke-platform-zero",
    "in_d1_smoke_zero",
    "d1-smoke-learner",
    "d1-smoke-introducer",
    "d1-smoke-direct-referral",
    0,
    "paid",
    now,
    now,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_introducer_reward_ledger
        (id, introducer_user_id, subscription_payment_id, points, status, created_at)
      VALUES (?, ?, ?, 100, 'earned', ?)
    `).run(
      "d1-smoke-zero-reward",
      "d1-smoke-introducer",
      "d1-smoke-platform-zero",
      now,
    ),
    /smartlingo reward requires a paid positive platform subscription and matching direct referral/,
  );
  insertPlatformPayment.run(
    "d1-smoke-platform-refunded",
    "in_d1_smoke_refunded",
    "d1-smoke-learner",
    "d1-smoke-introducer",
    "d1-smoke-direct-referral",
    699,
    "refunded",
    now,
    now,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_introducer_reward_ledger
        (id, introducer_user_id, subscription_payment_id, points, status, created_at)
      VALUES (?, ?, ?, 100, 'earned', ?)
    `).run(
      "d1-smoke-refunded-reward",
      "d1-smoke-introducer",
      "d1-smoke-platform-refunded",
      now,
    ),
    /smartlingo reward requires a paid positive platform subscription and matching direct referral/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_introducer_reward_ledger
        (id, introducer_user_id, subscription_payment_id, points, status, created_at)
      VALUES (?, ?, ?, 100, 'earned', ?)
    `).run(
      "d1-smoke-mismatched-introducer-reward",
      "d1-smoke-user",
      "d1-smoke-platform-subscription",
      now,
    ),
    /smartlingo reward requires a paid positive platform subscription and matching direct referral/,
  );
  database.prepare(`
    INSERT INTO smartlingo_introducer_reward_ledger
      (id, introducer_user_id, subscription_payment_id, points, status, created_at)
    VALUES (?, ?, ?, 100, 'earned', ?)
  `).run(
    "d1-smoke-introducer-reward",
    "d1-smoke-introducer",
    "d1-smoke-platform-subscription",
    now,
  );
  assert.throws(
    () => database.prepare(`
      UPDATE smartlingo_platform_subscription_payments
      SET status = 'refunded', refunded_at = ?
      WHERE id = 'd1-smoke-platform-subscription'
    `).run(now + 1),
    /smartlingo earned reward must be reversed before payment reversal/,
  );
  const subscriptionReward = database.prepare(`
    SELECT p.provider_invoice_id AS providerInvoiceId,
      p.subscriber_user_id AS subscriberUserId,
      p.introducer_user_id AS introducerUserId,
      l.points,
      l.status
    FROM smartlingo_platform_subscription_payments p
    JOIN smartlingo_introducer_reward_ledger l
      ON l.subscription_payment_id = p.id
    WHERE p.id = 'd1-smoke-platform-subscription'
  `).get();
  assert.deepEqual(
    { ...subscriptionReward },
    {
      providerInvoiceId: "in_d1_smoke",
      subscriberUserId: "d1-smoke-learner",
      introducerUserId: "d1-smoke-introducer",
      points: 100,
      status: "earned",
    },
  );

  const rewardForeignKeys = database.prepare(
    "SELECT `table`, `from`, `to` FROM pragma_foreign_key_list('smartlingo_introducer_reward_ledger') ORDER BY `from`",
  ).all();
  assert.deepEqual(
    rewardForeignKeys.map(row => ({ ...row })),
    [
      { table: "users", from: "introducer_user_id", to: "id" },
      {
        table: "smartlingo_platform_subscription_payments",
        from: "subscription_payment_id",
        to: "id",
      },
    ],
    "introducer rewards must be anchored to platform subscriptions, never class orders",
  );

  database.prepare(`
    INSERT INTO message_threads (id, kind, subject, created_by, created_at, updated_at)
    VALUES ('d1-smoke-thread', 'direct', '', 'd1-smoke-user', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO message_participants (id, thread_id, user_id, last_read_at)
    VALUES ('d1-smoke-participant', 'd1-smoke-thread', 'd1-smoke-user', ?)
  `).run(now);
  assert.throws(
    () => database.prepare(`
      INSERT INTO message_participants (id, thread_id, user_id, last_read_at)
      VALUES ('d1-smoke-participant-duplicate', 'd1-smoke-thread', 'd1-smoke-user', ?)
    `).run(now),
    /UNIQUE constraint failed/,
  );

  assertDatabaseIntegrity(database);
  return {
    userId: "d1-smoke-user",
    courseId: course.id,
    mediaId: "d1-smoke-media",
    aiRequestId: "d1-smoke-ai-request",
    languagePathId: languagePath.id,
    exerciseId: "d1-smoke-exercise",
    progressId: "d1-smoke-progress",
    connectedAccountUserId: "d1-smoke-user",
    languageClassId: "d1-smoke-language-class",
    classOrderId: "d1-smoke-language-class-order",
    subscriptionPaymentId: "d1-smoke-platform-subscription",
    rewardLedgerId: "d1-smoke-introducer-reward",
    officialCommunityCount: officialCommunities.length,
    sameLanguageMembershipId: sameLanguageMembership.id,
  };
}

export function validateD1Migrations() {
  const migrations = readMigrationManifest();
  assert.equal(migrations.at(-1)?.tag, "0020_restore_german_community");
  const marketplaceMigration = migrations.find(migration => migration.tag === "0017_smartlingo_language_marketplace");
  assert.ok(marketplaceMigration, "0017 marketplace migration must remain tracked");
  assert.doesNotMatch(
    marketplaceMigration.sql,
    /\b(?:DROP\s+(?:TABLE|INDEX)|DELETE\s+FROM|ALTER\s+TABLE\b[\s\S]*?\bDROP\b)/i,
    "0017 must remain additive",
  );

  const database = new DatabaseSync(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON");
    const firstRun = applyTrackedMigrations(database, migrations);
    assert.equal(firstRun.applied.length, migrations.length);
    assert.deepEqual(firstRun.skipped, []);
    assertDatabaseIntegrity(database);
    const stateAfterFirstRun = migrationState(database);

    const secondRun = applyTrackedMigrations(database, migrations);
    assert.deepEqual(secondRun.applied, []);
    assert.equal(secondRun.skipped.length, migrations.length);
    assert.equal(migrationState(database), stateAfterFirstRun);

    const indexes = new Set(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all()
        .map(row => row.name),
    );
    assert.ok(indexes.has("smartcert_message_participant_unique_idx"));
    assert.ok(!indexes.has("smartcert_message_participant_thread_idx"));
    assert.ok(indexes.has("users_clerk_user_id_unique"));
    assert.ok(indexes.has("smartcert_sessions_clerk_session_idx"));
    for (const indexName of [
      "smartlingo_language_paths_slug_unique",
      "smartlingo_connected_accounts_provider_account_id_unique",
      "smartlingo_language_class_member_uq",
      "smartlingo_language_class_invites_code_hash_unique",
      "smartlingo_language_class_orders_provider_checkout_id_unique",
      "smartlingo_language_class_orders_provider_payment_id_unique",
      "smartlingo_language_class_orders_webhook_event_id_unique",
      "smartlingo_platform_subscription_payments_provider_invoice_id_unique",
      "smartlingo_introducer_reward_ledger_subscription_payment_id_unique",
    ]) assert.ok(indexes.has(indexName), `missing required marketplace index: ${indexName}`);

    const tables = new Set(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
        .map(row => row.name),
    );
    for (const tableName of [
      "smartlingo_language_paths",
      "smartlingo_connected_accounts",
      "smartlingo_language_classes",
      "smartlingo_language_class_members",
      "smartlingo_language_class_invites",
      "smartlingo_language_class_orders",
      "smartlingo_platform_subscription_payments",
      "smartlingo_introducer_reward_ledger",
    ]) assert.ok(tables.has(tableName), `missing required marketplace table: ${tableName}`);

    const smoke = runD1Smoke(database);
    return {
      migrationCount: migrations.length,
      firstRunApplied: firstRun.applied.length,
      secondRunApplied: secondRun.applied.length,
      foreignKeyViolations: 0,
      newestMigration: migrations.at(-1).tag,
      smoke,
    };
  } finally {
    database.close();
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = validateD1Migrations();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
