import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { interfaceLanguages } = await tsImport("../lib/interface-locale.ts", import.meta.url);
const { isOutsideLanguageMenu } = await tsImport("../components/InterfaceLanguageMenu.tsx", import.meta.url);

test("header and mobile language choices follow the Guandan reading order", () => {
  assert.deepEqual(interfaceLanguages.map(({ code }) => code), [
    "zh", "zh-tw", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi",
  ]);
  assert.equal(interfaceLanguages[0].nativeName, "中文（简体）");
  assert.equal(interfaceLanguages[1].nativeName, "中文（繁體）");
});

test("an open language menu dismisses only for an outside pointer", () => {
  const inside = {};
  const outside = {};
  const menu = { open: true, contains: node => node === inside };
  assert.equal(isOutsideLanguageMenu(menu, inside), false);
  assert.equal(isOutsideLanguageMenu(menu, outside), true);
  menu.open = false;
  assert.equal(isOutsideLanguageMenu(menu, outside), false);
  assert.equal(isOutsideLanguageMenu(null, outside), false);
});
