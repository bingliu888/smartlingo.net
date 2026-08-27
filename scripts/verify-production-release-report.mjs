import { loadReleaseManifest } from "./release-manifest.mjs";

const manifest = loadReleaseManifest();
const commit = String(process.env.GITHUB_SHA || "").trim();
const runId = String(process.env.GITHUB_RUN_ID || "").trim();
if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error("GITHUB_SHA must be the exact full 40-character deployment commit.");
if (!/^\d+$/.test(runId)) throw new Error("GITHUB_RUN_ID is required for production release verification.");

const valueFor = (value, language) => {
  if (typeof value === "string") return value;
  return value?.[language] || value?.en || value?.zh || "";
};

const listFor = (value, language) => {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.[language]) ? value[language] : [];
};

const projectSync = await fetch(`https://${manifest.site}/api/project-sync`);
if (!projectSync.ok) throw new Error(`Production Project API returned ${projectSync.status}.`);
const runtime = await projectSync.json();
const builds = Array.isArray(runtime.builds) ? runtime.builds : [];
const build = [...builds].reverse().find((entry) => entry.commit === commit && String(entry.runId || "") === runId);
if (!build) throw new Error(`Production Project runtime does not contain exact commit ${commit} and Actions run ${runId}.`);
if (!valueFor(build.title, "en").includes(manifest.title.en)) throw new Error("Production Project title does not match the current release manifest.");
const completed = listFor(build.completed, "en");
if (!completed.some((note) => String(note).includes(manifest.purpose.en))) throw new Error("Production Project notes do not contain the current deployment purpose.");
console.log(`Verified latest Project runtime details for ${manifest.site} at exact commit ${commit} and Actions run ${runId}.`);
