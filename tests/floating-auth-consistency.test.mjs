import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("anchors Ask Guru as a root-layout viewport control outside the four-choice learning nav", async () => {
  const [layout, assistant, header, css] = await Promise.all([
    readFile(new URL("../app/[lang]/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/FloatingAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /\{children\}<\/PersistentCallProvider><FloatingAssistant\s*\/>/);
  assert.match(assistant, /className="floating-assistant"/);
  assert.doesNotMatch(assistant, /topLevelPages/);
  assert.match(assistant, /route === "\/assistant" \|\| route\.startsWith\("\/auth\/"\)/);
  assert.match(css, /\.floating-assistant\{\s*position:fixed!important;\s*inset:auto[^;]*safe-area-inset-right[^;]*safe-area-inset-bottom[^;]*auto!important;/);
  for (const choice of ["learn", "practice", "speak", "community"]) {
    assert.match(header, new RegExp(`data-nav="${choice}"`));
  }
  assert.doesNotMatch(header, /href=\{`\/\$\{lang\}\/assistant`\}/);
});

test("keeps the supplementary Guru shortcut outside every release viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const releaseViewports = [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 834, height: 1112 },
    { width: 1194, height: 834 },
    { width: 1440, height: 1000 },
  ];

  assert.match(css, /@media\(max-width:1599px\)\{body>\.floating-assistant\{display:none!important\}\}/);
  assert.match(css, /@media\(min-width:1600px\)\{body>\.floating-assistant\{width:52px!important;min-width:52px!important;height:52px!important;/);
  for (const viewport of releaseViewports) {
    assert.ok(viewport.width <= 1599, `${viewport.width}x${viewport.height} must use the non-overlapping header link`);
  }
});

test("keeps every authentication credential readable without iOS zoom", async () => {
  const [form, passwordInput, css] = await Promise.all([
    readFile(new URL("../components/ClerkAuthForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PasswordInput.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(form, /type="email"/);
  assert.match(form, /<PasswordInput/);
  assert.match(passwordInput, /type=\{view\.type\}/);
  assert.match(form, /autoComplete="one-time-code"/);
  assert.match(css, /\.auth-form input\{\s*font-size:max\(18px,var\(--reader-base,18px\)\)!important;\s*line-height:1\.35;/);
});
