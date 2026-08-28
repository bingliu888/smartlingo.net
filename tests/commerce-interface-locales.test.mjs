import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const locales = ["ja", "ko", "es", "fr", "de", "ru", "it", "pt", "ar", "hi"];
const legitimateSharedTerms = new Set([
  "Direct",
  "Global",
  "Message",
  "Message {name}…",
  "Messages",
  "Password",
  "Plus",
  "online",
]);

test("signed-in menu pages and every wallet-checkout step use complete interface translations", async () => {
  const [menu, checkout, messages, generated] = await Promise.all([
    read("components/HeaderAccount.tsx"),
    read("components/CryptoCheckout.tsx"),
    read("components/MessageCenter.tsx"),
    read("lib/home-interface-translations.generated.ts"),
  ]);
  const payload = generated.slice(generated.indexOf("= ") + 2, generated.lastIndexOf(";"));
  const translations = JSON.parse(payload);
  const englishKeys = new Set();
  for (const source of [menu, checkout, messages]) {
    for (const match of source.matchAll(/\bt\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*,?\s*\)/g)) {
      englishKeys.add(JSON.parse(match[1]));
    }
  }
  assert.ok(englishKeys.size >= 85, `expected broad signed-in and checkout coverage, found ${englishKeys.size}`);
  assert.doesNotMatch(menu, /lang === "zh"\s*\?/);
  assert.doesNotMatch(checkout, /\bzh\s*\?/);
  assert.doesNotMatch(messages, /\bzh\s*\?/);
  for (const locale of locales) {
    for (const english of englishKeys) {
      const translated = translations[locale]?.[english];
      assert.equal(typeof translated, "string", `${locale} is missing: ${english}`);
      assert.ok(translated.trim(), `${locale} has an empty translation: ${english}`);
      if (!legitimateSharedTerms.has(english)) {
        assert.notEqual(translated, english, `${locale} falls back to English: ${english}`);
      }
      for (const placeholder of english.match(/\{[a-z]+\}/g) ?? []) {
        assert.match(translated, new RegExp(placeholder.replace(/[{}]/g, "\\$&")), `${locale} lost ${placeholder}: ${english}`);
      }
    }
  }
});

test("footer legal pages translate their complete copy instead of selecting only Chinese or English", async () => {
  const generated = await read("lib/home-interface-translations.generated.ts");
  const payload = generated.slice(generated.indexOf("= ") + 2, generated.lastIndexOf(";"));
  const translations = JSON.parse(payload);
  for (const path of ["app/[lang]/about/page.tsx", "app/[lang]/privacy/page.tsx", "app/[lang]/terms/page.tsx"]) {
    const source = await read(path);
    assert.match(source, /translateHomeCopy\(copy\.en, locale, homeInterfaceTranslations\)/, path);
    assert.doesNotMatch(source, /copy\[lang === "zh" \? "zh" : "en"\]/, path);
  }
  for (const locale of locales) {
    for (const english of [
      "Language learning that connects daily practice, teachers, and community.",
      "Language, course, community, and voice data should stay understandable.",
      "Learn, teach, coordinate, and refer responsibly.",
    ]) {
      assert.ok(translations[locale]?.[english], `${locale} is missing legal copy: ${english}`);
      assert.notEqual(translations[locale][english], english, `${locale} legal copy falls back to English: ${english}`);
    }
  }
});
