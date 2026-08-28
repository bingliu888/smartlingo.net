import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("signed-in account menu keeps the simplified member navigation", async () => {
  const source = await read("components/HeaderAccount.tsx");

  for (const label of ["用户面板", "个人资料", "我的课程", "消息", "选择课程"]) assert.match(source, new RegExp(label));
  for (const label of ["Dashboard", "Profile", "My Courses", "Messages", "Choose course"]) assert.match(source, new RegExp(label));
  assert.match(source, /\/classes\?mine=1/);
  assert.doesNotMatch(source, /\/classrooms\?view=mine|My Classrooms|\/community/);
  assert.doesNotMatch(source, /职业档案|人才库|Gold|Platinum|黄金|铂金|BACC|license/i);
});

test("dashboard keeps learning, referrals, and built-in course access", async () => {
  const [dashboard, panel] = await Promise.all([
    read("app/[lang]/dashboard/page.tsx"),
    read("components/MembershipPanel.tsx"),
  ]);
  const joined = `${dashboard}\n${panel}`;

  for (const label of ["免费方案", "进阶方案"]) assert.match(joined, new RegExp(label));
  assert.match(panel, /打开我的课程/);
  assert.doesNotMatch(joined, /每位会员都能开班|免费学习，也可以带领自己的语言班|不开启开班资格门槛/);
  assert.match(panel, /介绍人积分只在平台成功收取订阅费后产生/);
  assert.match(panel, /课程购买、班主收款、Stripe Connect 转账、退款、争议和打赏一律不产生介绍人积分/);
  assert.match(dashboard, /DashboardLearningHub/);
  assert.doesNotMatch(joined, /白银会员|黄金会员|铂金会员|BACC|授权码|license key/i);
});

test("profile and member directory keep shared avatar, message, and platform-introducer paths", async () => {
  const [account, profile, members] = await Promise.all([
    read("app/[lang]/account/page.tsx"),
    read("components/ProfileEditor.tsx"),
    read("components/MembersDirectory.tsx"),
  ]);

  assert.match(account, /<ProfileEditor/);
  assert.match(account, /FROM referrals r JOIN referral_codes rc/);
  assert.match(account, /\/classes\?mine=1/);
  assert.match(account, /\/messages/);
  assert.doesNotMatch(account, /\/community/);
  assert.match(profile, /prepareAvatarUpload/);
  assert.match(profile, /平台直接介绍关系/);
  assert.match(profile, /课程付款不产生介绍人积分/);
  assert.doesNotMatch(profile, /claim_referral|referralInput|输入 6 位推荐码|BACC/);
  assert.match(members, /消息与实时聊天/);
  assert.match(members, /SMARTLINGO 社区会员/);
  assert.match(members, /SmartLingo 语言学习社区会员/);
  assert.doesNotMatch(`${account}\n${members}`, /求职|招聘|雇主|人才库|career profile|employer|Talent/);
});

test("legacy talent route and API point safely to language courses", async () => {
  const [page, api, compatibility] = await Promise.all([
    read("app/[lang]/talent/page.tsx"),
    read("app/api/talent/route.ts"),
    read("components/TalentDirectory.tsx"),
  ]);

  assert.match(page, /redirect\(`\/\$\{lang\}\/classes`\)/);
  assert.match(api, /status: 410/);
  assert.match(api, /redirect: "\/classes"/);
  assert.match(compatibility, /进入课程中心/);
  assert.match(compatibility, /浏览三级课程的九个固定期限套餐/);
  assert.doesNotMatch(`${page}\n${api}\n${compatibility}`, /求职|招聘|雇主|候选人|Gold|Platinum|BACC/i);
});
