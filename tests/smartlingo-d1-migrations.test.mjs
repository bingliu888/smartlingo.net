import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateD1Migrations } from "../scripts/validate-d1-migrations.mjs";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("tracked D1 migrations apply once, no-op on rerun, and support core reads and writes", () => {
  const result = validateD1Migrations();

  assert.equal(result.migrationCount, 28);
  assert.equal(result.firstRunApplied, 28);
  assert.equal(result.secondRunApplied, 0);
  assert.equal(result.foreignKeyViolations, 0);
  assert.equal(result.newestMigration, "0027_lyrical_quasimodo");
  assert.deepEqual(result.smoke, {
    userId: "d1-smoke-user",
    courseId: "tpl_ai_foundations_2026",
    mediaId: "d1-smoke-media",
    aiRequestId: "d1-smoke-ai-request",
    languagePathId: "path_en_a1",
    exerciseId: "d1-smoke-exercise",
    progressId: "d1-smoke-progress",
    connectedAccountUserId: "d1-smoke-user",
    languageClassId: "d1-smoke-language-class",
    classOrderId: "d1-smoke-language-class-order",
    subscriptionPaymentId: "d1-smoke-platform-subscription",
    rewardLedgerId: "d1-smoke-introducer-reward",
    officialCommunityCount: 12,
    sameLanguageMembershipId: "d1-smoke-same-language-membership",
    officialArabicClassId: "class_official_ar",
    officialHindiClassId: "class_official_hi",
    placementAttemptId: "d1-smoke-placement",
    placementResponseId: "d1-smoke-placement-response",
    learningActivityEventId: "d1-smoke-learning-activity",
    vocabularyProgressId: "d1-smoke-vocabulary-progress",
    learningPathUnitCount: 108,
    learningPlanId: "d1-smoke-plan-ar",
    quickCourseCount: 36,
    freeQuickCourseCount: 12,
    quickCourseEnrollmentId: "d1-smoke-quick-enrollment",
  });
});

test("0019 seeds nine official language communities and keeps same-language enrollment valid", async () => {
  const [schema, migration, catalog, journal] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0019_smartlingo_language_communities.sql"),
    read("../lib/smartlingo-language-communities.ts"),
    read("../drizzle/meta/_journal.json"),
  ]);

  assert.match(schema, /classKind: text\("class_kind"\)\.notNull\(\)\.default\("member_language"\)/);
  assert.match(migration, /ALTER TABLE `smartlingo_language_classes` ADD `class_kind`/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/i);
  assert.match(migration, /smartlingo_language_class_kind_insert_trg/);
  assert.match(migration, /smartlingo_language_class_path_insert_trg/);
  assert.match(migration, /smartlingo_official_language_class_insert_trg/);
  assert.match(migration, /'class_official_zh'/);
  assert.match(migration, /'class_official_pt'/);
  assert.match(migration, /'official_language'/);
  assert.match(migration, /'open','public',0/);
  assert.match(migration, /WHERE `target_language` = 'de'/);
  for (const code of ["zh", "en", "es", "ja", "ko", "fr", "ru", "it", "pt"]) {
    assert.match(catalog, new RegExp(`code: "${code}"`));
  }
  assert.match(journal, /"tag": "0019_smartlingo_language_communities"/);
});

test("0020 restores German as a public, free official language community", async () => {
  const [migration, catalog, journal] = await Promise.all([
    read("../drizzle/0020_restore_german_community.sql"),
    read("../lib/smartlingo-language-communities.ts"),
    read("../drizzle/meta/_journal.json"),
  ]);

  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/i);
  assert.match(migration, /'path_de_a1'/);
  assert.match(migration, /'class_official_de'/);
  assert.match(migration, /'official_language'/);
  assert.match(migration, /'open','public',0/);
  assert.match(migration, /owner_class_official_de/);
  assert.match(catalog, /code: "de"/);
  assert.match(catalog, /nameZh: "德语"/);
  assert.match(catalog, /nameEn: "German"/);
  assert.match(journal, /"tag": "0020_restore_german_community"/);
});

