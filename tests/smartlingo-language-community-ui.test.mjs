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

test("home and Choose course route languages through a separate detail page or an existing course", async () => {
  const [home, chooser, planner, programs, detail, css] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../components/LanguageCommunityChooser.tsx"),
    read("../components/LearningPathPlanner.tsx"),
    read("../app/[lang]/programs/page.tsx"),
    read("../app/[lang]/programs/[language]/page.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(home, /<LanguageCommunityChooser lang=\{lang\}/);
  assert.equal((chooser.match(/<h1/g) || []).length, 1);
  assert.equal((home.match(/<h1/g) || []).length, 0);
  assert.match(home, /<h2 data-layout-text-fit="home-hero-title">\{t\.title\}<\/h2>/);
  assert.match(chooser, /您想学习哪种语言/);
  assert.match(chooser, /下一页会显示课程详情与学习选项/);
  assert.match(chooser, /joined \? "joined" : ""/);
  assert.match(chooser, /已加入 · 进入课程/);
  assert.match(chooser, /Joined · Open course/);
  assert.match(chooser, /\/programs\/\$\{encodeURIComponent\(code\)\}/);
  assert.doesNotMatch(chooser, /\/enroll|\/placement|auth\/login\?returnTo=/);
  assert.match(chooser, /openLanguage/);
  assert.match(programs, /<LearningPathPlanner lang=\{lang\} catalogOnly\/>/);
  assert.match(planner, /openCatalogLanguage/);
  assert.match(planner, /joined[\s\S]*?\/classes\/\$\{encodeURIComponent\(joined\.id\)\}/);
  assert.match(planner, /\/programs\/\$\{encodeURIComponent\(language\)\}/);
  assert.match(detail, /SMARTLINGO_COURSE_PACKAGES/);
  assert.match(detail, /首月免费/);
  assert.match(detail, /fixedCourseId\(language, course\.tier\)/);
  assert.doesNotMatch(chooser, /selectedLanguage|lingo-training-menu|>Vocab<|>Speaking</);
  assert.doesNotMatch(css, /\.lingo-training-menu\{/);
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

test("Courses is login-gated and separates joined from available fixed plans", async () => {
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
  assert.match(studio, /context\.availableClasses/);
  assert.match(studio, /我的课程/);
  assert.match(studio, /可订阅课程/);
  assert.match(studio, /开始免费首月/);
  assert.doesNotMatch(studio, /我创建的班级|创建私有班级/);
  assert.match(studio, /t\.joined/);
  assert.match(studio, /subscribe\(item\)/);
});
