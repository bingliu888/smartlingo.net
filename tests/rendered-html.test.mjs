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
  assert.match(html, /两种学习方式，从一门语言开始/);
  assert.match(html, /适合休闲学习者/);
  assert.match(html, /适合认真学习者/);
  assert.match(html, /href="\/zh\/flash"/);
  assert.match(html, /href="\/zh\/max"/);
  assert.match(html, /href="\/zh\/assistant"/);
  assert.match(html, /href="\/zh\/tutorial"/);
  assert.doesNotMatch(html, /九个套餐|30 \/ 50 \/ 80|60 \/ 100 \/ 160|120 \/ 200 \/ 320|课程套餐/);
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
    ["/zh", /两种学习方式，从一门语言开始/],
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

test("anonymous Play renders six activities without reusing a target language", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `play-all-tiles-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  for (const [pathname, language, labels] of [
    ["/zh/play", "zh", ["今日速成", "智慧卡练习", "智慧卡挑战", "兑换", "免费试学", "排行榜"]],
    ["/en/play", "en", ["Today’s Sprint", "Smart Card Practice", "Smart Card Challenge", "Redeem", "Free Trial", "Rankings"]],
  ]) {
    const response = await worker.fetch(
      new Request(`http://localhost${pathname}`, { headers: { accept: "*/*" } }),
      testEnv,
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    for (const label of labels) assert.match(html, new RegExp(label), `${pathname}: ${label}`);
    assert.match(html, new RegExp(`href="\\/${language}\\/smartcards"`));
    assert.match(html, new RegExp(`href="\\/${language}\\/play\\/redeem"`));
    assert.match(html, /class="game-tile free-trial-tile"/);
    assert.doesNotMatch(html, new RegExp(`href="\\/${language}\\/programs\\/${language}\\/trial"`));
  }
});

test("renders the bilingual Clerk login shell with inert bindings", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `clerk-login-shell-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const expected = new Map([
    ["/zh/auth/login", ["登录或加入", "电子邮箱", "使用密码继续", "改用邮箱验证码"]],
    ["/en/auth/login", ["Sign in or join", "Email address", "Continue with password", "Use an email code instead"]],
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