test("0021 adds Arabic and Hindi communities plus placement, daily activity, and vocabulary evidence", async () => {
  const [schema, migration, catalog, journal] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0021_smartlingo_placement_learning.sql"),
    read("../lib/smartlingo-language-communities.ts"),
    read("../drizzle/meta/_journal.json"),
  ]);

  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/i);
  for (const tableName of [
    "smartlingo_placement_attempts",
    "smartlingo_placement_responses",
    "smartlingo_learning_activity_events",
    "smartlingo_vocabulary_progress",
  ]) {
    assert.ok(migration.includes(`CREATE TABLE \`${tableName}\``));
    assert.ok(schema.includes(`sqliteTable("${tableName}"`));
  }
  for (const value of [
    "path_ar_a1",
    "path_hi_a1",
    "class_official_ar",
    "class_official_hi",
    "owner_class_official_ar",
    "owner_class_official_hi",
  ]) assert.match(migration, new RegExp(`'${value}'`));
  assert.match(migration, /smartlingo placement requires an active official language class membership/);
  assert.match(migration, /'vocabulary', 'reading', 'writing', 'listening', 'dialogue'/);
  assert.match(migration, /json_valid\(`modes_seen`\).*json_type\(`modes_seen`\) = 'array'/s);
  assert.match(migration, /FOREIGN KEY \(`attempt_id`\) REFERENCES `smartlingo_placement_attempts`/);
  assert.match(migration, /FOREIGN KEY \(`class_id`\) REFERENCES `smartlingo_language_classes`/);
  assert.match(catalog, /code: "ar"[\s\S]*direction: "rtl"/);
  assert.match(catalog, /code: "hi"[\s\S]*nameEn: "Hindi"/);
  assert.match(journal, /"tag": "0021_smartlingo_placement_learning"/);
});

test("0022 stores bilingual learning goals without erasing per-language path progress", async () => {
  const [schema, migration, journal, route] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0022_smartlingo_learning_paths.sql"),
    read("../drizzle/meta/_journal.json"),
    read("../app/api/learning-plan/route.ts"),
  ]);

  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/i);
  assert.match(migration, /CREATE TABLE `smartlingo_learning_path_units`/);
  assert.match(schema, /sqliteTable\("smartlingo_learning_path_units"/);
  assert.match(migration, /smartlingo_path_unit_path_key_uq/);
  assert.match(migration, /smartlingo_path_unit_path_sequence_uq/);
  assert.match(migration, /WITH `languages` \(`target_language`, `path_id`\) AS/);
  assert.match(migration, /'sl-unit-' \|\| `languages`\.`target_language` \|\| '-' \|\| `units`\.`unit_key`/);
  assert.match(migration, /smartlingo path unit prerequisite must be the preceding unit in the same path/);
  assert.match(migration, /CREATE TABLE `smartlingo_learning_plans`/);
  assert.match(schema, /sqliteTable\("smartlingo_learning_plans"/);
  assert.match(migration, /smartlingo_learning_plan_user_path_uq/);
  assert.match(migration, /smartlingo_learning_plan_active_user_uq/);
  assert.match(migration, /'daily_life', 'travel', 'work', 'study', 'community'/);
  assert.match(migration, /'adaptive', 'self_selected', 'fundamentals'/);
  assert.match(migration, /smartlingo learning plan requires its matching published language path/);
  assert.match(migration, /FOREIGN KEY \(`current_unit_id`\) REFERENCES `smartlingo_learning_path_units`\(`id`\)/);
  assert.match(migration, /`unit`\.`path_id` = NEW\.`path_id`/);
  assert.match(migration, /`unit`\.`target_language` = NEW\.`target_language`/);
  assert.match(migration, /`unit`\.`stage_id` = NEW\.`current_stage_id`/);
  assert.match(migration, /smartlingo learning plan unit must exist in its matching path, language, and stage/);
  assert.match(route, /COALESCE\(smartlingo_learning_plans\.current_stage_id, excluded\.current_stage_id\)/);
  assert.match(route, /COALESCE\(smartlingo_learning_plans\.current_unit_id, excluded\.current_unit_id\)/);
  assert.match(route, /scoresCreated: false/);
  assert.match(journal, /"tag": "0022_smartlingo_learning_paths"/);
});

