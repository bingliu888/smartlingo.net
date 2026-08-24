import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);

test("all imageable beginner lexemes have a visual asset in every language", { timeout: 120_000 }, async () => {
  const { stdout } = await run(process.execPath, [new URL("../scripts/audit-beginner-media-coverage.mjs", import.meta.url).pathname]);
  const report = JSON.parse(stdout);
  assert.equal(report.totalBeginnerLexemes, 12_000);
  assert.equal(report.imageableLexemes, report.coveredImageableLexemes);
  assert.deepEqual(report.nextEnglishMediaQueue, []);
  for (const [language, summary] of Object.entries(report.perLanguage)) {
    assert.equal(summary.total, 1000, language);
    assert.equal(summary.imageablePercent, 100, language);
  }
});
