import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  loadReleaseManifest,
  releaseNotes,
  releaseRollback,
} from "../scripts/release-manifest.mjs";
import { verifyProductionReleaseRuntime } from "../scripts/verify-production-release-report.mjs";

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
  for (const language of ["en", "zh"])
    for (const note of releaseNotes(manifest, language)) assert.ok(output.includes(note));
  assert.ok(output.includes(releaseRollback(manifest).en));
  assert.ok(output.includes(releaseRollback(manifest).zh));
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
  assert.match(reporter, /releaseNotes\(manifest, "en"\)/);
  assert.match(reporter, /releaseNotes\(manifest, "zh"\)/);
  assert.match(reporter, /releaseRollback\(manifest\)/);
  assert.doesNotMatch(reporter, /notesEn\.push|notesZh\.push/);
  assert.match(verifier, /build\.commit !== commit/);
  assert.match(verifier, /builds\.at\(-1\)/);
  assert.match(verifier, /reports\.at\(-1\)/);
  assert.doesNotMatch(verifier, /reverse\(\)\.find/);
});

test("production release verification rejects stale history and incomplete evidence", () => {
  const manifest = loadReleaseManifest();
  const commit = "0123456789abcdef0123456789abcdef01234567";
  const runId = "31999999999";
  const title = {
    en: `${manifest.title.en} · 12:34:56 PDT`,
    zh: `${manifest.title.zh} · 12:34:56 PDT`,
  };
  const notes = {
    en: releaseNotes(manifest, "en"),
    zh: releaseNotes(manifest, "zh"),
  };
  const evidence = {
    en: `Exact deployment commit ${commit}; GitHub Actions ${runId}`,
    zh: `精确部署 commit ${commit}；GitHub Actions ${runId}`,
  };
  const rollback = releaseRollback(manifest);
  const report = {
    title,
    summary: { en: notes.en.join("; "), zh: notes.zh.join("；") },
    validation: {
      en: [...notes.en, evidence.en],
      zh: [...notes.zh, evidence.zh],
    },
    rollback,
  };
  const build = { title, completed: notes, commit, runId };
  const runtime = { builds: [build], reports: [report] };

  assert.doesNotThrow(() => verifyProductionReleaseRuntime({ runtime, manifest, commit, runId }));
  assert.throws(() => verifyProductionReleaseRuntime({
    runtime: { builds: [build, { ...build, commit: "f".repeat(40) }], reports: [report] },
    manifest,
    commit,
    runId,
  }), /Latest production Project build/);
  assert.throws(() => verifyProductionReleaseRuntime({
    runtime: {
      builds: [{ ...build, completed: { ...notes, en: notes.en.slice(0, -1) } }],
      reports: [report],
    },
    manifest,
    commit,
    runId,
  }), /complete ordered en release notes/);
  assert.throws(() => verifyProductionReleaseRuntime({
    runtime: { builds: [build], reports: [{ ...report, rollback: { ...rollback, en: "stale" } }] },
    manifest,
    commit,
    runId,
  }), /rollback does not match/);
});
