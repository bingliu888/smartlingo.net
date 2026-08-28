import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { loadReleaseManifest } from "../scripts/release-manifest.mjs";

test("deployment SQL records the exact full commit, Actions run, and declared migration boundary", async () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";
  const runId = "31999999999";
  const script = resolve("scripts/deployment-report-sql.mjs");
  const output = execFileSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_SHA: commit, GITHUB_RUN_ID: runId, GITHUB_REPOSITORY: "bingliu888/smartlingo.net" },
  });

  assert.match(output, new RegExp(commit));
  assert.match(output, /"runId":"31999999999"/);
  assert.match(output, /https:\/\/github\.com\/bingliu888\/smartlingo\.net\/actions\/runs\/31999999999/);
  const manifest = loadReleaseManifest();
  if (manifest.dataMigration?.included) {
    for (const migration of manifest.dataMigration.migrations) assert.match(output, new RegExp(migration));
    assert.match(output, new RegExp(manifest.dataMigration.rollback.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } else {
    assert.match(output, /This release has no data migration/);
  }
  assert.throws(() => execFileSync(process.execPath, [script], {
    stdio: "pipe",
    env: { ...process.env, GITHUB_SHA: commit.slice(0, 12), GITHUB_RUN_ID: runId },
  }), /Command failed/);
});

test("production evidence is probed before Project publication and verified exactly", async () => {
  const workflow = await readFile(".github/workflows/deploy-cloudflare.yml", "utf8");
  const reporter = await readFile("scripts/deployment-report-sql.mjs", "utf8");
  const verifier = await readFile("scripts/verify-production-release-report.mjs", "utf8");
  const assistantProbe = workflow.indexOf("https://smartlingo.net/zh/assistant?language=en&mode=conversation&partner=leo");
  const projectPublication = workflow.indexOf("Publish exact Project release record");

  assert.ok(assistantProbe >= 0 && assistantProbe < projectPublication);
  assert.match(reporter, /commit,\s*runId/);
  assert.match(reporter, /manifest\.dataMigration\?\.included/);
  assert.match(reporter, /manifest\.dataMigration\.rollback/);
  assert.match(verifier, /entry\.commit === commit/);
  assert.match(verifier, /String\(entry\.runId \|\| ""\) === runId/);
  assert.doesNotMatch(verifier, /startsWith/);
});
