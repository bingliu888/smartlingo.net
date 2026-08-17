import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Chinese shared controls and account notices remain localized", async () => {
  const [header, footer, language, account, assistant] = await Promise.all([
    source("components/SiteHeader.tsx"),
    source("components/SiteFooter.tsx"),
    source("components/LanguageMemory.tsx"),
    source("components/HeaderAccount.tsx"),
    source("components/FloatingAssistant.tsx"),
  ]);

  assert.match(header, /SmartLingo 首页/);
  assert.match(header, /主导航/);
  for (const label of ["选择课程", "咨询专家"]) assert.match(header, new RegExp(label));
  assert.match(footer, /页脚导航/);
  assert.match(footer, /从第一天开口 · 人工智能导师 · 会员开班 · 一起学习/);
  assert.match(language, /切换为英文/);
  assert.match(account, /条未读消息/);
  assert.match(assistant, /打开智能助手/);
});

test("Chinese public, dashboard, Project, and legal copy uses language-learning terms", async () => {
  const [status, roadmap, editorial, members, membership, dashboard, project, privacy, terms] = await Promise.all([
    source("lib/project-status.ts"),
    source("lib/smartlingo-roadmap.ts"),
    source("lib/editorial-content.ts"),
    source("components/MembersDirectory.tsx"),
    source("components/MembershipPanel.tsx"),
    source("app/[lang]/dashboard/page.tsx"),
    source("components/ProjectDashboard.tsx"),
    source("app/[lang]/privacy/page.tsx"),
    source("app/[lang]/terms/page.tsx"),
  ]);
  const joined = [status, roadmap, editorial, members, membership, dashboard, project, privacy, terms].join("\n");

  assert.match(editorial, /七种语言/);
  assert.match(editorial, /会员共建/);
  assert.match(editorial, /班级分账与介绍人积分严格分开/);
  assert.match(members, /消息与实时聊天/);
  assert.match(membership, /免费方案/);
  assert.match(membership, /平台订阅推荐/);
  assert.match(dashboard, /实时智能语音对话/);
  assert.match(project, /二十天交付节奏/);
  assert.match(privacy, /语音与人工智能训练/);
  assert.match(terms, /会员自主开班/);
  assert.doesNotMatch(joined, /人工智能实操班|BACC|黄金会员|铂金会员|开班授权码|SmartAICert/);
});

test("necessary product and infrastructure names stay intact", async () => {
  const [auth, profile, roadmap, pricing] = await Promise.all([
    source("components/ClerkAuthForm.tsx"),
    source("components/ProfileEditor.tsx"),
    source("lib/smartlingo-roadmap.ts"),
    source("app/[lang]/pricing/page.tsx"),
  ]);

  assert.match(auth, /Clerk/);
  assert.match(profile, /EVM 钱包/);
  assert.match(roadmap, /GitHub/);
  assert.match(roadmap, /Sites/);
  assert.match(pricing, /Stripe Connect/);
});

test("Chinese class, pricing, programs, and retired Admin UI are truthful", async () => {
  const [classes, pricing, programs, adminPage, adminApi, auth] = await Promise.all([
    source("components/ClassStudio.tsx"),
    source("app/[lang]/pricing/page.tsx"),
    source("app/[lang]/programs/page.tsx"),
    source("app/[lang]/admin/classes/page.tsx"),
    source("app/api/admin/classes/route.ts"),
    source("app/[lang]/auth/[mode]/page.tsx"),
  ]);

  for (const label of ["教师", "协调员", "创建私有班级", "同一学员首次支付本班费用可享受八五折", "班级付款永不产生介绍人积分"]) assert.match(classes, new RegExp(label));
  assert.match(pricing, /免费方案/);
  assert.match(pricing, /进阶方案/);
  assert.match(pricing, /协调员方案/);
  assert.match(pricing, /本页面不会发起真实收费/);
  assert.match(programs, /词汇 · 阅读 · 写作 · 听力 · 对话/);
  assert.match(programs, /任何已登录会员都可以准备私有班级/);
  assert.match(adminPage, /notFound\(\)/);
  assert.match(adminApi, /status: 410/);
  assert.match(auth, /lingo-brand-mark/);
  assert.match(auth, /词汇阅读写作听力对话 · 会员开班 · 学习社区/);
  assert.doesNotMatch(`${classes}\n${pricing}\n${programs}`, /黄金|铂金|授权码|BACC|PayPal/);
});

test("every Chinese route inherits localized language-learning metadata", async () => {
  const [layout, home, programs, project] = await Promise.all([
    source("app/[lang]/layout.tsx"),
    source("app/[lang]/page.tsx"),
    source("app/[lang]/programs/page.tsx"),
    source("app/[lang]/project/page.tsx"),
  ]);

  assert.match(layout, /generateMetadata/);
  assert.match(layout, /SmartLingo — 从第一天开口，与班级一起进步/);
  assert.match(layout, /template: "%s \| SmartLingo"/);
  assert.match(home, /metaTitle: "SmartLingo — 从第一天开口"/);
  assert.match(programs, /lang === "zh" \? "语言学习路径" : "Language learning paths"/);
  assert.match(project, /lang === "zh" \? "项目进展" : "Project progress"/);
  assert.doesNotMatch(`${layout}\n${home}\n${programs}`, /人工智能实操学习与会员开班|21 天学会/);
});
