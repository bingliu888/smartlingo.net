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

test("Ask AI composer attributes use the active twelve-language interface catalog", async () => {
  const [locale, assistant] = await Promise.all([
    read("lib/interface-locale.ts"), read("components/AssistantClient.tsx"),
  ]);
  for (const phrase of ["AI講師にメッセージ…", "AI 강사에게 메시지…", "Escribe al tutor de IA…", "Écrire au tuteur IA…", "Dem KI-Tutor schreiben…", "Написать ИИ-наставнику…", "Scrivi al tutor IA…", "Escreva ao tutor de IA…", "اكتب إلى معلّم الذكاء الاصطناعي…", "AI शिक्षक को संदेश लिखें…"]) {
    assert.match(locale, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(assistant, /composer\.current\?\.setAttribute\("placeholder", composerCopy\.placeholder\)/);
  assert.match(assistant, /composer\.current\?\.setAttribute\("aria-label", composerCopy\.question\)/);
});
