import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every selectable interface language is a real route instead of an English alias", async () => {
  const [menu, locale, generated, home] = await Promise.all([
    read("components/InterfaceLanguageMenu.tsx"), read("lib/interface-locale.ts"),
    read("lib/home-interface-translations.generated.ts"), read("app/[lang]/page.tsx"),
  ]);
  assert.doesNotMatch(menu, /code === "zh" \? "zh" : "en"/);
  assert.match(menu, /localizedPath\(window\.location\.pathname, code\)/);
  assert.match(home, /safeInterfaceLanguage\(lang\)/);
  for (const code of ["ja","ko","es","fr","de","ru","it","pt","ar","hi"]) {
    assert.match(generated, new RegExp(`^  "${code}":`, "m"));
  }
  for (const phrase of ["日常会話","생활 회화","Conversación cotidiana","Conversation quotidienne","Alltagsgespräche","Разговорная практика","Conversazione quotidiana","Conversação diária","محادثات يومية","दैनिक बातचीत"]) {
    assert.match(locale, new RegExp(phrase));
  }
});
