import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { loadReleaseManifest, releaseNotes } from "../scripts/release-manifest.mjs";

test("release manifest produces deployment-specific bilingual details", async () => {
  const manifest = loadReleaseManifest();
  assert.notEqual(manifest.title.en.toLowerCase(), "production release");
  assert.match(releaseNotes(manifest, "en")[0], /^Purpose: /);
  assert.match(releaseNotes(manifest, "zh")[0], /^部署目的: /);
  assert.ok(releaseNotes(manifest, "en").some((note) => note.startsWith("Validation: ")));
  assert.ok(releaseNotes(manifest, "zh").some((note) => note.startsWith("延后 / 限制: ")));

  const directory = await mkdtemp(join(tmpdir(), "release-manifest-"));
  const invalidPath = join(directory, "release-manifest.json");
  await writeFile(invalidPath, JSON.stringify({ ...manifest, title: { ...manifest.title, en: "Production release" } }));
  assert.throws(() => loadReleaseManifest(invalidPath), /too generic/);
});

test("deployment workflow requires a fresh manifest and report code consumes it", async () => {
  const workflow = await readFile(".github/workflows/deploy-cloudflare.yml", "utf8");
  assert.match(workflow, /actions\/checkout@v7\s+with:\s+fetch-depth: 2/);
  assert.match(workflow, /release-manifest\.mjs --require-current-commit/);
  assert.match(workflow, /tests\/voice-input-consistency\.test\.mjs/);
  assert.match(workflow, /https:\/\/smartlingo\.net\/zh\/assistant\?language=en&mode=conversation&partner=leo/);
  assert.match(workflow, /Leo · AI/);
  assert.match(workflow, /SmartLingo AI 学习伙伴，不是真人/);
  assert.match(workflow, /node scripts\/verify-production-release-report\.mjs/);
  assert.doesNotMatch(workflow, /RELEASE_(?:TITLE|NOTES)/);

  const candidates = ["scripts/deployment-report-sql.mjs", "scripts/generate-deployment-report.mjs", "scripts/project-release-sql.mjs"];
  const sources = [];
  for (const candidate of candidates) {
    try { sources.push(await readFile(candidate, "utf8")); } catch {}
  }
  assert.ok(sources.some((source) => source.includes("./release-manifest.mjs")));
  const productionVerifier = await readFile("scripts/verify-production-release-report.mjs", "utf8");
  assert.match(productionVerifier, /entry\.commit === commit/);
  assert.match(productionVerifier, /String\(entry\.runId \|\| ""\) === runId/);
  assert.match(productionVerifier, /manifest\.purpose\.en/);
});

test("current-commit validation rejects stale and reused release manifests", async () => {
  const manifest = loadReleaseManifest();
  const directory = await mkdtemp(join(tmpdir(), "smartlingo-release-git-"));
  const manifestPath = join(directory, "release-manifest.json");
  const script = resolve("scripts/release-manifest.mjs");
  const git = (...args) => execFileSync("git", args, { cwd: directory, stdio: "pipe" });
  const runValidation = () => execFileSync(process.execPath, [script, "--require-current-commit"], { cwd: directory, stdio: "pipe" });
  const initial = { ...manifest, site: basename(directory), releaseId: "initial-release" };

  git("init");
  git("config", "user.email", "release-contract@smartlingo.net");
  git("config", "user.name", "SmartLingo release contract");
  await writeFile(manifestPath, JSON.stringify(initial));
  git("add", "release-manifest.json");
  git("commit", "-m", "initial manifest");

  await writeFile(join(directory, "unrelated.txt"), "unchanged manifest\n");
  git("add", "unrelated.txt");
  git("commit", "-m", "unrelated change");
  assert.throws(runValidation, /release-manifest\.json must be updated/);

  await writeFile(manifestPath, `${JSON.stringify(initial)}\n`);
  git("add", "release-manifest.json");
  git("commit", "-m", "reuse release id");
  assert.throws(runValidation, /releaseId must change/);

  await writeFile(manifestPath, JSON.stringify({ ...initial, releaseId: "next-release" }));
  git("add", "release-manifest.json");
  git("commit", "-m", "fresh release id");
  assert.doesNotThrow(runValidation);
});
