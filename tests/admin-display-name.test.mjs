import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");

test("bootstrap administrator is always displayed as Admin", () => {
  const migration = read("drizzle/0123_admin_display_name.sql");
  const identity = read("lib/clerk-session-bridge.ts");
  assert.match(migration, /display_name = 'Admin'/);
  assert.match(migration, /bingliu@cybeye\.com/);
  assert.match(identity, /bingliu@cybeye\.com/);
  assert.match(identity, /"Admin"/);
});

