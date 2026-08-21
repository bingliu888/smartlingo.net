import assert from "node:assert/strict";
import test from "node:test";

const previousClerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const previousClerkSecretKey = process.env.CLERK_SECRET_KEY;
const inertClerkDomain = Buffer.from("test.clerk.accounts.invalid$").toString("base64");
const clerkPublishableKey = ["pk", "test", inertClerkDomain].join("_");
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkPublishableKey;
process.env.CLERK_SECRET_KEY = ["sk", "test", inertClerkDomain].join("_");
test.after(() => {
  if (previousClerkPublishableKey === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previousClerkPublishableKey;
  if (previousClerkSecretKey === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = previousClerkSecretKey;
});

const testEnv = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
};

test("renders the SmartLingo language-learning foundation", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/zh", {
      headers: {
        // A direct Worker render is not a browser navigation. Using */* keeps
        // Clerk's development-instance browser handshake out of this unit test.
        accept: "*/*",
      },
    }),
    testEnv,
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /SmartLingo/);
  assert.match(html, /从第一天开始，开口说一门新语言/);
  for (const language of ["中文", "English", "Español", "日本語", "한국어", "Français", "Deutsch", "Русский", "Italiano", "Português", "العربية", "हिन्दी"]) {
    assert.match(html, new RegExp(language));
  }
  for (const skill of ["词汇", "阅读", "写作", "听力", "对话"]) assert.match(html, new RegExp(skill));
  assert.match(html, /三级课程/);
  assert.match(html, /初期 · 每月 20 美元/);
  assert.match(html, /高级 · 每月 300 美元/);
  assert.match(html, /三类积分独立记账、可追溯/);
  assert.match(html, /SmartCard 挑战积分只能抵 SmartLingo 课程月费/);
  assert.match(html, /第一个月免费/);
  assert.match(html, /href="\/zh\/programs"[^>]*>立即行动(?:<!-- -->)? →<\/a>/);
  assert.match(html, /社区/);
  assert.doesNotMatch(html, /href="\/zh\/community"/);
  assert.match(html, />选择课程<\/a>/);
  assert.match(html, />生活口语<\/a>/);
  assert.match(html, />边玩边学<\/a>/);
  assert.match(html, />咨询AI<\/a>/);
  assert.match(html, /\/zh\/project/);
  assert.match(html, />项目</);
  assert.match(html, /消息与实时聊天/);
  assert.match(html, /人工智能导师与实时语音/);
  assert.doesNotMatch(html, /SmartCert\.pro|smartcert\.pro|SmartAICert|21 天人工智能实操|BACC|黄金会员|铂金会员/);
  assert.doesNotMatch(html, /SmartSAT|SmartNCT|GreatLove|大爱元宇宙|BingAcademy/);
  assert.doesNotMatch(html, /CatMe|GameFi|DeFi|SocialFi/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("renders localized, non-duplicated titles across public routes", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `localized-titles-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const expected = new Map([
    ["/zh", /SmartLingo — 从第一天开口/],
    ["/zh/programs", /语言学习路径/],
    ["/zh/auth/login", /登录或加入/],
  ]);

  for (const [pathname, expectedTitle] of expected) {
    const response = await worker.fetch(
      new Request(`http://localhost${pathname}`, { headers: { accept: "*/*" } }),
      testEnv,
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    assert.match(title ?? "", expectedTitle, pathname);
    assert.doesNotMatch(title, /SmartLingo\s*\|\s*SmartLingo/);
    assert.doesNotMatch(title, /SmartAICert|21 天人工智能实操/);
  }

  const project = await worker.fetch(
    new Request("http://localhost/zh/project", { headers: { accept: "*/*" } }),
    testEnv,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(project.status, 307, "/zh/project is administrator-only");
  assert.match(project.headers.get("location") ?? "", /\/zh\/auth\/login/);
});

test("Play defaults to the interface language and renders every activity tile", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `play-all-tiles-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  for (const [pathname, language, labels] of [
    ["/zh/play", "zh", ["今日速成", "智慧卡练习", "智慧卡挑战", "免费试学", "排行榜", "兑换中心"]],
    ["/en/play", "en", ["Today’s Sprint", "Smart Card Practice", "Smart Card Challenge", "Free Trial", "Rankings", "Redeem"]],
  ]) {
    const response = await worker.fetch(
      new Request(`http://localhost${pathname}`, { headers: { accept: "*/*" } }),
      testEnv,
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    for (const label of labels) assert.match(html, new RegExp(label), `${pathname}: ${label}`);
    assert.match(html, new RegExp(`href="\\/${language}\\/play\\?language=${language}"`));
    assert.match(html, new RegExp(`href="\\/${language}\\/smartcards\\/starter-${language}"`));
    assert.match(html, new RegExp(`href="\\/${language}\\/programs\\/${language}\\/trial"`));
  }
});

test("renders the bilingual Clerk login shell with inert bindings", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `clerk-login-shell-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const expected = new Map([
    ["/zh/auth/login", ["登录或加入", "电子邮箱", "发送安全验证码", "改用密码"]],
    ["/en/auth/login", ["Sign in or join", "Email address", "Send secure code", "Use password instead"]],
  ]);

  for (const [pathname, copy] of expected) {
    const response = await worker.fetch(
      new Request(`http://localhost${pathname}`, { headers: { accept: "*/*" } }),
      testEnv,
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    for (const text of copy) assert.match(html, new RegExp(text), `${pathname}: ${text}`);
    assert.match(html, /id="clerk-captcha"/);
    assert.doesNotMatch(html, /Internal Server Error|Application error/i);
  }
});

test("renders Ask Guru when a stale legacy session cookie is present", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `assistant-stale-cookie-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/en/assistant", {
      headers: {
        // A direct Worker render is not a browser navigation. Using */* keeps
        // Clerk's development-instance browser handshake out of this unit test.
        accept: "*/*",
        cookie: "smartlingo_session=stale-session-token",
      },
    }),
    testEnv,
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Message Guru/);
  assert.doesNotMatch(html, /Internal Server Error|Application error/i);
});
