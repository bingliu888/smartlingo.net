import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateD1Migrations } from "../scripts/validate-d1-migrations.mjs";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("tracked D1 migrations apply once, no-op on rerun, and support core reads and writes", () => {
  const result = validateD1Migrations();

  assert.equal(result.migrationCount, 18);
  assert.equal(result.firstRunApplied, 18);
  assert.equal(result.secondRunApplied, 0);
  assert.equal(result.foreignKeyViolations, 0);
  assert.equal(result.newestMigration, "0017_smartlingo_language_marketplace");
  assert.deepEqual(result.smoke, {
    userId: "d1-smoke-user",
    courseId: "tpl_ai_foundations_2026",
    mediaId: "d1-smoke-media",
    aiRequestId: "d1-smoke-ai-request",
    languagePathId: "path_en_a1",
    connectedAccountUserId: "d1-smoke-user",
    languageClassId: "d1-smoke-language-class",
    classOrderId: "d1-smoke-language-class-order",
    subscriptionPaymentId: "d1-smoke-platform-subscription",
    rewardLedgerId: "d1-smoke-introducer-reward",
  });
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
