import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { SMARTLINGO_LANGUAGE_CATALOG, buildLanguagePath } from "../lib/smartlingo-paths.ts";

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
      WHEN 'it' THEN 8 WHEN 'pt' THEN 9 WHEN 'ar' THEN 10 WHEN 'hi' THEN 11
      ELSE 12 END
  `).all().map(row => row.code);
  assert.deepEqual(publishedLanguages, ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"]);
  const officialCommunities = database.prepare(`
    SELECT c.id, c.target_language AS targetLanguage, c.class_kind AS classKind,
      c.status, c.visibility, c.price_cents AS priceCents
    FROM smartlingo_language_classes c
    WHERE c.class_kind = 'official_language'
    ORDER BY CASE c.target_language
      WHEN 'zh' THEN 0 WHEN 'en' THEN 1 WHEN 'es' THEN 2 WHEN 'ja' THEN 3
      WHEN 'ko' THEN 4 WHEN 'fr' THEN 5 WHEN 'de' THEN 6 WHEN 'ru' THEN 7
      WHEN 'it' THEN 8 WHEN 'pt' THEN 9 WHEN 'ar' THEN 10 WHEN 'hi' THEN 11
      ELSE 12 END
  `).all().map(row => ({ ...row }));
  assert.equal(officialCommunities.length, 12);
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
  const newestOfficialCommunities = database.prepare(`
    SELECT language_class.id, language_class.path_id AS pathId,
      language_class.target_language AS targetLanguage,
      membership.user_id AS ownerUserId, membership.role, membership.status
    FROM smartlingo_language_classes AS language_class
    JOIN smartlingo_language_class_members AS membership
      ON membership.class_id = language_class.id
    WHERE language_class.id IN ('class_official_ar', 'class_official_hi')
      AND membership.user_id = 'smartlingo-official-community'
    ORDER BY language_class.id
  `).all().map(row => ({ ...row }));
  assert.deepEqual(newestOfficialCommunities, [
    {
      id: "class_official_ar",
      pathId: "path_ar_a1",
      targetLanguage: "ar",
      ownerUserId: "smartlingo-official-community",
      role: "owner",
      status: "active",
    },
    {
      id: "class_official_hi",
      pathId: "path_hi_a1",
      targetLanguage: "hi",
      ownerUserId: "smartlingo-official-community",
      role: "owner",
      status: "active",
    },
  ]);
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

  const learningPathUnitRegistry = database.prepare(`
    SELECT COUNT(*) AS unitCount,
      COUNT(DISTINCT target_language) AS languageCount,
      COUNT(DISTINCT path_id) AS pathCount,
      SUM(CASE WHEN stage_id = 'foundation' THEN 1 ELSE 0 END) AS foundationCount,
      SUM(CASE WHEN stage_id = 'everyday' THEN 1 ELSE 0 END) AS everydayCount,
      SUM(CASE WHEN stage_id = 'independent' THEN 1 ELSE 0 END) AS independentCount
    FROM smartlingo_learning_path_units
  `).get();
  assert.deepEqual({ ...learningPathUnitRegistry }, {
    unitCount: 108,
    languageCount: 12,
    pathCount: 12,
    foundationCount: 36,
    everydayCount: 36,
    independentCount: 36,
  }, "0022 must seed exactly nine registered units for every language path");
  const registeredLearningPathUnits = database.prepare(`
    SELECT id, path_id AS pathId, target_language AS targetLanguage,
      stage_id AS stageId, sequence, unit_key AS unitKey,
      prerequisite_unit_id AS prerequisiteUnitId, availability,
      content_version AS contentVersion, source_type AS sourceType
    FROM smartlingo_learning_path_units
    ORDER BY target_language, sequence
  `).all().map(row => ({ ...row }));
  const expectedLearningPathUnits = SMARTLINGO_LANGUAGE_CATALOG
    .flatMap(language => buildLanguagePath(language.code).flatMap(stage => stage.units.map((unit, index) => ({
      id: unit.id,
      pathId: language.pathId,
      targetLanguage: language.code,
      stageId: stage.id,
      sequence: ({ foundation: 0, everyday: 3, independent: 6 })[stage.id] + index + 1,
      unitKey: unit.id.replace(`sl-unit-${language.code}-`, ""),
      prerequisiteUnitId: unit.prerequisiteUnitId,
      availability: unit.availability,
      contentVersion: unit.contentVersion,
      sourceType: unit.sourceType,
    }))))
    .sort((left, right) => left.targetLanguage.localeCompare(right.targetLanguage) || left.sequence - right.sequence);
  assert.deepEqual(
    registeredLearningPathUnits,
    expectedLearningPathUnits,
    "D1 unit identities, stages, prerequisites, and versions must exactly match the authored path catalog",
  );

  database.prepare(`
    INSERT INTO smartlingo_learning_plans
      (id, user_id, path_id, target_language, use_case, daily_minutes,
       self_reported_level, entry_mode, content_version, current_stage_id,
       current_unit_id, is_active, created_at, updated_at)
    VALUES ('d1-smoke-plan-ar', 'd1-smoke-learner', 'path_ar_a1', 'ar',
      'travel', 10, 'beginner', 'fundamentals', '2026-08-02.1',
      'foundation', 'sl-unit-ar-first-contact', 1, ?, ?)
  `).run(now, now);
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_learning_plans
        (id, user_id, path_id, target_language, use_case, daily_minutes,
         self_reported_level, entry_mode, content_version, is_active,
         created_at, updated_at)
      VALUES ('d1-smoke-plan-wrong-path', 'd1-smoke-user', 'path_hi_a1', 'ar',
        'study', 5, 'beginner', 'adaptive', '2026-08-02.1', 0, ?, ?)
    `).run(now, now),
    /smartlingo learning plan requires its matching published language path/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_learning_plans
        (id, user_id, path_id, target_language, use_case, daily_minutes,
         self_reported_level, entry_mode, content_version, current_stage_id,
         current_unit_id, is_active, created_at, updated_at)
      VALUES ('d1-smoke-plan-wrong-unit', 'd1-smoke-user', 'path_ar_a1', 'ar',
        'study', 5, 'beginner', 'fundamentals', '2026-08-02.1',
        'foundation', 'sl-unit-hi-first-contact', 0, ?, ?)
    `).run(now, now),
    /smartlingo learning plan unit must exist in its matching path, language, and stage/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_learning_plans
        (id, user_id, path_id, target_language, use_case, daily_minutes,
         self_reported_level, entry_mode, content_version, current_stage_id,
         current_unit_id, is_active, created_at, updated_at)
      VALUES ('d1-smoke-plan-missing-unit', 'd1-smoke-user', 'path_ar_a1', 'ar',
        'study', 5, 'beginner', 'fundamentals', '2026-08-02.1',
        'foundation', 'sl-unit-ar-does-not-exist', 0, ?, ?)
    `).run(now, now),
    /smartlingo learning plan unit must exist in its matching path, language, and stage/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_learning_plans
        (id, user_id, path_id, target_language, use_case, daily_minutes,
         self_reported_level, entry_mode, content_version, current_stage_id,
         current_unit_id, is_active, created_at, updated_at)
      VALUES ('d1-smoke-plan-stage-mismatch', 'd1-smoke-user', 'path_ar_a1', 'ar',
        'study', 5, 'advanced', 'self_selected', '2026-08-02.1',
        'independent', 'sl-unit-ar-first-contact', 0, ?, ?)
    `).run(now, now),
    /smartlingo learning plan unit must exist in its matching path, language, and stage/,
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_learning_plans
      SET current_stage_id = 'independent'
      WHERE id = 'd1-smoke-plan-ar'`).run(),
    /smartlingo learning plan unit must exist in its matching path, language, and stage/,
  );
  database.prepare(`UPDATE smartlingo_learning_plans SET is_active = 0
    WHERE id = 'd1-smoke-plan-ar'`).run();
  database.prepare(`
    INSERT INTO smartlingo_learning_plans
      (id, user_id, path_id, target_language, use_case, daily_minutes,
       self_reported_level, entry_mode, content_version, is_active,
       created_at, updated_at)
    VALUES ('d1-smoke-plan-hi', 'd1-smoke-learner', 'path_hi_a1', 'hi',
      'work', 15, 'intermediate', 'adaptive', '2026-08-02.1', 1, ?, ?)
  `).run(now, now);
  database.prepare(`UPDATE smartlingo_learning_plans SET is_active = 0
    WHERE id = 'd1-smoke-plan-hi'`).run();
  database.prepare(`
    INSERT INTO smartlingo_learning_plans
      (id, user_id, path_id, target_language, use_case, daily_minutes,
       self_reported_level, entry_mode, content_version, current_stage_id,
       current_unit_id, is_active, created_at, updated_at)
    VALUES ('d1-smoke-plan-ar-retry', 'd1-smoke-learner', 'path_ar_a1', 'ar',
      'community', 20, 'advanced', 'self_selected', '2026-08-02.2',
      'independent', 'sl-unit-ar-explain-a-choice', 1, ?, ?)
    ON CONFLICT(user_id, path_id) DO UPDATE SET
      use_case = excluded.use_case,
      daily_minutes = excluded.daily_minutes,
      self_reported_level = excluded.self_reported_level,
      entry_mode = excluded.entry_mode,
      content_version = excluded.content_version,
      current_stage_id = COALESCE(smartlingo_learning_plans.current_stage_id, excluded.current_stage_id),
      current_unit_id = COALESCE(smartlingo_learning_plans.current_unit_id, excluded.current_unit_id),
      is_active = 1,
      updated_at = excluded.updated_at
  `).run(now, now + 1);
  const learningPlans = database.prepare(`
    SELECT target_language AS targetLanguage, use_case AS useCase,
      daily_minutes AS dailyMinutes, content_version AS contentVersion,
      current_stage_id AS currentStageId, current_unit_id AS currentUnitId,
      is_active AS isActive
    FROM smartlingo_learning_plans WHERE user_id = 'd1-smoke-learner'
    ORDER BY target_language
  `).all().map(row => ({ ...row }));
  assert.deepEqual(learningPlans, [
    {
      targetLanguage: "ar",
      useCase: "community",
      dailyMinutes: 20,
      contentVersion: "2026-08-02.2",
      currentStageId: "foundation",
      currentUnitId: "sl-unit-ar-first-contact",
      isActive: 1,
    },
    {
      targetLanguage: "hi",
      useCase: "work",
      dailyMinutes: 15,
      contentVersion: "2026-08-02.1",
      currentStageId: null,
      currentUnitId: null,
      isActive: 0,
    },
  ], "language switching and version updates must retain each path's saved position");

  const insertPlacementAttempt = database.prepare(`
    INSERT INTO smartlingo_placement_attempts
      (id, user_id, class_id, path_id, entry_mode, status, current_difficulty,
       active_seconds, last_resumed_at, started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'adaptive', 'in_progress', 3, 0, ?, ?, ?, ?)
  `);
  assert.throws(
    () => insertPlacementAttempt.run(
      "d1-smoke-placement-without-membership",
      "d1-smoke-learner",
      "class_official_ar",
      "path_ar_a1",
      now,
      now,
      now,
      now,
    ),
    /smartlingo placement requires an active official language class membership/,
  );
  database.prepare(`
    INSERT INTO smartlingo_language_class_members
      (id, class_id, user_id, role, status, joined_at, updated_at)
    VALUES ('d1-smoke-ar-membership', 'class_official_ar',
      'd1-smoke-learner', 'student', 'active', ?, ?)
  `).run(now, now);
  assert.throws(
    () => insertPlacementAttempt.run(
      "d1-smoke-placement-wrong-path",
      "d1-smoke-learner",
      "class_official_ar",
      "path_hi_a1",
      now,
      now,
      now,
      now,
    ),
    /smartlingo placement requires an active official language class membership/,
  );
  insertPlacementAttempt.run(
    "d1-smoke-placement",
    "d1-smoke-learner",
    "class_official_ar",
    "path_ar_a1",
    now,
    now,
    now,
    now,
  );
  database.prepare(`
    INSERT INTO smartlingo_placement_responses
      (id, attempt_id, item_key, item_version, skill, difficulty, answer_text,
       skipped, score, ai_feedback, duration_seconds, answered_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'vocabulary', 3, ?, 0, 88, '', 42, ?, ?, ?)
  `).run(
    "d1-smoke-placement-response",
    "d1-smoke-placement",
    "sl-vocab-ar-schedule-001",
    "2026-08-01.1",
    "جدول",
    now,
    now,
    now,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_placement_responses
        (id, attempt_id, item_key, item_version, skill, difficulty,
         answered_at, created_at, updated_at)
      VALUES ('d1-smoke-placement-response-missing-parent', 'missing-attempt',
        'missing-parent', '2026-08-01.1', 'reading', 3, ?, ?, ?)
    `).run(now, now, now),
    /FOREIGN KEY constraint failed/,
  );
  database.prepare(`
    INSERT INTO smartlingo_learning_activity_events
      (id, user_id, class_id, attempt_id, domain, activity_type,
       duration_seconds, units, score, source_type, source_id, created_at)
    VALUES (?, ?, ?, ?, 'vocabulary', 'placement', 42, 1, 88,
      'placement_response', ?, ?)
  `).run(
    "d1-smoke-learning-activity",
    "d1-smoke-learner",
    "class_official_ar",
    "d1-smoke-placement",
    "d1-smoke-placement-response",
    now,
  );
  database.prepare(`
    INSERT INTO smartlingo_vocabulary_progress
      (id, user_id, path_id, class_id, word_key, word_version, status,
       modes_seen, review_box, interval_days, review_count, correct_count,
       lapse_count, last_score, due_at, last_reviewed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'mastered', ?, 3, 7, 3, 3, 0, 88, ?, ?, ?, ?)
  `).run(
    "d1-smoke-vocabulary-progress",
    "d1-smoke-learner",
    "path_ar_a1",
    "class_official_ar",
    "sl-vocab-ar-schedule-001",
    "2026-08-01.1",
    '["recognition","recall","listening"]',
    now + 7 * 86_400,
    now,
    now,
    now,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_vocabulary_progress
        (id, user_id, path_id, word_key, word_version, modes_seen,
         created_at, updated_at)
      VALUES ('d1-smoke-vocabulary-invalid-json', 'd1-smoke-learner',
        'path_ar_a1', 'invalid-json', '2026-08-01.1', 'not-json', ?, ?)
    `).run(now, now),
    /CHECK constraint failed: smartlingo_vocabulary_progress_modes_ck/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO smartlingo_learning_activity_events
        (id, user_id, attempt_id, domain, activity_type, source_type,
         source_id, created_at)
      VALUES ('d1-smoke-activity-missing-attempt', 'd1-smoke-learner',
        'missing-attempt', 'dialogue', 'placement', 'placement_response',
        'missing-response', ?)
    `).run(now),
    /FOREIGN KEY constraint failed/,
  );
  const placementSmoke = database.prepare(`
    SELECT placement.id, placement.entry_mode AS entryMode,
      placement.current_difficulty AS currentDifficulty,
      response.id AS responseId, response.skill, response.score,
      activity.id AS activityId, activity.domain,
      vocabulary.id AS vocabularyProgressId, vocabulary.modes_seen AS modesSeen
    FROM smartlingo_placement_attempts AS placement
    JOIN smartlingo_placement_responses AS response
      ON response.attempt_id = placement.id
    JOIN smartlingo_learning_activity_events AS activity
      ON activity.attempt_id = placement.id
    JOIN smartlingo_vocabulary_progress AS vocabulary
      ON vocabulary.user_id = placement.user_id
      AND vocabulary.path_id = placement.path_id
    WHERE placement.id = 'd1-smoke-placement'
  `).get();
  assert.deepEqual(
    { ...placementSmoke, modesSeen: JSON.parse(placementSmoke.modesSeen) },
    {
      id: "d1-smoke-placement",
      entryMode: "adaptive",
      currentDifficulty: 3,
      responseId: "d1-smoke-placement-response",
      skill: "vocabulary",
      score: 88,
      activityId: "d1-smoke-learning-activity",
      domain: "vocabulary",
      vocabularyProgressId: "d1-smoke-vocabulary-progress",
      modesSeen: ["recognition", "recall", "listening"],
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

  const quickCourseCount = database.prepare(`SELECT COUNT(*) AS count
    FROM smartlingo_quick_course_offerings_v2 WHERE status = 'published'`).get();
  assert.equal(quickCourseCount.count, 36);
  const freeCourseCount = database.prepare(`SELECT COUNT(*) AS count
    FROM smartlingo_quick_course_offerings_v2 WHERE is_free = 1`).get();
  assert.equal(freeCourseCount.count, 12);
  const fourWeekCourseCount = database.prepare(`SELECT COUNT(*) AS count
    FROM smartlingo_quick_course_offerings_v2 WHERE duration_days = 28`).get();
  assert.equal(fourWeekCourseCount.count, 12);
  const legacyDurationCount = database.prepare(`SELECT COUNT(*) AS count
    FROM smartlingo_quick_course_offerings_v2 WHERE duration_days = 30`).get();
  assert.equal(legacyDurationCount.count, 0);
  database.prepare(`INSERT INTO smartlingo_quick_course_enrollments_v2
    (id, offering_id, user_id, class_id, access_type, status, current_day,
     started_at, created_at, updated_at)
    VALUES ('d1-smoke-quick-enrollment','sl-quick-zh-beginner-7d-v1',
      'd1-smoke-learner','class_official_zh','free','active',1,?,?,?)`)
    .run(now, now, now);
  database.prepare(`INSERT INTO smartlingo_quick_course_daily_scores
    (id, enrollment_id, user_id, class_id, course_day, local_date, score,
     skill_scores, quiz_score, is_complete, created_at, updated_at)
    VALUES ('d1-smoke-quick-score','d1-smoke-quick-enrollment','d1-smoke-learner',
      'class_official_zh',1,'2026-08-02',95,
      '{"vocabulary":95,"listening":95,"dialogue":95}',95,1,?,?)`)
    .run(now, now);
  database.prepare(`INSERT INTO smartlingo_course_certificates
    (id, certificate_number, verification_code, enrollment_id, offering_id,
     user_id, class_id, member_name, course_title_zh, course_title_en,
     target_language, level, duration_days, completed_days, final_score,
     pass_score, completion_reason, curriculum_version, issued_at, created_at)
    VALUES ('d1-smoke-certificate','SL-2026-SMOKE','SMOKEVERIFY2026',
      'd1-smoke-quick-enrollment','sl-quick-zh-beginner-7d-v1','d1-smoke-learner',
      'class_official_zh','D1 Smoke Learner','七天旅行生存课','7-day Travel Essentials',
      'zh','beginner',7,1,95,60,'early_mastery','2026-08-02.2',?,?)`)
    .run(now, now);

  database.prepare(`INSERT INTO smartlingo_course_enrollments_v3
    (id, offering_id, user_id, class_id, access_type, status, start_day,
     current_day, daily_seconds, started_at, created_at, updated_at)
    VALUES ('d1-smoke-course-enrollment','sl-course-zh-beginner-7d-v1',
      'd1-smoke-learner','class_official_zh','free','active',1,1,3600,?,?,?)`)
    .run(now, now, now);
  database.prepare(`INSERT INTO smartlingo_course_session_state
    (enrollment_id, course_day, duration_seconds, remaining_seconds, status,
     last_started_at, updated_at)
    VALUES ('d1-smoke-course-enrollment',1,3600,2700,'running',?,?)`)
    .run(now, now);
  database.prepare(`INSERT INTO smartlingo_course_day_progress_v2
    (id, enrollment_id, user_id, class_id, course_day, started_date,
     last_activity_date, score, skill_scores, quiz_score, is_complete,
     started_at, updated_at)
    VALUES ('d1-smoke-course-day','d1-smoke-course-enrollment',
      'd1-smoke-learner','class_official_zh',1,'2026-08-03','2026-08-03',92,
      '{"vocabulary":94,"reading":91,"writing":89,"listening":93,"dialogue":90}',
      90,0,?,?)`)
    .run(now, now);
  const courseLoop = database.prepare(`
    SELECT enrollment.id AS enrollmentId, session.course_day AS courseDay,
      session.duration_seconds AS durationSeconds,
      session.remaining_seconds AS remainingSeconds, session.status,
      progress.id AS progressId, progress.score,
      progress.skill_scores AS skillScores
    FROM smartlingo_course_enrollments_v3 AS enrollment
    JOIN smartlingo_course_session_state AS session
      ON session.enrollment_id = enrollment.id
    JOIN smartlingo_course_day_progress_v2 AS progress
      ON progress.enrollment_id = enrollment.id AND progress.course_day = session.course_day
    WHERE enrollment.id = 'd1-smoke-course-enrollment'
  `).get();
  assert.deepEqual(
    { ...courseLoop, skillScores: JSON.parse(courseLoop.skillScores) },
    {
      enrollmentId: "d1-smoke-course-enrollment",
      courseDay: 1,
      durationSeconds: 3600,
      remainingSeconds: 2700,
      status: "running",
      progressId: "d1-smoke-course-day",
      score: 92,
      skillScores: {
        vocabulary: 94,
        reading: 91,
        writing: 89,
        listening: 93,
        dialogue: 90,
      },
    },
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_course_session_state
      SET duration_seconds = 1800 WHERE enrollment_id = 'd1-smoke-course-enrollment'`).run(),
    /CHECK constraint failed: smartlingo_course_session_duration_ck/,
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_course_session_state
      SET remaining_seconds = -1 WHERE enrollment_id = 'd1-smoke-course-enrollment'`).run(),
    /CHECK constraint failed: smartlingo_course_session_remaining_ck/,
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_course_day_progress_v2
      SET skill_scores = '[]' WHERE id = 'd1-smoke-course-day'`).run(),
    /CHECK constraint failed: smartlingo_course_day_v2_skills_ck/,
  );

  database.prepare(`INSERT INTO smartlingo_daily_session_checkpoints
    (id, enrollment_id, user_id, class_id, course_day, local_date, time_zone,
     content_version, plan_json, draft_json, active_step, revision,
     created_at, updated_at)
    VALUES ('d1-smoke-daily-checkpoint','d1-smoke-course-enrollment',
      'd1-smoke-learner','class_official_zh',1,'2026-08-03',
      'America/Los_Angeles','2026-08-03.1',
      '{"minutes":60,"skills":["vocabulary","reading","writing","listening","dialogue"]}',
      '{"writing":"初稿 / first draft"}','writing',1,?,?)`)
    .run(now, now);
  const checkpointBeforeSync = database.prepare(`
    SELECT id, active_step AS activeStep, revision, draft_json AS draftJson
    FROM smartlingo_daily_session_checkpoints
    WHERE id = 'd1-smoke-daily-checkpoint'
  `).get();
  assert.deepEqual(
    { ...checkpointBeforeSync, draftJson: JSON.parse(checkpointBeforeSync.draftJson) },
    {
      id: "d1-smoke-daily-checkpoint",
      activeStep: "writing",
      revision: 1,
      draftJson: { writing: "初稿 / first draft" },
    },
  );
  const checkpointAfterSync = database.prepare(`
    UPDATE smartlingo_daily_session_checkpoints
    SET draft_json = ?, active_step = 'listening', revision = revision + 1,
      last_operation_id = 'd1-smoke-sync-operation',
      last_operation_fingerprint = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      updated_at = ?
    WHERE id = 'd1-smoke-daily-checkpoint' AND revision = ?
    RETURNING revision, active_step AS activeStep, draft_json AS draftJson
  `).get('{"writing":"修订稿 / revised draft"}', now + 1, 1);
  assert.deepEqual(
    { ...checkpointAfterSync, draftJson: JSON.parse(checkpointAfterSync.draftJson) },
    {
      revision: 2,
      activeStep: "listening",
      draftJson: { writing: "修订稿 / revised draft" },
    },
  );
  const staleCheckpointUpdate = database.prepare(`
    UPDATE smartlingo_daily_session_checkpoints
    SET draft_json = '{}', revision = revision + 1, updated_at = ?
    WHERE id = 'd1-smoke-daily-checkpoint' AND revision = 1
    RETURNING revision
  `).get(now + 2);
  assert.equal(staleCheckpointUpdate, undefined, "stale checkpoint revisions must not overwrite newer drafts");
  const checkpointRevisions = database.prepare(`SELECT revision, draft_json AS draftJson,
    active_step AS activeStep FROM smartlingo_daily_checkpoint_revisions
    WHERE checkpoint_id = 'd1-smoke-daily-checkpoint' ORDER BY revision`).all();
  assert.deepEqual(checkpointRevisions.map(row => ({
    ...row,
    draftJson: JSON.parse(row.draftJson),
  })), [
    { revision: 1, draftJson: { writing: "初稿 / first draft" }, activeStep: "writing" },
    { revision: 2, draftJson: { writing: "修订稿 / revised draft" }, activeStep: "listening" },
  ]);
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_daily_session_checkpoints
      SET revision = 0 WHERE id = 'd1-smoke-daily-checkpoint'`).run(),
    /checkpoint revisions must advance exactly once|smartlingo_daily_checkpoint_revision_ck/,
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_daily_session_checkpoints
      SET draft_json = '{"writing":"missing operation evidence"}',
        last_operation_id = 'd1-smoke-sync-missing-fingerprint',
        last_operation_fingerprint = NULL, revision = revision + 1, updated_at = ?
      WHERE id = 'd1-smoke-daily-checkpoint' AND revision = 2`).run(now + 2),
    /checkpoint updates require operation evidence/,
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_daily_session_checkpoints
      SET plan_json = '[]' WHERE id = 'd1-smoke-daily-checkpoint'`).run(),
    /CHECK constraint failed: smartlingo_daily_checkpoint_plan_ck/,
  );
  assert.throws(
    () => database.prepare(`INSERT INTO smartlingo_daily_session_checkpoints
      (id, enrollment_id, user_id, class_id, course_day, local_date, time_zone,
       content_version, created_at, updated_at)
      VALUES ('d1-smoke-checkpoint-duplicate','d1-smoke-course-enrollment',
        'd1-smoke-learner','class_official_zh',1,'2026-08-03','UTC',
        '2026-08-03.1',?,?)`).run(now, now),
    /UNIQUE constraint failed/,
  );

  const insertSyncOperation = database.prepare(`
    INSERT OR IGNORE INTO smartlingo_daily_sync_operations
      (id, checkpoint_id, user_id, operation, request_fingerprint, created_at)
    VALUES (?, 'd1-smoke-daily-checkpoint', 'd1-smoke-learner', 'save_draft',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', ?)
  `);
  insertSyncOperation.run("d1-smoke-sync-operation", now);
  insertSyncOperation.run("d1-smoke-sync-operation", now + 1);
  const syncOperationCount = database.prepare(`
    SELECT COUNT(*) AS count, MIN(request_fingerprint) AS requestFingerprint
    FROM smartlingo_daily_sync_operations
    WHERE id = 'd1-smoke-sync-operation'
  `).get();
  assert.equal(syncOperationCount.count, 1, "replayed draft operations must stay idempotent");
  assert.equal(
    syncOperationCount.requestFingerprint,
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "checkpoint receipts must atomically bind the request fingerprint",
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_daily_session_checkpoints
      SET draft_json = '{"writing":"must roll back"}', revision = revision + 1,
        last_operation_id = 'd1-smoke-sync-operation',
        last_operation_fingerprint = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        updated_at = ?
      WHERE id = 'd1-smoke-daily-checkpoint' AND revision = 2`).run(now + 2),
    /UNIQUE constraint failed: smartlingo_daily_sync_operations.id/,
  );
  const checkpointAfterReceiptCollision = database.prepare(`SELECT revision, draft_json AS draftJson
    FROM smartlingo_daily_session_checkpoints WHERE id = 'd1-smoke-daily-checkpoint'`).get();
  assert.deepEqual(
    { ...checkpointAfterReceiptCollision, draftJson: JSON.parse(checkpointAfterReceiptCollision.draftJson) },
    { revision: 2, draftJson: { writing: "修订稿 / revised draft" } },
    "a receipt collision must roll back the checkpoint update and its revision snapshot",
  );
  assert.throws(
    () => database.prepare(`INSERT INTO smartlingo_daily_sync_operations
      (id, checkpoint_id, user_id, operation, created_at)
      VALUES ('d1-smoke-sync-invalid','d1-smoke-daily-checkpoint',
        'd1-smoke-learner','complete_course',?)`).run(now),
    /CHECK constraint failed: smartlingo_daily_sync_operation_ck/,
  );

  database.prepare(`INSERT INTO smartlingo_daily_answer_feedback
    (id, checkpoint_id, user_id, class_id, task_id, skill,
     client_operation_id, answer_text, score, correct, skipped,
     explanation_zh, explanation_en, hint_zh, hint_en, content_version, created_at)
    VALUES ('d1-smoke-answer-feedback','d1-smoke-daily-checkpoint',
      'd1-smoke-learner','class_official_zh','sl-day-1-writing','writing',
      'd1-smoke-feedback-operation','I need a train ticket.',92,1,0,
      '回答清楚表达了购票需求。','The answer clearly expresses the ticket request.',
      '下一次可补充目的地。','Add the destination next time.',
      '2026-08-03.1',?)`)
    .run(now);
  database.prepare(`INSERT OR IGNORE INTO smartlingo_daily_answer_feedback
    (id, checkpoint_id, user_id, class_id, task_id, skill,
     client_operation_id, answer_text, score, correct, skipped,
     explanation_zh, explanation_en, hint_zh, hint_en, content_version, created_at)
    VALUES ('d1-smoke-answer-feedback-replay','d1-smoke-daily-checkpoint',
      'd1-smoke-learner','class_official_zh','sl-day-1-writing','writing',
      'd1-smoke-feedback-operation','I need a train ticket.',92,1,0,
      '回答清楚表达了购票需求。','The answer clearly expresses the ticket request.',
      '下一次可补充目的地。','Add the destination next time.',
      '2026-08-03.1',?)`).run(now + 1);
  const answerFeedbackCount = database.prepare(`
    SELECT COUNT(*) AS count FROM smartlingo_daily_answer_feedback
    WHERE client_operation_id = 'd1-smoke-feedback-operation'
  `).get();
  assert.equal(answerFeedbackCount.count, 1, "replayed answer operations must not duplicate feedback");
  assert.throws(
    () => database.prepare(`INSERT INTO smartlingo_daily_answer_feedback
      (id, checkpoint_id, user_id, class_id, task_id, skill,
       client_operation_id, score, correct, skipped, explanation_zh,
       explanation_en, hint_zh, hint_en, content_version, created_at)
      VALUES ('d1-smoke-answer-feedback-invalid','d1-smoke-daily-checkpoint',
        'd1-smoke-learner','class_official_zh','sl-day-1-reading','reading',
        'd1-smoke-feedback-invalid',80,0,1,'说明','Explanation','提示','Hint',
        '2026-08-03.1',?)`).run(now),
    /CHECK constraint failed: smartlingo_daily_feedback_skip_ck/,
  );

  let quizTransactionFailed = false;
  database.exec("BEGIN");
  try {
    database.prepare(`INSERT INTO smartlingo_daily_answer_feedback
      (id, checkpoint_id, user_id, class_id, task_id, skill,
       client_operation_id, answer_text, score, correct, skipped,
       explanation_zh, explanation_en, hint_zh, hint_en, content_version, created_at)
      VALUES ('d1-smoke-quiz-receipt','d1-smoke-daily-checkpoint','d1-smoke-learner',
        'class_official_zh','daily-quiz:2026-08-03','quiz','d1-smoke-quiz-operation',
        '{"fingerprint":"transaction-smoke"}',90,1,0,'测验说明','Quiz explanation',
        '测验提示','Quiz hint','2026-08-03.1',?)`).run(now);
    database.prepare(`INSERT INTO smartlingo_daily_quiz_attempts
      (id,user_id,class_id,local_date,target_language,content_version,attempt_number,
       score,correct_count,question_count,created_at)
      VALUES ('d1-smoke-quiz-attempt','d1-smoke-learner','class_official_zh',
        '2026-08-03','zh','2026-08-03.1',1,90,4,5,?)`).run(now);
    database.prepare(`INSERT INTO smartlingo_learning_activity_events
      (id,user_id,class_id,domain,activity_type,duration_seconds,units,score,
       source_type,source_id,created_at)
      VALUES ('d1-smoke-quiz-activity','d1-smoke-learner','class_official_zh',
        'vocabulary','practice',180,5,90,'daily_quiz','d1-smoke-quiz-attempt',?)`).run(now);
    database.prepare(`INSERT INTO smartlingo_learning_xp_ledger
      (id,user_id,class_id,activity_event_id,xp,reason,local_date,time_zone,created_at)
      VALUES ('d1-smoke-quiz-xp-invalid','d1-smoke-learner','class_official_zh',
        'd1-smoke-quiz-activity',0,'daily_quiz','2026-08-03','America/Los_Angeles',?)`).run(now);
    database.exec("COMMIT");
  } catch {
    quizTransactionFailed = true;
    database.exec("ROLLBACK");
  }
  assert.equal(quizTransactionFailed, true, "the forced final quiz write must fail");
  const rolledBackQuiz = database.prepare(`SELECT
    (SELECT COUNT(*) FROM smartlingo_daily_answer_feedback WHERE id = 'd1-smoke-quiz-receipt') AS receipts,
    (SELECT COUNT(*) FROM smartlingo_daily_quiz_attempts WHERE id = 'd1-smoke-quiz-attempt') AS attempts,
    (SELECT COUNT(*) FROM smartlingo_learning_activity_events WHERE id = 'd1-smoke-quiz-activity') AS activities,
    (SELECT COUNT(*) FROM smartlingo_learning_xp_ledger WHERE id = 'd1-smoke-quiz-xp-invalid') AS xp`).get();
  assert.deepEqual(
    { ...rolledBackQuiz },
    { receipts: 0, attempts: 0, activities: 0, xp: 0 },
    "a failed final quiz write must roll back every earlier evidence row",
  );

  database.prepare(`INSERT INTO smartlingo_learning_activity_events
    (id, user_id, class_id, domain, activity_type, duration_seconds, units,
     score, source_type, source_id, created_at)
    VALUES ('d1-smoke-loop-activity','d1-smoke-learner','class_official_zh',
      'writing','practice',60,1,92,'daily_session','d1-smoke-answer-feedback',?)`)
    .run(now);
  const insertXp = database.prepare(`
    INSERT OR IGNORE INTO smartlingo_learning_xp_ledger
      (id, user_id, class_id, activity_event_id, xp, reason, local_date,
       time_zone, created_at)
    VALUES (?, 'd1-smoke-learner', 'class_official_zh',
      'd1-smoke-loop-activity', 12, 'daily_practice', '2026-08-03',
      'America/Los_Angeles', ?)
  `);
  insertXp.run("d1-smoke-xp", now);
  insertXp.run("d1-smoke-xp-replay", now + 1);
  const xpLedgerCount = database.prepare(`
    SELECT COUNT(*) AS count, SUM(xp) AS totalXp
    FROM smartlingo_learning_xp_ledger
    WHERE activity_event_id = 'd1-smoke-loop-activity'
  `).get();
  assert.deepEqual(
    { ...xpLedgerCount },
    { count: 1, totalXp: 12 },
    "replayed learning activity must award XP exactly once",
  );
  assert.throws(
    () => database.prepare(`INSERT INTO smartlingo_learning_xp_ledger
      (id, user_id, class_id, activity_event_id, xp, reason, local_date,
       time_zone, created_at)
      VALUES ('d1-smoke-xp-zero','d1-smoke-learner','class_official_zh',
        'd1-smoke-learning-activity',0,'daily_practice','2026-08-03','UTC',?)`).run(now),
    /CHECK constraint failed: smartlingo_learning_xp_amount_ck/,
  );

  database.prepare(`INSERT INTO smartlingo_learning_streaks
    (user_id, time_zone, current_streak, longest_streak, last_qualified_date,
     repaired_date, repair_window_started_date, repair_credits, updated_at)
    VALUES ('d1-smoke-learner','America/Los_Angeles',2,3,'2026-08-03',
      '2026-08-02','2026-07-05',0,?)`)
    .run(now);
  const streak = database.prepare(`
    SELECT user_id AS userId, current_streak AS currentStreak,
      longest_streak AS longestStreak, repaired_date AS repairedDate,
      repair_credits AS repairCredits, revision
    FROM smartlingo_learning_streaks WHERE user_id = 'd1-smoke-learner'
  `).get();
  assert.deepEqual(
    { ...streak },
    {
      userId: "d1-smoke-learner",
      currentStreak: 2,
      longestStreak: 3,
      repairedDate: "2026-08-02",
      repairCredits: 0,
      revision: 0,
    },
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_learning_streaks
      SET longest_streak = 1 WHERE user_id = 'd1-smoke-learner'`).run(),
    /CHECK constraint failed: smartlingo_learning_streak_counts_ck/,
  );
  assert.throws(
    () => database.prepare(`UPDATE smartlingo_learning_streaks
      SET repair_credits = 2 WHERE user_id = 'd1-smoke-learner'`).run(),
    /CHECK constraint failed: smartlingo_learning_streak_credit_ck/,
  );
  const streakCas = database.prepare(`UPDATE smartlingo_learning_streaks
    SET current_streak = 3, longest_streak = 3, last_qualified_date = '2026-08-04',
      revision = revision + 1, updated_at = ?
    WHERE user_id = 'd1-smoke-learner' AND revision = 0 RETURNING revision`).get(now + 1);
  assert.deepEqual({ ...streakCas }, { revision: 1 });
  const staleStreakCas = database.prepare(`UPDATE smartlingo_learning_streaks
    SET current_streak = 1, revision = revision + 1, updated_at = ?
    WHERE user_id = 'd1-smoke-learner' AND revision = 0 RETURNING revision`).get(now + 2);
  assert.equal(staleStreakCas, undefined, "a stale streak materialization must not overwrite a newer revision");

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
    officialArabicClassId: newestOfficialCommunities[0].id,
    officialHindiClassId: newestOfficialCommunities[1].id,
    placementAttemptId: placementSmoke.id,
    placementResponseId: placementSmoke.responseId,
    learningActivityEventId: placementSmoke.activityId,
    vocabularyProgressId: placementSmoke.vocabularyProgressId,
    learningPathUnitCount: learningPathUnitRegistry.unitCount,
    learningPlanId: "d1-smoke-plan-ar",
    quickCourseCount: quickCourseCount.count,
    freeQuickCourseCount: freeCourseCount.count,
    quickCourseEnrollmentId: "d1-smoke-quick-enrollment",
    quickCourseDailyScoreId: "d1-smoke-quick-score",
    certificateId: "d1-smoke-certificate",
    courseEnrollmentId: courseLoop.enrollmentId,
    courseSessionProgressId: courseLoop.progressId,
    dailyCheckpointId: checkpointBeforeSync.id,
    checkpointRevisionCount: checkpointRevisions.length,
    syncOperationId: "d1-smoke-sync-operation",
    answerFeedbackId: "d1-smoke-answer-feedback",
    learningXpId: "d1-smoke-xp",
    learningStreakUserId: streak.userId,
  };
}

export function validateD1Migrations() {
  const migrations = readMigrationManifest();
  assert.equal(migrations.at(-1)?.tag, "0035_class_live_audio");
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
      "smartlingo_placement_attempt_active_uq",
      "smartlingo_placement_response_item_uq",
      "smartlingo_learning_activity_source_uq",
      "smartlingo_vocabulary_progress_word_uq",
      "smartlingo_path_unit_path_key_uq",
      "smartlingo_path_unit_path_sequence_uq",
      "smartlingo_learning_plan_user_path_uq",
      "smartlingo_learning_plan_active_user_uq",
      "smartlingo_quick_course_path_duration_v2_uq",
      "smartlingo_quick_enrollment_user_offering_v2_uq",
      "smartlingo_daily_quiz_attempt_uq",
      "smartlingo_users_role_created_idx",
      "smartlingo_quick_daily_enrollment_date_uq",
      "smartlingo_quick_daily_enrollment_day_uq",
      "smartlingo_course_certificates_enrollment_id_unique",
      "smartlingo_course_v3_path_level_duration_uq",
      "smartlingo_course_enrollment_v3_user_offering_uq",
      "smartlingo_course_day_v2_enrollment_day_uq",
      "smartlingo_course_certificates_v2_enrollment_id_unique",
      "smartlingo_daily_checkpoint_enrollment_day_uq",
      "smartlingo_daily_answer_feedback_client_operation_id_unique",
      "smartlingo_learning_xp_ledger_activity_event_id_unique",
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
      "smartlingo_placement_attempts",
      "smartlingo_placement_responses",
      "smartlingo_learning_activity_events",
      "smartlingo_vocabulary_progress",
      "smartlingo_learning_path_units",
      "smartlingo_learning_plans",
      "smartlingo_quick_course_offerings",
      "smartlingo_quick_course_enrollments",
      "smartlingo_quick_course_offerings_v2",
      "smartlingo_quick_course_enrollments_v2",
      "smartlingo_daily_learning_preferences",
      "smartlingo_daily_quiz_attempts",
      "smartlingo_quick_course_daily_scores",
      "smartlingo_course_certificates",
      "smartlingo_course_offerings_v3",
      "smartlingo_course_enrollments_v3",
      "smartlingo_course_day_progress_v2",
      "smartlingo_course_session_state",
      "smartlingo_course_certificates_v2",
      "smartlingo_daily_session_checkpoints",
      "smartlingo_daily_sync_operations",
      "smartlingo_daily_answer_feedback",
      "smartlingo_learning_xp_ledger",
      "smartlingo_learning_streaks",
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
