import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import {
  loadReleaseManifest,
  releaseNotes,
  releaseRollback,
} from "../scripts/release-manifest.mjs";

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
  assert.deepEqual(releaseRollback(manifest), manifest.dataMigration.rollback);

  const rejects = async (value, pattern) => {
    await writeFile(invalidPath, JSON.stringify(value));
    assert.throws(() => loadReleaseManifest(invalidPath), pattern);
  };
  await rejects({ ...manifest, dataMigration: undefined }, /missing dataMigration policy/);
  await rejects({ ...manifest, dataMigration: { ...manifest.dataMigration, included: "false" } }, /included must be boolean/);
  await rejects({ ...manifest, dataMigration: { ...manifest.dataMigration, migrations: "none" } }, /migrations must be an array/);
  await rejects({ ...manifest, dataMigration: { ...manifest.dataMigration, included: false, migrations: ["0181"] } }, /empty migrations array/);
  await rejects({ ...manifest, dataMigration: { ...manifest.dataMigration, included: true, migrations: [] } }, /missing dataMigration\.migrations details/);
  await rejects({ ...manifest, dataMigration: { ...manifest.dataMigration, rollback: { en: "rollback" } } }, /rollback\.zh/);
});

test("deployment workflow requires a fresh manifest and report code consumes it", async () => {
  const workflow = await readFile(".github/workflows/deploy-cloudflare.yml", "utf8");
  assert.match(workflow, /actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803[^\n]*\n\s+with:\s+fetch-depth: 2/);
  assert.match(workflow, /release-manifest\.mjs --require-current-commit/);
  assert.match(workflow, /for file in tests\/\*\.test\.mjs/);
  assert.match(workflow, /node --test "\$\{tests\[@\]\}"/);
  assert.match(workflow, /runs-on: macos-15[\s\S]*npm run validate:layout/);
  assert.match(workflow, /needs: \[validate, layout\]/);
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
  assert.match(productionVerifier, /build\.commit !== commit/);
  assert.match(productionVerifier, /builds\.at\(-1\)/);
  assert.match(productionVerifier, /reports\.at\(-1\)/);
  assert.match(productionVerifier, /releaseNotes\(manifest, "en"\)/);
  assert.match(productionVerifier, /releaseRollback\(manifest\)/);
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