test("0024 introduces the four-week catalog without deleting legacy enrollment evidence", async () => {
  const [schema, migration, journal, route] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0024_smartlingo_four_week_courses.sql"),
    read("../drizzle/meta/_journal.json"),
    read("../app/api/quick-courses/route.ts"),
  ]);

  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/i);
  assert.match(migration, /CREATE TABLE `smartlingo_quick_course_offerings_v2`/);
  assert.match(migration, /CHECK\(`duration_days` IN \(7,14,28\)\)/);
  assert.match(migration, /CASE WHEN o\.`duration_days` = 30 THEN 28/);
  assert.match(schema, /sqliteTable\("smartlingo_quick_course_offerings_v2"/);
  assert.match(route, /FROM smartlingo_quick_course_offerings_v2/);
  assert.match(journal, /"tag": "0024_smartlingo_four_week_courses"/);
});

test("0025 stores daily session preferences and server-graded quiz history", async () => {
  const [schema, migration, journal, route] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0025_smartlingo_daily_coaching.sql"),
    read("../drizzle/meta/_journal.json"),
    read("../app/api/classes/[classId]/learning/route.ts"),
  ]);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/i);
  for (const name of ["smartlingo_daily_learning_preferences", "smartlingo_daily_quiz_attempts"]) {
    assert.ok(migration.includes(`CREATE TABLE \`${name}\``));
    assert.match(schema, new RegExp(`sqliteTable\\("${name}"`));
  }
  assert.match(migration, /session_minutes` IN \(15,30,45,60\)/);
  assert.match(migration, /smartlingo_daily_quiz_attempt_uq/);
  assert.match(route, /gradeDailyVocabularyQuiz/);
  assert.match(route, /scorePronunciationTranscript/);
  assert.match(journal, /"tag": "0025_smartlingo_daily_coaching"/);
});

test("0026 adds durable admin roles and promotes only the bootstrap administrator", async () => {
  const [schema, migration, journal, auth] = await Promise.all([
    read("../db/schema.ts"), read("../drizzle/0026_smartlingo_admin_roles.sql"),
    read("../drizzle/meta/_journal.json"), read("../lib/auth.ts"),
  ]);
  assert.match(schema, /role: text\("role"\)\.notNull\(\)\.default\("member"\)/);
  assert.match(migration, /lower\(`email`\) = 'bingliu@cybeye\.com'/);
  assert.match(migration, /smartlingo_users_role_created_idx/);
  assert.match(auth, /BOOTSTRAP_ADMIN_EMAIL = "bingliu@cybeye\.com"/);
  assert.match(auth, /UPDATE users SET role = 'admin'/);
  assert.match(journal, /"tag": "0026_smartlingo_admin_roles"/);
});

test("0018 binds original bilingual learning data, exact class money, private media, and direct rewards", async () => {
  const [schema, migration, journal] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0018_smartlingo_core_integrity.sql"),
    read("../drizzle/meta/_journal.json"),
  ]);

  for (const tableName of ["smartlingo_exercises", "smartlingo_language_progress"]) {
    assert.ok(migration.includes(`CREATE TABLE \`${tableName}\``));
    assert.ok(schema.includes(`sqliteTable("${tableName}"`));
  }
  assert.match(migration, /smartlingo_exercise_bilingual_ck/);
  assert.match(migration, /smartlingo_exercise_source_ck/);
  assert.match(migration, /source_type[^\n]+smartlingo_original/);
  assert.match(migration, /smartlingo_language_progress_link_insert_trg/);
  assert.match(migration, /smartlingo_media_kind_ck[\s\S]*voice_practice/);
  assert.match(migration, /smartlingo_media_scope_ck/);
  assert.match(migration, /smartlingo_media_sha256_ck/);
  assert.match(migration, /smartlingo_language_class_order_discount_math_ck/);
  assert.match(migration, /smartlingo_language_class_order_owner_share_ck/);
  assert.match(migration, /smartlingo_language_class_order_first_paid_uq[\s\S]*paid_at/);
  assert.match(migration, /smartlingo_class_order_first_success_insert_trg/);
  assert.match(migration, /smartlingo_platform_payment_referral_insert_trg/);
  assert.match(migration, /smartlingo_reward_earned_payment_insert_trg/);
  assert.match(migration, /payment\.status`?\s*=\s*'paid'|payment`\.\`status\` = 'paid'/);
  assert.match(journal, /"tag": "0018_smartlingo_core_integrity"/);
});

test("0016 is additive and stores only private media metadata and content-free AI usage", async () => {
  const [schema, migration] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0016_d1_cloud_foundation.sql"),
  ]);

  assert.doesNotMatch(
    migration,
    /\b(?:DROP\s+(?:TABLE|INDEX)|DELETE\s+FROM|ALTER\s+TABLE\b[\s\S]*?\bDROP\b)/i,
  );
  assert.match(migration, /ALTER TABLE `users` ADD `clerk_user_id` text/);
  assert.match(migration, /ALTER TABLE `sessions` ADD `clerk_session_id` text/);
  assert.match(migration, /CREATE TABLE `smartlingo_media_assets`/);
  assert.match(migration, /CREATE TABLE `smartlingo_ai_usage_windows`/);
  assert.match(migration, /CREATE TABLE `smartlingo_ai_requests`/);
  assert.match(migration, /'avatar', 'course_cover', 'courseware', 'assignment_attachment', 'chat_attachment', 'certificate_asset'/);
  assert.match(migration, /"smartlingo_media_assets"\."visibility" = 'private'/);
  assert.match(schema, /uniqueIndex\("smartcert_message_participant_unique_idx"\)\.on\(table\.threadId, table\.userId\)/);
  assert.doesNotMatch(schema, /smartcert_message_participant_thread_idx/);

  const aiTables = schema.slice(
    schema.indexOf('sqliteTable("smartlingo_ai_usage_windows"'),
    schema.indexOf('export const paymentWebhookEvents'),
  );
  assert.doesNotMatch(aiTables, /prompt|responseBody|rawContent|transcript/i);
});

test("0017 adds the SmartLingo language marketplace and keeps class money separate from introducer rewards", async () => {
  const [schema, migration] = await Promise.all([
    read("../db/schema.ts"),
    read("../drizzle/0017_smartlingo_language_marketplace.sql"),
  ]);

  assert.doesNotMatch(
    migration,
    /\b(?:DROP\s+(?:TABLE|INDEX)|DELETE\s+FROM|ALTER\s+TABLE\b[\s\S]*?\bDROP\b)/i,
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
  ]) {
    assert.ok(migration.includes(`CREATE TABLE \`${tableName}\``));
    assert.ok(schema.includes(`sqliteTable("${tableName}"`));
  }

  assert.match(migration, /smartlingo_connected_account_provider_ck/);
  assert.match(migration, /"provider" = 'stripe_connect'/);
  assert.match(migration, /smartlingo_language_class_order_discount_ck/);
  assert.match(migration, /"discount_basis_points" IN \(0, 1500\)/);
  assert.match(migration, /smartlingo_language_class_order_split_ck/);
  assert.match(migration, /"owner_share_cents" \+ "smartlingo_language_class_orders"\."platform_fee_cents" = "smartlingo_language_class_orders"\."discounted_pre_tax_cents"/);
  assert.match(migration, /smartlingo_platform_subscription_payments_provider_invoice_id_unique/);
  assert.match(migration, /smartlingo_introducer_reward_ledger_subscription_payment_id_unique/);
  assert.match(migration, /FOREIGN KEY \(`subscription_payment_id`\) REFERENCES `smartlingo_platform_subscription_payments`/);
  assert.doesNotMatch(
    migration.slice(migration.indexOf("CREATE TABLE `smartlingo_introducer_reward_ledger`")),
    /FOREIGN KEY \(`subscription_payment_id`\) REFERENCES `smartlingo_language_class_orders`/,
  );

  for (const pathId of [
    "path_es_a1",
    "path_en_a1",
    "path_fr_a1",
    "path_ja_a1",
    "path_de_a1",
    "path_it_a1",
    "path_ko_a1",
  ]) assert.match(migration, new RegExp(`'${pathId}'`));
});
