import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = JSON.parse(await readFile(new URL("../wrangler.cloudflare.jsonc", import.meta.url), "utf8"));

test("direct Cloudflare deployment uses isolated SmartLingo resources", () => {
  assert.equal(config.name, "smartlingo-net");
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.match(config.d1_databases[0].database_name, /^smartlingo-net-cutover-/);
  assert.equal(config.r2_buckets[0].binding, "BUCKET");
  assert.match(config.r2_buckets[0].bucket_name, /^smartlingo-net-cutover-/);
  assert.equal(config.routes, undefined, "formal domains stay on Sites until shadow acceptance passes");
});

test("direct config contains no runtime secrets", () => {
  const serialized = JSON.stringify(config);
  for (const key of ["CLERK_SECRET_KEY", "CLERK_JWT_KEY", "OPENAI_API_KEY", "MIGRATION_EXPORT_SECRET"]) {
    assert.doesNotMatch(serialized, new RegExp(key));
  }
});
