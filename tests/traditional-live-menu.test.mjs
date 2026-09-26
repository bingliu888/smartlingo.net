import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Traditional Chinese is an interface locale, not a thirteenth learning course", async () => {
  const [locale, menu, learning, translations, runtime, clerk] = await Promise.all([
    read("lib/interface-locale.ts"), read("components/InterfaceLanguageMenu.tsx"),
    read("lib/smartlingo-language-communities.ts"), read("lib/traditional-ui-translations.generated.ts"),
    read("components/LocaleRuntime.tsx"), read("components/LocalizedClerkProvider.tsx"),
  ]);
  assert.match(locale, /SmartLingoCommunityLanguage \| "zh-tw"/);
  assert.match(menu, /interfaceLanguages\.map/);
  assert.doesNotMatch(menu, /interface-language-dismiss/);
  assert.match(runtime, /zh-Hant-TW/);
  assert.match(clerk, /"zh-tw": zhTW/);
  assert.doesNotMatch(learning, /code: "zh-tw"/);
  assert.match(translations, /"两种学习方式，从一门语言开始。": "兩種學習方式，從一門語言開始。"/);
});

test("Max landing contains only the chosen language path and its language hub leads with the tutor", async () => {
  const [landing, detail] = await Promise.all([
    read("app/[lang]/max/page.tsx"), read("app/[lang]/programs/[language]/page.tsx"),
  ]);
  assert.match(landing, /<LearningLanguageTiles/);
  assert.doesNotMatch(landing, /learning-hub-card/);
  const cards = detail.slice(detail.indexOf('<div className="learning-hub-grid">'));
  assert.ok(cards.indexOf('path === "max" && <article') < cards.indexOf('{ui.play}'));
  assert.match(cards, /max\/tutor\?language=\$\{language\}/);
});

test("Traditional Chinese remains localized through Guru, sign-in, and legal destinations", async () => {
  const [guru, form, about, privacy, terms, disclaimer] = await Promise.all([
    read("app/[lang]/assistant/page.tsx"), read("components/ClerkAuthForm.tsx"),
    read("app/[lang]/about/page.tsx"), read("app/[lang]/privacy/page.tsx"),
    read("app/[lang]/terms/page.tsx"), read("lib/disclaimer-copy.ts"),
  ]);
  assert.match(guru, /isInterfaceLanguage\(lang\)/);
  assert.match(form, /lang === "zh-tw" \? "zh" : "en"/);
  for (const source of [about, privacy, terms, disclaimer]) {
    assert.match(source, /translateTraditionalCopy\(cop(?:y|ies)\.zh\)/);
  }
});
