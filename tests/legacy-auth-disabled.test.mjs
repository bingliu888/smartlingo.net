import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routes = [
  "../app/api/auth/request-code/route.ts",
  "../app/api/auth/verify-code/route.ts",
  "../app/api/auth/forgot/route.ts",
];

test("legacy local authentication endpoints are explicit tombstones", async () => {
  for (const path of routes) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const route = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    const response = await route.POST();
    const payload = await response.json();

    assert.equal(response.status, 410, path);
    assert.equal(payload.code, "legacy_auth_disabled", path);
    assert.doesNotMatch(source, /createSession|getDatabase|sha256|fetch\(/, path);
  }
});
