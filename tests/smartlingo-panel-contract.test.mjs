import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function heroMetrics(viewport) {
  const container = Math.min(viewport, 1420);
  const inlinePadding = viewport <= 560 ? 20 : viewport <= 820 ? 28 : Math.max(24, Math.min(64, viewport * 0.044));
  const inner = container - (inlinePadding * 2);

  if (viewport <= 1080) {
    const panel = Math.min(800, inner);
    return { columns: 1, container, inner, copy: inner, panel, gap: 0 };
  }

  const gap = Math.min(90, Math.max(32, viewport * 0.06));
  const tracks = inner - gap;
  const preferredPanel = tracks * (0.94 / 2);
  const panel = Math.max(360, preferredPanel);
  const copy = tracks - panel;
  return { columns: 2, container, inner, copy, panel, gap };
}

test("390/430/834/1194/1440 hero panels use their available width without horizontal spill", async () => {
  const css = await read("../app/globals.css");

  assert.match(
    css,
    /\.lingo-hero\{width:min\(1420px,100%\);[^}]*padding:66px clamp\(24px,4\.4vw,64px\) 86px;[^}]*grid-template-columns:minmax\(0,1\.06fr\) minmax\(360px,\.94fr\);gap:clamp\(32px,6vw,90px\)/,
  );
  assert.match(
    css,
    /@media\(max-width:1080px\)\{\.lingo-hero\{grid-template-columns:1fr\}\.lingo-hero-visual\{width:min\(800px,100%\);margin:0 auto 66px\}/,
  );
  assert.match(css, /@media\(max-width:820px\)\{\.lingo-hero-shell \.mobile-menu>div\{[^}]+\}/);
  assert.match(css, /\.lingo-hero\{padding:48px 28px 76px\}/);
  assert.match(css, /@media\(max-width:560px\)\{\.lingo-brand-mark\{[^}]+\}/);
  assert.match(css, /\.lingo-hero\{padding:38px 20px 66px\}/);

  const layouts = new Map([390, 430, 834, 1194, 1440].map((width) => [width, heroMetrics(width)]));
  assert.equal(layouts.get(390).columns, 1);
  assert.equal(layouts.get(430).columns, 1);
  assert.equal(layouts.get(834).columns, 1);
  assert.equal(layouts.get(1194).columns, 2);
  assert.equal(layouts.get(1440).columns, 2);

  for (const [width, layout] of layouts) {
    assert.ok(layout.container <= width, `${width}px container must stay inside the viewport`);
    assert.ok(layout.inner > 0 && layout.copy > 0 && layout.panel > 0, `${width}px tracks must remain usable`);
    if (layout.columns === 1) {
      assert.equal(layout.copy, layout.inner, `${width}px stacked copy should fill the inner panel`);
      assert.ok(layout.panel <= layout.inner, `${width}px stacked preview must stay inside the inner panel`);
    } else {
      assert.ok(
        Math.abs(layout.copy + layout.panel + layout.gap - layout.inner) < 0.01,
        `${width}px tracks and gap must consume the complete inner panel`,
      );
    }
  }

  assert.ok(layouts.get(390).panel >= 350, "phone preview panel should fill the 350px content area");
  assert.ok(layouts.get(430).panel >= 390, "large-phone preview panel should fill the 390px content area");
  assert.ok(layouts.get(834).panel >= 720, "iPad portrait preview panel should use essentially all content width");
  assert.ok(layouts.get(1194).copy >= 500, "iPad landscape copy needs enough width to avoid a one-character H1 line");
  assert.ok(layouts.get(1194).panel >= 360, "iPad landscape preview must retain a readable panel");
  assert.ok(layouts.get(1440).copy >= 590, "desktop copy should use the primary share of the hero");
  assert.ok(layouts.get(1440).panel >= 500, "desktop preview should remain substantial");
});

test("hero text containment is source-stable and headings remain free to wrap naturally", async () => {
  const [css, home] = await Promise.all([
    read("../app/globals.css"),
    read("../app/[lang]/page.tsx"),
  ]);

  assert.match(css, /html,body\{max-width:100%;overflow-x:hidden;overflow-x:clip\}/);
  assert.match(css, /:where\(main,section,article,header,footer,nav,aside,form,fieldset,div,ul,ol,li,dl,dt,dd\)\{min-width:0\}/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /\.lingo-hero-copy h2\{[^}]*text-wrap:wrap;overflow-wrap:anywhere;word-break:normal\}/);
  assert.match(css, /\.lingo-heading h2,[^}]*text-wrap:wrap;overflow-wrap:anywhere;word-break:normal/);
  assert.doesNotMatch(css, /\.lingo-hero-copy h2\{[^}]*white-space:nowrap/);
  assert.match(home, /title: "从第一天开始，开口说一门新语言。"/);
  assert.match(home, /<h2>\{t\.title\}<\/h2>/);
});
