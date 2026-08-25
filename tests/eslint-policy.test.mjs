import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("CI enforces zero-warning lint while excluding only generated assets and work directories", async () => {
  const [workflow, config, packageJson] = await Promise.all([
    read(".github/workflows/deploy-cloudflare.yml"),
    read("eslint.config.mjs"),
    read("package.json"),
  ]);
  assert.match(workflow, /Lint authored source with zero-warning policy[\s\S]*npm run lint/);
  assert.match(packageJson, /eslint \. --max-warnings 0/);
  for (const generatedPath of [
    "public\\/pdf\\.worker\\.min\\.mjs",
    "public\\/wallet-assets\\/greatlove-onboard\\.js",
    "output\\/\\*\\*",
    "tmp\\/\\*\\*",
  ]) assert.match(config, new RegExp(generatedPath));
  assert.doesNotMatch(config, /components\/\*\*|app\/\*\*|lib\/\*\*/);
});
