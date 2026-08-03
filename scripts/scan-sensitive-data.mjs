import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = [
  ".env.example",
  ".openai",
  "README.md",
  "SITES.md",
  "app",
  "build",
  "components",
  "db",
  "docs",
  "lib",
  "scripts",
  "tests",
  "worker",
];
const skippedDirectories = new Set([
  ".git",
  ".next",
  ".sites-runtime",
  ".wrangler",
  "node_modules",
]);
const skippedExtensions = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
]);

const secretValuePatterns = [
  {
    label: "private-key block",
    pattern: new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join(""), "i"),
  },
  {
    label: "OpenAI-style secret",
    pattern: new RegExp(["\\bsk-", "(?:proj|live|test)-", "[A-Za-z0-9_-]{20,}"].join(""), "g"),
  },
  {
    label: "GitHub token",
    pattern: new RegExp(["\\bgh", "[pousr]_", "[A-Za-z0-9]{30,}"].join(""), "g"),
  },
  {
    label: "AWS access key",
    pattern: new RegExp(["\\bAKIA", "[A-Z0-9]{16}\\b"].join(""), "g"),
  },
];
const activeServerOnlyEnvironmentNames = [
  "ADMIN_EMAILS",
  "CLERK_JWT_KEY",
  "CLERK_SECRET_KEY",
  "EDITORIAL_SYNC_SECRET",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
];

// Reserved for the future Stripe Connect checkout implementation. The current
// runtime does not read these values and live charging remains disabled.
const futureServerOnlyEnvironmentNames = [
  "STRIPE_CONNECT_CLIENT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];
const serverOnlyEnvironmentNames = [
  ...activeServerOnlyEnvironmentNames,
  ...futureServerOnlyEnvironmentNames,
];
const forbiddenClientMarkers = [
  { label: "OpenAI server environment name", pattern: /\bOPENAI_API_KEY\b/g },
  { label: "direct OpenAI provider origin", pattern: /\bapi\.openai\.com\b/g },
  { label: "DeepSeek server environment name", pattern: /\bDEEPSEEK_API_KEY\b/g },
  { label: "direct DeepSeek provider origin", pattern: /\bapi\.deepseek\.com\b/g },
];

async function filesBelow(directory) {
  const details = await stat(directory).catch(() => null);
  if (!details) return [];
  if (details.isFile()) return [directory];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.flatMap(entry => {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? [filesBelow(path)] : entry.isFile() ? [[path]] : [];
  }));
  return nested.flat();
}

async function text(path) {
  if (skippedExtensions.has(extname(path).toLowerCase())) return null;
  const content = await readFile(path);
  if (content.includes(0)) return null;
  return content.toString("utf8");
}

const sourceFiles = (await Promise.all(sourceRoots.map(path => filesBelow(join(root, path))))).flat();
const failures = [];
for (const path of sourceFiles) {
  const content = await text(path);
  if (content === null) continue;
  for (const check of secretValuePatterns) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(content)) {
      failures.push(`${relative(root, path)} contains a ${check.label}`);
    }
  }
}

const clientDirectory = join(root, "dist", "client");
const clientFiles = await filesBelow(clientDirectory);
for (const path of clientFiles) {
  const content = await text(path);
  if (content === null) continue;
  for (const check of secretValuePatterns) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(content)) {
      failures.push(`${relative(root, path)} contains a ${check.label}`);
    }
  }
  for (const check of forbiddenClientMarkers) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(content)) {
      failures.push(`${relative(root, path)} contains a ${check.label}`);
    }
  }
  for (const name of serverOnlyEnvironmentNames) {
    const value = process.env[name];
    if (value && value.length >= 12 && content.includes(value)) {
      failures.push(`${relative(root, path)} exposes the value of server-only setting ${name}`);
    }
  }
}

if (failures.length) {
  throw new Error(`Sensitive-data scan failed:\n${failures.map(item => `- ${item}`).join("\n")}`);
}

console.log(
  `Sensitive-data scan passed: ${sourceFiles.length} source files and ${clientFiles.length} client artifacts.`,
);
