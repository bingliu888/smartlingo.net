import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("production workflows use Node 24-native actions without tolerated setup errors", () => {
  const deploy = read("../.github/workflows/deploy-cloudflare.yml");
  const qa = read("../.github/workflows/qa-21-day-learning.yml");

  for (const workflow of [deploy, qa]) {
    assert.match(workflow, /actions\/checkout@v7/);
    assert.match(workflow, /actions\/setup-node@v7/);
    assert.match(workflow, /git config --global init\.defaultBranch main/);
    assert.match(workflow, /npm ci --loglevel=error/);
    assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v4/);
  }

  assert.match(qa, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(deploy, /wrangler r2 bucket create/);
  assert.doesNotMatch(deploy, /bucket create[^\n]*\|\| true/);
  assert.match(deploy, /npm audit --audit-level=moderate/);
});

test("known tool notices are handled without hiding release failures", () => {
  const deploy = read("../.github/workflows/deploy-cloudflare.yml");
  const vite = read("../vite.config.ts");
  const proxy = read("../proxy.ts");
  const packageJson = JSON.parse(read("../package.json"));

  assert.match(deploy, /NODE_OPTIONS: --disable-warning=ExperimentalWarning/);
  assert.match(deploy, /release_sql="\$\(node scripts\/deployment-report-sql\.mjs\)"/);
  assert.match(deploy, /--command "\$release_sql"/);
  assert.doesNotMatch(deploy, /--file \/tmp\/smartlingo-release\.sql/);
  assert.match(vite, /chunkSizeWarningLimit: 2_500/);
  assert.match(vite, /pluginTimings: false/);
  assert.match(vite, /cloudflare\.bindings\.json" with \{ type: "json" \}/);
  assert.match(vite, /sites-vite-plugin\.ts/);
  assert.match(proxy, /:lang\(zh\|en\|es\|ja\|ko\|fr\|de\|ru\|it\|pt\|ar\|hi\)\/\:path\*/);
  assert.doesNotMatch(proxy, /\(\?!_next/);
  assert.equal(packageJson.devDependencies.wrangler, "4.126.0");
  assert.equal(packageJson.devDependencies["@cloudflare/vite-plugin"], "1.54.0");
  assert.equal(packageJson.devDependencies.vite, "8.2.2");
  assert.equal(packageJson.devDependencies.vinext, "1.0.0-beta.8");
  assert.equal(packageJson.devDependencies["react-server-dom-webpack"], "19.2.8");
  assert.equal(packageJson.dependencies.next, "16.3.3");
  assert.equal(packageJson.dependencies.react, "19.2.8");
  assert.equal(packageJson.dependencies["react-dom"], "19.2.8");
  assert.equal(
    packageJson.dependencies.xlsx,
    "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
  );
  assert.equal(packageJson.overrides.uuid, "11.1.1");
  assert.equal(packageJson.overrides.esbuild, "0.28.2");
  assert.equal(packageJson.overrides.tmp, "0.2.7");
});
