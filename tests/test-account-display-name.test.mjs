import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");

test("test accounts omit the bingliu+ prefix from display names", () => {
  const migration = read("drizzle/0124_test_account_display_names.sql");
  const identity = read("lib/clerk-session-bridge.ts");
  assert.match(migration, /lower\(email\) LIKE 'bingliu\+%@%'/);
  assert.match(migration, /instr\(lower\(email\), '\+'/);
  assert.match(identity, /\^bingliu\\\+\(\[\^@\]\+\)@/);
});

