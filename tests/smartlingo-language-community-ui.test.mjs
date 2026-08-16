import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

function chooserMetrics(viewport) {
  const container = Math.min(viewport, 1420);
  const padding = viewport <= 560 ? 20 : viewport <= 820 ? 28 : Math.max(24, Math.min(64, viewport * 0.044));
  const columns = viewport <= 560 ? 1 : viewport <= 820 ? 2 : 3;
  const gap = 11;
  const inner = container - (padding * 2);
  const card = (inner - (gap * (columns - 1))) / columns;
  const popover = Math.min(390, viewport - 28);
  return { container, inner, columns, card, popover };
}

test("the shared header uses one accessible twelve-language text dropdown without flags or an I-speak selector", async () => {
  const [header, menu, chooser, home, catalog, css] = await Promise.all([
    read("../components/SiteHeader.tsx"),
    read("../components/InterfaceLanguageMenu.tsx"),
    read("../components/LanguageCommunityChooser.tsx"),
    read("../app/[lang]/page.tsx"),
    read("../lib/smartlingo-language-communities.ts"),
    read("../app/globals.css"),
  ]);

  assert.match(header, /<InterfaceLanguageMenu lang=\{lang\}/);
  assert.doesNotMatch(header, /<LanguageLink/);
  assert.match(menu, /SMARTLINGO_LANGUAGE_COMMUNITIES\.map/);
  for (const name of ["中文", "English", "Español", "日本語", "한국어", "Français", "Deutsch", "Русский", "Italiano", "Português", "العربية", "हिन्दी"]) {
    assert.match(catalog, new RegExp(name));
  }
  for (const code of ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"]) {
    assert.match(catalog, new RegExp(`code: "${code}"`));
  }
  assert.match(menu, /中文与英文切换界面；其他选项设置目标学习语言/);
  assert.match(menu, /currentInterface.*language\.code === lang/s);
  assert.match(menu, /interface-language-current">\{currentInterface\.nativeName\}/);
  assert.doesNotMatch(menu, /interface-language-current">\{current\.nativeName\}/);
  assert.match(menu, /window\.location\.assign\(`\/\$\{lang\}#\$\{anchor\}`\)/);
  assert.doesNotMatch(`${header}\n${menu}`, /I speak|我会说|母语选择/iu);
  assert.doesNotMatch(`${menu}\n${chooser}\n${home}`, /[\u{1F1E6}-\u{1F1FF}]{2}/u);
  assert.doesNotMatch(`${menu}\n${chooser}\n${css}`, /interface-language-flag|lingo-community-flag/);
  assert.doesNotMatch(css, /\.interface-language-current\{display:none\}/);
});

test("the homepage language chooser gives all twelve communities a working join, placement, or enter path", async () => {
  const [home, chooser, css] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../components/LanguageCommunityChooser.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(home, /<LanguageCommunityChooser lang=\{lang\}/);
  assert.equal((chooser.match(/<h1/g) || []).length, 1);
  assert.equal((home.match(/<h1/g) || []).length, 0);
  assert.match(home, /<h2 data-layout-text-fit="home-hero-title">\{t\.title\}<\/h2>/);
  assert.match(chooser, /您想加入哪个语言学习社区/);
  assert.match(chooser, /已经会的语言继续提高/);
  assert.match(chooser, /joined \? "joined" : ""/);
  assert.match(chooser, /已加入 · 选择训练/);
  assert.match(chooser, /Joined · Choose training/);
  assert.match(chooser, /\/api\/classes\/\$\{encodeURIComponent\(available\.id\)\}\/enroll/);
  assert.match(chooser, /\/classes\/\$\{encodeURIComponent\(available\.id\)\}\/placement/);
  assert.match(chooser, /auth\/login\?returnTo=/);
  assert.match(chooser, /selectedLanguage/);
  assert.match(chooser, />Vocab</);
  assert.match(chooser, />Speaking</);
  assert.match(chooser, /training=\$\{training\}/);
  assert.match(chooser, /词卡 · 主动回忆 · 连续掌握/);
  assert.match(chooser, /人工智能导师 · 情景对话 · 即时反馈/);
  assert.match(css, /\.lingo-training-menu\{/);
  assert.match(css, /\.lingo-community-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:820px\)\{\.lingo-hero-shell/);
  assert.match(css, /\.lingo-community-chooser\{padding:44px 28px 60px\}/);
  assert.match(css, /\.lingo-community-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /@media\(max-width:560px\)\{\.lingo-brand-mark/);

  const layouts = new Map([390, 430, 834, 1194, 1440].map(width => [width, chooserMetrics(width)]));
  assert.deepEqual(
    [...layouts.values()].map(layout => layout.columns),
    [1, 1, 3, 3, 3],
  );
  for (const [width, layout] of layouts) {
    assert.ok(layout.container <= width, `${width}px chooser container must stay within the viewport`);
    assert.ok(layout.inner > 0 && layout.card > 0, `${width}px chooser tracks must remain usable`);
    assert.ok(layout.popover <= width - 28, `${width}px language menu must retain 14px side gutters`);
    assert.ok(
      Math.abs((layout.card * layout.columns) + (11 * (layout.columns - 1)) - layout.inner) < 0.01,
      `${width}px community cards must consume the complete inner panel without overflow`,
    );
  }
  assert.ok(layouts.get(390).card >= 350);
  assert.ok(layouts.get(430).card >= 390);
  assert.ok(layouts.get(834).card >= 240);
});

test("Classes is login-gated and separates joined, created, and available class tiles", async () => {
  const [page, detailPage, studio] = await Promise.all([
    read("../app/[lang]/classes/page.tsx"),
    read("../app/[lang]/classes/[classId]/page.tsx"),
    read("../components/ClassStudio.tsx"),
  ]);

  for (const source of [page, detailPage]) {
    assert.match(source, /requestUser\(\)/);
    assert.match(source, /redirect\(`\/\$\{lang\}\/auth\/login\?returnTo=/);
  }
  assert.match(page, /initialTargetLanguage=\{query\.target\}/);
  assert.match(studio, /context\.joinedClasses/);
  assert.match(studio, /context\.createdClasses/);
  assert.match(studio, /context\.availableClasses/);
  assert.match(studio, /我已加入的班级/);
  assert.match(studio, /我创建的班级/);
  assert.match(studio, /寻找下一个学习社区/);
  assert.match(studio, /免费加入社区/);
  assert.match(studio, /t\.joined/);
  assert.match(studio, /joinClass\(item\)/);
});
