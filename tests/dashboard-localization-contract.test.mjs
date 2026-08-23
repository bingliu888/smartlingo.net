import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every dashboard locale uses prebuilt interface copy and preserves user-authored values", async () => {
  const [dashboard, layout, runtime, dictionary] = await Promise.all([
    read("app/[lang]/dashboard/page.tsx"), read("app/[lang]/layout.tsx"),
    read("components/LocaleRuntime.tsx"), read("lib/home-interface-translations.generated.ts"),
  ]);
  assert.match(dashboard, /translateHomeCopy\(copy\.en, locale, homeInterfaceTranslations\)/);
  assert.match(dashboard, /<SiteHeader lang=\{locale\} \/>/);
  assert.match(dashboard, /data-no-translate>\{user\.email\}/);
  assert.match(await read("components/DashboardDailySprint.tsx"), /text\("Start", "开始"\).*text\("minutes", "分钟"\)/);
  assert.match(layout, /<LocaleRuntime locale=\{safeLanguage\}/);
  assert.match(runtime, /script,style,textarea/);
  assert.match(runtime, /attributeNames = \["aria-label", "title", "placeholder", "alt"\]/);
  assert.doesNotMatch(runtime, /\.value\s*=/);
  for (const locale of ["ja", "ko", "es", "fr", "de", "ru", "it", "pt", "ar", "hi"]) {
    assert.match(dictionary, new RegExp(`"${locale}": \\{`));
  }
  assert.match(dictionary, /"Welcome to your member dashboard"/);
  assert.match(dictionary, /"Today’s Sprint"/);
  assert.match(dictionary, /"Site-wide text size"/);
});
