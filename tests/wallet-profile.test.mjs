import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("account profile can display, validate, save, and update an EVM wallet", async () => {
  const [editor, route, schema, migrationNames] = await Promise.all([
    readFile(new URL("../components/ProfileEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readdir(new URL("../drizzle", import.meta.url)),
  ]);
  const migrationSources = await Promise.all(
    migrationNames
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8")),
  );

  assert.match(editor, /EVM wallet/);
  assert.match(editor, /walletEditing/);
  assert.match(editor, /walletAddress: normalizedWallet/);
  assert.match(route, /wallet_address AS walletAddress/);
  assert.match(route, /assignments\.push\("wallet_address = \?"\)/);
  assert.match(route, /\^0x\[a-fA-F0-9\]\{40\}\$/);
  assert.match(schema, /walletAddress: text\("wallet_address"\)/);
  assert.match(migrationSources.join("\n"), /ALTER TABLE `users` ADD `wallet_address` text/);
});

test("account profile stores a validated server-side text AI provider preference", async () => {
  const [editor, route, schema, migration] = await Promise.all([
    readFile(new URL("../components/ProfileEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0028_wise_baron_strucker.sql", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /Default text model/);
  assert.match(editor, /DeepSeek V4 Flash/);
  assert.match(editor, /value="auto"/);
  assert.match(editor, /value="openai"/);
  assert.match(editor, /value="deepseek"/);
  assert.match(route, /ai_provider_preference = \?/);
  assert.match(route, /payload\.aiProviderPreference === "openai" \|\| payload\.aiProviderPreference === "deepseek"/);
  assert.match(schema, /aiProviderPreference: text\("ai_provider_preference"\)/);
  assert.match(migration, /CHECK \(`ai_provider_preference` IN \('auto', 'openai', 'deepseek'\)\)/);
});
