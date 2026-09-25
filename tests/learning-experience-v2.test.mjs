import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Flash and Max keep separate language entry state without a new database table", async () => {
  const [flash, max, tiles, dashboard, hub] = await Promise.all([
    source("app/[lang]/flash/page.tsx"), source("app/[lang]/max/page.tsx"),
    source("components/LearningLanguageTiles.tsx"), source("app/[lang]/dashboard/page.tsx"),
    source("app/[lang]/programs/[language]/page.tsx"),
  ]);
  assert.doesNotMatch(flash, /ensureSevenDayMaxTrial|redirect\(/);
  assert.match(flash, /path="flash"/);
  assert.match(tiles, /smartlingo-flash-languages-v1/);
  assert.match(tiles, /signedIn\) \{/);
  assert.match(tiles, /\/api\/learning-plan/);
  assert.match(max, /redirect\(`\/\$\{lang\}\/auth\/login\?returnTo=/);
  assert.match(max, /await ensureSevenDayMaxTrial\(user\.id\)/);
  assert.match(max, /if \(!admin\) await ensureSevenDayMaxTrial\(user\.id\)/);
  assert.match(dashboard, /const active = admin \|\|/);
  assert.match(dashboard, /path="max" initialLanguages=\{languages\} signedIn/);
  assert.match(dashboard, /path="flash"/);
  assert.match(hub, /path === "max" && user/);
  assert.match(hub, /CourseClassroomTile/);
  assert.match(hub, /play\/everyday\?language=\$\{language\}/);
  assert.match(hub, /assistant\/role-tutor\?language=\$\{language\}/);
  assert.match(await source("lib/learning-language-codes.ts"), /SMARTLINGO_LANGUAGE_COMMUNITIES\.filter\(item => saved\.has\(item\.code\)\)/);
});

test("public Flash and language hub render, while anonymous Max requires sign-in", async () => {
  const inertDomain = Buffer.from("test.clerk.accounts.invalid$").toString("base64");
  const publishableKey = ["pk", "test", inertDomain].join("_");
  const previous = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const previousSecret = process.env.CLERK_SECRET_KEY;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;
  process.env.CLERK_SECRET_KEY = ["sk", "test", inertDomain].join("_");
  try {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("learning-experience", `${process.pid}-${Date.now()}`);
    const { default: worker } = await import(workerUrl.href);
    const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey };
    const ctx = { waitUntil() {}, passThroughOnException() {} };
    const load = path => worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "*/*" } }), env, ctx);
    const flash = await load("/zh/flash");
    assert.equal(flash.status, 200);
    assert.match(await flash.text(), /无需登录即可开始/);
    const hub = await load("/zh/programs/ja?path=flash");
    assert.equal(hub.status, 200);
    assert.match(await hub.text(), /日本語/);
    for (const path of ["/zh/max", "/zh/programs/ja?path=max"]) {
      const response = await load(path);
      assert.ok([302, 303, 307, 308].includes(response.status), `${path}: ${response.status}`);
      assert.match(response.headers.get("location") ?? "", /\/zh\/auth\/login/);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previous;
    if (previousSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previousSecret;
  }
});

test("Guru FAQ list icon visually replaces the legacy question mark", async () => {
  const css = await source("app/[lang]/assistant/composer-bottom.css");
  const client = await source("components/AssistantClient.tsx");
  assert.match(css, /\.assistant-page \.faq-button\{[^}]*color:transparent!important/);
  assert.match(css, /\.assistant-page \.faq-button::after\{[^}]*content:"☰";[^}]*position:absolute/);
  assert.match(client, /第一次学一门语言，选 Flash 还是 Max/);
  assert.match(client, /Should a new learner choose Flash or Max/);
  assert.doesNotMatch(client, /我应该从哪个职业英语阶段开始/);
});

test("public Guru explains the current Flash and Max paths without legacy Free-plan advice", async () => {
  const route = await source("app/api/assistant/route.ts");
  assert.match(route, /Flash is free, playful, casual practice/);
  assert.match(route, /Flash is the name of the free learning path, not a synonym for flashcards/);
  assert.match(route, /Signing in and explicitly entering Max starts a one-time seven-day trial/);
  assert.doesNotMatch(route, /Free is ad-supported/);
});
