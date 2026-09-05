import {
  loadReleaseManifest,
  releaseNotes,
  releaseRollback,
} from "./release-manifest.mjs";
import { pathToFileURL } from "node:url";

const valueFor = (value, language) => {
  if (typeof value === "string") return value;
  return value?.[language] || value?.en || value?.zh || "";
};

const listFor = (value, language) => {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.[language]) ? value[language] : [];
};

export function verifyProductionReleaseRuntime({ runtime, manifest, commit, runId }) {
  if (!/^[0-9a-f]{40}$/i.test(commit))
    throw new Error("GITHUB_SHA must be the exact full 40-character deployment commit.");
  if (!/^\d+$/.test(runId))
    throw new Error("GITHUB_RUN_ID is required for production release verification.");
  const builds = Array.isArray(runtime?.builds) ? runtime.builds : [];
  const reports = Array.isArray(runtime?.reports) ? runtime.reports : [];
  const build = builds.at(-1);
  const report = reports.at(-1);
  if (!build || build.commit !== commit || String(build.runId || "") !== runId)
    throw new Error(`Latest production Project build is not exact commit ${commit} and Actions run ${runId}.`);
  if (!report)
    throw new Error("Production Project runtime does not contain a latest release report.");

  const expected = {
    en: releaseNotes(manifest, "en"),
    zh: releaseNotes(manifest, "zh"),
  };
  for (const language of ["en", "zh"]) {
    const title = valueFor(build.title, language);
    if (!title.startsWith(`${manifest.title[language]} · `))
      throw new Error(`Latest production Project build title does not match title.${language}.`);
    if (valueFor(report.title, language) !== title)
      throw new Error(`Latest production Project report title does not match its build in ${language}.`);
    const completed = listFor(build.completed, language).map(String);
    if (completed.length !== expected[language].length
      || completed.some((note, index) => note !== expected[language][index]))
      throw new Error(`Latest production Project build does not contain the complete ordered ${language} release notes.`);
    const validation = listFor(report.validation, language).map(String);
    if (validation.length !== expected[language].length + 1
      || expected[language].some((note, index) => validation[index] !== note)
      || !validation.at(-1)?.includes(commit)
      || !validation.at(-1)?.includes(`Actions ${runId}`))
      throw new Error(`Latest production Project report validation is incomplete in ${language}.`);
    const summary = valueFor(report.summary, language);
    if (expected[language].some((note) => !summary.includes(note)))
      throw new Error(`Latest production Project report summary is incomplete in ${language}.`);
  }
  const rollback = releaseRollback(manifest);
  if (valueFor(report.rollback, "en") !== rollback.en
    || valueFor(report.rollback, "zh") !== rollback.zh)
    throw new Error("Latest production Project rollback does not match the current release manifest.");
}

async function main() {
  const manifest = loadReleaseManifest();
  const commit = String(process.env.GITHUB_SHA || "").trim();
  const runId = String(process.env.GITHUB_RUN_ID || "").trim();
  const projectSync = await fetch(`https://${manifest.site}/api/project-sync`);
  if (!projectSync.ok)
    throw new Error(`Production Project API returned ${projectSync.status}.`);
  const runtime = await projectSync.json();
  verifyProductionReleaseRuntime({ runtime, manifest, commit, runId });
  console.log(`Verified latest Project runtime details for ${manifest.site} at exact commit ${commit} and Actions run ${runId}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
