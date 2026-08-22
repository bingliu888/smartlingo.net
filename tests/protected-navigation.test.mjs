import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the primary navigation exposes the four learning choices", async () => {
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  const retiredCommunity = await readFile(new URL("../app/[lang]/community/page.tsx", import.meta.url), "utf8");
  const locale = await readFile(new URL("../lib/interface-locale.ts", import.meta.url), "utf8");

  for (const label of ["Everyday speaking", "生活口语", "日常会話", "생활 회화", "Choose course", "选择课程", "コースを選ぶ", "과정 선택"]) assert.match(locale, new RegExp(label));
  assert.match(header, /href=\{`\/\$\{lang\}\/play\?language=\$\{lang\}`\}>\{t\.play\}/);
  assert.match(header, /\{t\.askAi\}/);
  assert.doesNotMatch(header, /\/classes|\/community/);
  assert.doesNotMatch(menu, /href=\{`\/\$\{lang\}\/community`\}/);
  assert.match(retiredCommunity, /redirect\(`\/\$\{lang\}\/programs`\)/);
});
