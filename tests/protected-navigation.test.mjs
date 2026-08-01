import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared navigation keeps Community available before and after sign-in", async () => {
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const account = await readFile(new URL("../app/[lang]/account/page.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");

  assert.match(header, /href=\{`\/\$\{lang\}\/community`\}/);
  assert.match(header, /zh \? "社区" : "Community"/);
  assert.match(account, /href=\{`\/\$\{lang\}\/community`\}/);
  assert.match(menu, /href=\{`\/\$\{lang\}\/community`\}/);
});
