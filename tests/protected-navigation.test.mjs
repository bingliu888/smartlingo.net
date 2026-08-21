import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the primary navigation exposes the four learning choices", async () => {
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  const retiredCommunity = await readFile(new URL("../app/[lang]/community/page.tsx", import.meta.url), "utf8");

  assert.match(header, /zh \? "生活口语" : "Everyday speaking"/);
  assert.match(header, /zh \? "选择课程" : "Choose course"/);
  assert.match(header, /href=\{`\/\$\{lang\}\/play\?language=\$\{lang\}`\}>\{zh \? "边玩边学" : "Learn through play"\}/);
  assert.match(header, /zh \? "咨询AI" : "Ask AI"/);
  assert.doesNotMatch(header, /\/classes|\/community/);
  assert.doesNotMatch(menu, /href=\{`\/\$\{lang\}\/community`\}/);
  assert.match(retiredCommunity, /redirect\(`\/\$\{lang\}\/programs`\)/);
});
