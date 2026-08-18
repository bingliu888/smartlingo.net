import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the primary navigation exposes course choice, Play, and Ask Guru", async () => {
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  const retiredCommunity = await readFile(new URL("../app/[lang]/community/page.tsx", import.meta.url), "utf8");

  assert.match(header, /zh \? "选择课程" : "Choose course"/);
  assert.match(header, /href=\{`\/\$\{lang\}\/play`\}>\{zh \? "游戏" : "Play"\}/);
  assert.match(header, /zh \? "咨询专家" : "Ask Guru"/);
  assert.doesNotMatch(header, /\/classes|\/community/);
  assert.doesNotMatch(menu, /href=\{`\/\$\{lang\}\/community`\}/);
  assert.match(retiredCommunity, /redirect\(`\/\$\{lang\}\/programs`\)/);
});
