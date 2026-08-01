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
  for (const language of ["中文", "英语", "西班牙语", "日语", "韩语", "法语", "俄语", "意大利语", "葡萄牙语"]) {
    assert.match(html, new RegExp(language));
  }
  assert.doesNotMatch(html, /德语/);
  for (const skill of ["听力", "口语", "阅读", "写作"]) assert.match(html, new RegExp(skill));
  assert.match(html, /创建语言班/);
  assert.match(html, /班主获得 70%/);
  assert.match(html, /首次付款可享一次 15% 优惠/);
  assert.match(html, /介绍人积分只来自平台订阅付款/);
  assert.match(html, /真实结账保持关闭/);
  assert.match(html, /社区/);
  assert.match(html, /\/zh\/community/);
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
    ["/zh/project", /项目进展/],
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
