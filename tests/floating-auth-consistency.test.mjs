import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("anchors Ask Guru as a root-layout viewport control", async () => {
  const [layout, assistant, css] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/FloatingAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /\{children\}<FloatingAssistant\s*\/>/);
  assert.match(assistant, /className="floating-assistant"/);
  assert.doesNotMatch(assistant, /topLevelPages/);
  assert.match(assistant, /route === "\/assistant" \|\| route\.startsWith\("\/auth\/"\)/);
  assert.match(css, /\.floating-assistant\{\s*position:fixed!important;\s*inset:auto[^;]*safe-area-inset-right[^;]*safe-area-inset-bottom[^;]*auto!important;/);
});

test("keeps every authentication credential readable without iOS zoom", async () => {
  const [form, css] = await Promise.all([
    readFile(new URL("../components/ClerkAuthForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(form, /type="email"/);
  assert.match(form, /type="password"/);
  assert.match(form, /autoComplete="one-time-code"/);
  assert.match(css, /\.auth-form input\{\s*font-size:max\(18px,var\(--reader-base,18px\)\)!important;\s*line-height:1\.35;/);
});
