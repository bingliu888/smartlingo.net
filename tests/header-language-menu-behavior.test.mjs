import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const { interfaceLanguages } = await tsImport("../lib/interface-locale.ts", import.meta.url);
const { InterfaceLanguageMenu, isOutsideLanguageMenu } = await tsImport("../components/InterfaceLanguageMenu.tsx", import.meta.url);

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

test("the desktop switcher uses Guandan's flat buttons and pressed-state contract", () => {
  const html = renderToStaticMarkup(createElement(InterfaceLanguageMenu, { lang: "en" }));
  assert.match(html, /<details class="header-language-menu icon-language-menu">/);
  assert.match(html, /<div class="header-language-options">/);
  assert.match(html, /aria-pressed="true" class="active"><span dir="ltr">English<\/span>/);
  assert.match(html, /中文（简体）/);
  assert.match(html, /中文（繁體）/);
  assert.doesNotMatch(html, /role="menu"|role="menuitemradio"/);
});

test("the native details close state is not overridden by a redundant display rule", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /header-language-menu:not\(\[open\]\)/);
});

test("the phone language menu stays within SmartLingo's narrower header gutters", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media\(max-width:420px\)\{\.site-header\{[^}]*\}\.site-header \.header-language-options\{width:min\(330px,calc\(100vw - 80px\)\)\}/);
});
