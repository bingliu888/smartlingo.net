import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  assert.match(workflow, /release-manifest\.mjs --require-current-commit/);
  assert.match(workflow, /node scripts\/verify-production-release-report\.mjs/);
  assert.doesNotMatch(workflow, /RELEASE_(?:TITLE|NOTES)/);

  const candidates = ["scripts/deployment-report-sql.mjs", "scripts/generate-deployment-report.mjs", "scripts/project-release-sql.mjs"];
  const sources = [];
  for (const candidate of candidates) {
    try { sources.push(await readFile(candidate, "utf8")); } catch {}
  }
  assert.ok(sources.some((source) => source.includes("./release-manifest.mjs")));
  const productionVerifier = await readFile("scripts/verify-production-release-report.mjs", "utf8");
  assert.match(productionVerifier, /Production Project (?:runtime|page)/);
  assert.match(productionVerifier, /manifest\.purpose\.en/);
});
