import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const home = readFileSync("app/[lang]/page.tsx", "utf8");
const page = readFileSync("app/[lang]/tutorial/page.tsx", "utf8");
const copy = readFileSync("lib/smartlingo-tutorial.ts", "utf8");
const css = readFileSync("app/[lang]/tutorial/tutorial.css", "utf8");

test("home hero exposes a localized first-time tutorial action", () => {
  assert.match(home, /smartLingoTutorialCopyFor\(locale\)/);
  assert.match(home, /href=\{`\/\$\{locale\}\/tutorial`\}/);
  assert.match(home, /className="lingo-tour-spotlight"/);
  assert.match(home, /tutorial\.homeAction/);
  assert.match(home, /tutorial\.duration/);
});

test("tutorial player is public, accessible, captioned, and not autoplaying", () => {
  assert.match(page, /<video[\s\S]*controls[\s\S]*playsInline[\s\S]*preload="metadata"/);
  assert.match(page, /poster=\{media\.poster\}/);
  assert.match(page, /<source src=\{media\.video\} type="video\/mp4"\/>/);
  assert.match(page, /kind="captions"/);
  assert.match(page, /src=\{media\.captions\}/);
  assert.match(page, /srcLang=\{media\.narrationLanguage\}/);
  assert.doesNotMatch(page, /autoplay|autoPlay/);
  assert.doesNotMatch(page, /requestUser|auth\(/);
});

test("Chinese selects Chinese media and every other site locale selects English", () => {
  assert.match(copy, /const narrationLanguage = language === "zh" \? "zh" : "en"/);
  assert.match(copy, /smartlingo-first-time-tour-\$\{narrationLanguage\}\.mp4/);
  for (const locale of ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"]) {
    assert.match(copy, new RegExp(`\\n  ${locale}(?::|,)`), `missing tutorial UI copy for ${locale}`);
  }
});

test("both ten-minute tutorial deliverables include video, audio contract, poster, and captions", () => {
  for (const locale of ["zh", "en"]) {
    const base = `public/tutorials/smartlingo-first-time-tour-${locale}`;
    const mp4 = readFileSync(`${base}.mp4`);
    assert.ok(statSync(`${base}.mp4`).size > 4_000_000, `${locale} video is unexpectedly small`);
    assert.equal(mp4.subarray(4, 8).toString("ascii"), "ftyp", `${locale} is not an MP4`);
    assert.match(mp4.toString("latin1"), /avc1/, `${locale} is missing H.264 video`);
    assert.match(mp4.toString("latin1"), /mp4a/, `${locale} is missing AAC narration audio`);
    assert.ok(statSync(`${base}-poster.png`).size > 300_000, `${locale} poster is unexpectedly small`);
    const captions = readFileSync(`${base}.vtt`, "utf8");
    assert.match(captions, /^WEBVTT/);
    assert.equal((captions.match(/-->/g) ?? []).length, 25);
    const finalCue = [...captions.matchAll(/--> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/g)].at(-1);
    assert.ok(finalCue);
    const finalSeconds = Number(finalCue[1]) * 3600 + Number(finalCue[2]) * 60 + Number(finalCue[3]) + Number(finalCue[4]) / 1000;
    assert.ok(finalSeconds >= 600 && finalSeconds <= 720, `${locale} tour must remain about ten minutes`);
  }
});

test("tutorial layout keeps the video responsive from phone to desktop", () => {
  assert.match(css, /\.tutorial-video-frame video\{[^}]*width:100%[^}]*aspect-ratio:16\/9/);
  assert.match(css, /@media\(max-width:920px\)/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /\.tutorial-assurance\{[^}]*grid-template-columns:1fr 1fr/);
});
