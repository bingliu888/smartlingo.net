import { loadReleaseManifest } from "./release-manifest.mjs";

const manifest = loadReleaseManifest();
const commit = String(process.env.GITHUB_SHA || "").trim();
if (!commit) throw new Error("GITHUB_SHA is required for production release verification.");

const valueFor = (value, language) => {
  if (typeof value === "string") return value;
  return value?.[language] || value?.en || value?.zh || "";
};

const listFor = (value, language) => {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.[language]) ? value[language] : [];
};

const projectSync = await fetch(`https://${manifest.site}/api/project-sync`);
if (projectSync.ok) {
  const runtime = await projectSync.json();
  const builds = Array.isArray(runtime.builds) ? runtime.builds : [];
  const build = [...builds].reverse().find((entry) => commit === entry.commit || commit.startsWith(String(entry.commit || "")) || String(entry.commit || "").startsWith(commit.slice(0, 12)));
  if (!build) throw new Error(`Production Project runtime does not contain exact commit ${commit}.`);
  if (!valueFor(build.title, "en").includes(manifest.title.en)) throw new Error("Production Project title does not match the current release manifest.");
  const completed = listFor(build.completed, "en");
  if (!completed.some((note) => String(note).includes(manifest.purpose.en))) throw new Error("Production Project notes do not contain the current deployment purpose.");
  console.log(`Verified latest Project runtime details for ${manifest.site} at ${commit}.`);
} else {
  const projectPage = await fetch(`https://${manifest.site}/en/project`);
  if (!projectPage.ok) throw new Error(`Production Project page returned ${projectPage.status}.`);
  const html = await projectPage.text();
  if (!html.includes(manifest.title.en) || !html.includes(manifest.purpose.en) || !html.includes(commit)) throw new Error("Production Project page does not contain the current title, purpose, and exact commit.");
  console.log(`Verified rendered Project release details for ${manifest.site} at ${commit}.`);
}
