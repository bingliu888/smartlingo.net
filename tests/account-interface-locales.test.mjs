import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = [
  "../components/ClerkAuthForm.tsx",
  "../components/PasswordSettings.tsx",
  "../components/ProfileEditor.tsx",
  "../components/TextSizeControl.tsx",
  "../app/[lang]/account/page.tsx",
  "../app/[lang]/auth/[mode]/page.tsx",
];

test("account, password, and recovery copy is complete in every supported interface language", async () => {
  const generated = await readFile(new URL("../lib/home-interface-translations.generated.ts", import.meta.url), "utf8");
  const payload = generated.slice(generated.indexOf("= ") + 2, generated.lastIndexOf(";"));
  const translations = JSON.parse(payload);
  const englishKeys = new Set();

  for (const path of sources) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const match of source.matchAll(/\bt\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*,?\s*\)/g)) {
      englishKeys.add(JSON.parse(match[1]));
    }
  }

  assert.ok(englishKeys.size >= 70, `expected broad account-page localization coverage, found ${englishKeys.size}`);
  const acceptedLoanwords = new Set(["it:Password"]);
  for (const locale of ["ja", "ko", "es", "fr", "de", "ru", "it", "pt", "ar", "hi"]) {
    for (const english of englishKeys) {
      const translated = translations[locale]?.[english];
      assert.equal(typeof translated, "string", `${locale} is missing: ${english}`);
      assert.ok(translated.trim(), `${locale} has an empty translation: ${english}`);
      if (!acceptedLoanwords.has(`${locale}:${english}`)) assert.notEqual(translated, english, `${locale} falls back to English: ${english}`);
      for (const placeholder of english.match(/\{[a-z]+\}/g) ?? []) {
        assert.match(translated, new RegExp(placeholder.replace(/[{}]/g, "\\$&")), `${locale} lost ${placeholder}: ${english}`);
      }
    }
  }
});
