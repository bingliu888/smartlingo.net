import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("reader scale defaults to 16/14 and preserves both enlargement modes", async () => {
  const css = await read("../app/readability.css");

  assert.match(
    css,
    /:root\{--reader-base:16px;--reader-small:14px;--reader-muted:#405159\}/,
  );
  assert.match(
    css,
    /:root\[data-text-size="large"\]\{--reader-base:18px;--reader-small:16px\}/,
  );
  assert.match(
    css,
    /:root\[data-text-size="extra-large"\]\{--reader-base:20px;--reader-small:18px\}/,
  );
  assert.match(css, /font-size:var\(--reader-base\)!important/);
  assert.match(css, /font-size:var\(--reader-small\)!important/);
});

test("SmartLingo primary surfaces use the restrained heading scale", async () => {
  const css = await read("../app/globals.css");
  const scale = css.slice(css.indexOf("/* SmartLingo public product system"));

  assert.ok(scale.length > 0, "SmartLingo public typography must be present");
  assert.match(scale, /\.ai-cert-hero-copy h1\{[\s\S]*?clamp\(46px,5\.4vw,74px\)/);
  assert.match(scale, /\.ai-public-hero h1\{[\s\S]*?clamp\(44px,5\.5vw,70px\)/);
  assert.match(scale, /\.ai-cert-heading h2,[\s\S]*?clamp\(34px,4\.2vw,54px\)/);
  assert.match(scale, /\.ai-cert-legal-main>h1\{[\s\S]*?clamp\(38px,4\.7vw,58px\)/);
});

test("iPad and phone breakpoints cap oversized page titles", async () => {
  const css = await read("../app/globals.css");
  const scale = css.slice(css.indexOf("/* SmartLingo public product system"));
  const tablet = scale.match(/@media\(max-width:820px\)\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const phone = scale.match(/@media\(max-width:580px\)\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(tablet, /\.ai-cert-hero,.ai-public-hero\{padding:48px 28px 80px\}/);
  assert.match(tablet, /\.ai-cert-legal-main\{padding:64px 28px 82px\}/);
  assert.match(phone, /\.ai-cert-hero-copy h1,.ai-public-hero h1\{font-size:40px\}/);
  assert.match(phone, /\.ai-cert-legal-main>h1\{font-size:38px\}/);
});
