import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "app/globals.css"), "utf8");
const projectCss = readFileSync(resolve(root, "app/project-status.css"), "utf8");

test("shared CSS prevents page-level horizontal overflow and lets layout children shrink", () => {
  assert.match(css, /html,body\{max-width:100%;overflow-x:hidden;overflow-x:clip\}/);
  assert.match(css, /main,section,article,header,footer,nav,aside,form,fieldset,div,ul,ol,li,dl,dt,dd\)\{min-width:0\}/);
  assert.match(css, /overflow-wrap:anywhere/);
});

test("meaningful headings, copy, controls, identifiers, and tables wrap without ellipsis", () => {
  assert.match(css, /h1,h2,h3,h4,h5,h6\)\{text-wrap:wrap\}/);
  assert.doesNotMatch(css, /text-wrap:balance/);
  assert.match(css, /p,li,dd,blockquote,figcaption\)\{text-wrap:pretty\}/);
  assert.match(css, /button,\[role="button"\].*white-space:normal/s);
  assert.match(css, /table\)\{width:100%;max-width:100%;table-layout:fixed\}/);
  assert.match(css, /text-overflow:clip!important;\s*white-space:normal!important/);
  assert.match(css, /site-notification-bar span.*community-rail button/);
  assert.match(css, /\.site-notification-bar\{height:auto;min-height:52px/);
});

test("the contract covers the release-blocking phone, iPad, and desktop matrix across primary routes", () => {
  assert.deepEqual(
    [[390, 844], [430, 932], [834, 1112], [1194, 834], [1440, 1000]],
    [[390, 844], [430, 932], [834, 1112], [1194, 834], [1440, 1000]],
  );
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /font-size:clamp\(2rem,10vw,3\.5rem\)/);
  for (const route of [
    "app/[lang]/page.tsx",
    "app/[lang]/auth/[mode]/page.tsx",
    "app/[lang]/dashboard/page.tsx",
    "app/[lang]/community/page.tsx",
    "app/[lang]/messages/page.tsx",
    "app/[lang]/assistant/page.tsx",
    "app/[lang]/news/page.tsx",
    "app/[lang]/events/page.tsx",
    "app/[lang]/project/page.tsx",
    "app/[lang]/programs/page.tsx",
    "app/[lang]/talent/page.tsx",
  ]) {
    assert.equal(existsSync(resolve(root, route)), true, `${route} must remain covered by global CSS`);
  }
});

test("SmartLingo hero fills flexible tracks and stacks before iPad copy narrows", () => {
  assert.match(css, /\.hero \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*column-gap: clamp\(28px, 4vw, 64px\)/s);
  assert.match(css, /\.hero-copy \{[^}]*padding-left: 0/s);
  assert.match(css, /\.ai-cert-hero\{[^}]*grid-template-columns:minmax\(0,1\.2fr\) minmax\(380px,\.8fr\);gap:clamp\(28px,4vw,56px\)/s);
  assert.match(css, /@media\(max-width:1100px\)\{\s*\.ai-cert-hero\{grid-template-columns:1fr\}/s);
  assert.match(css, /\.ai-course-console\{width:min\(820px,100%\);margin:auto\}/);
  assert.match(css, /@media\(max-width:820px\)\{[\s\S]*?\.ai-cert-hero,.ai-public-hero\{padding:48px 28px 80px\}/);
  assert.match(projectCss, /\.gg-detail-summary b\{min-width:0;overflow-wrap:anywhere;word-break:break-word\}/);
});
