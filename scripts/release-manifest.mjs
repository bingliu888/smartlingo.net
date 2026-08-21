import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_SECTIONS = ["features", "affected", "changes", "validation", "deferred", "siteAdaptations"];
const GENERIC_TITLES = new Set(["production release", "deployment", "maintenance", "successful deployment"]);

const text = (value, label) => {
  const result = String(value || "").trim();
  if (!result) throw new Error(`Release manifest is missing ${label}.`);
  return result;
};

const list = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`Release manifest is missing ${label} details.`);
  return value.map((item, index) => text(item, `${label}[${index}]`));
};

export function loadReleaseManifest(path = "release-manifest.json") {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.schemaVersion !== 1) throw new Error("Release manifest schemaVersion must be 1.");
  text(manifest.releaseId, "releaseId");
  text(manifest.site, "site");
  if (manifest.site !== basename(process.cwd())) throw new Error(`Release manifest site ${manifest.site} does not match repository ${basename(process.cwd())}.`);
  for (const language of ["en", "zh"]) {
    const title = text(manifest.title?.[language], `title.${language}`);
    if (GENERIC_TITLES.has(title.toLowerCase())) throw new Error(`Release title is too generic: ${title}`);
    text(manifest.purpose?.[language], `purpose.${language}`);
    for (const section of REQUIRED_SECTIONS) list(manifest[section]?.[language], `${section}.${language}`);
  }
  return manifest;
}

const LABELS = {
  en: { purpose: "Purpose", features: "Feature / fix", affected: "Affected scope", changes: "Implementation", validation: "Validation", deferred: "Deferred / limitation", siteAdaptations: "Site adaptation" },
  zh: { purpose: "部署目的", features: "功能 / 修复", affected: "影响范围", changes: "实现变化", validation: "验证", deferred: "延后 / 限制", siteAdaptations: "站点适配" },
};

export function releaseNotes(manifest, language = "en") {
  const lang = language === "zh" ? "zh" : "en";
  const labels = LABELS[lang];
  return [
    `${labels.purpose}: ${manifest.purpose[lang]}`,
    ...REQUIRED_SECTIONS.flatMap((section) => manifest[section][lang].map((item) => `${labels[section]}: ${item}`)),
  ];
}

function requireCurrentCommitManifest(manifest) {
  const changed = execFileSync("git", ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "HEAD", "--", "release-manifest.json"], { encoding: "utf8" }).trim();
  if (!changed) throw new Error("release-manifest.json must be updated in the deployment commit.");
  try {
    const previous = JSON.parse(execFileSync("git", ["show", "HEAD^:release-manifest.json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    if (previous.releaseId === manifest.releaseId) throw new Error("releaseId must change for every new deployment.");
  } catch (error) {
    if (error instanceof Error && error.message === "releaseId must change for every new deployment.") throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = loadReleaseManifest();
  if (process.argv.includes("--require-current-commit")) requireCurrentCommitManifest(manifest);
  console.log(`Validated detailed release manifest ${manifest.releaseId} for ${manifest.site}.`);
}
