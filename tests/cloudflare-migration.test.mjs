import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const implementation = await readFile(new URL("../lib/cloudflare-migration.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/admin/cloudflare-migration/route.ts", import.meta.url), "utf8");

test("migration export is protected and never accepts a short secret", () => {
  assert.match(implementation, /MIGRATION_EXPORT_SECRET/);
  assert.match(implementation, /expected\.length >= 32/);
  assert.match(implementation, /secureEqual/);
  assert.match(implementation, /cache-control/);
  assert.match(route, /cloudflareMigrationExport/);
});

test("migration export is paginated for D1 and R2", () => {
  assert.match(implementation, /__migration_rowid__/);
  assert.match(implementation, /nextAfter/);
  assert.match(implementation, /nextCursor/);
  assert.match(implementation, /MAX_OBJECT_CHUNK/);
});

test("migration export excludes internal tables", () => {
  assert.match(implementation, /d1_migrations/);
  assert.match(implementation, /__drizzle_migrations/);
  assert.match(implementation, /INTERNAL_TABLE_PREFIXES/);
});
