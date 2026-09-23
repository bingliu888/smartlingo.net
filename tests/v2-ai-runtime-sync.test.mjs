import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deploy = readFileSync(new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");

test("the verified Konectible provider-secret sync is present without exposing values", () => {
  assert.match(deploy, /- name: Sync existing AI provider secrets/);
  for (const name of ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"]) {
    assert.match(deploy, new RegExp(`if \\[\\[ -n "\\$\\{${name}:-\\}" \\]\\]`));
    assert.match(deploy, new RegExp(`printf '%s' "\\$${name}" \\| npx wrangler secret put ${name} --config wrangler\\.cloudflare\\.jsonc`));
    assert.match(deploy, new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`));
  }
  assert.ok(deploy.indexOf("Sync existing AI provider secrets") < deploy.indexOf("Build exact production Worker"));
});
