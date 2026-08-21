import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("all 48,000 published vocabulary rows pass the release quality gates", () => {
  const output = execFileSync(process.execPath, ["scripts/audit-smartlingo-vocabulary-quality.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const audit = JSON.parse(output);
  assert.equal(audit.totalRows, 48_000);
  assert.equal(audit.findingCount, 0, JSON.stringify(audit.samples, null, 2));
  assert.deepEqual(audit.counts, {});
});
