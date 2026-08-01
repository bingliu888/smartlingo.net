import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("dashboard exposes one platform-subscription referral and a payment-backed reward history", async () => {
  const panel = await read("../components/MembershipPanel.tsx");

  assert.match(panel, /referral:\s*\{ code: string; url: string; count: number; joined: ReferredMember\[\] \}/);
  assert.match(panel, /rewardRule: string/);
  assert.match(panel, /classPaymentsCreateIntroducerPoints: false/);
  assert.match(panel, /平台订阅推荐/);
  assert.match(panel, /分享此链接建立一层直接介绍关系/);
  assert.match(panel, /只有平台每次成功收取订阅费后/);
  assert.match(panel, /班级付款不计积分/);
  assert.match(panel, /介绍人积分只在平台成功收取订阅费后产生/);
  assert.match(panel, /当前可见积分均绑定到唯一的平台订阅付款/);
  assert.doesNotMatch(panel, /BACC|班级邀请链接|claim_referral|输入 6 位推荐码|Enter 6-character code/);
});

test("share studio uses only the platform-subscription referral URL", async () => {
  const share = await read("../components/ShareStudio.tsx");

  assert.match(share, /const referralUrl = platform\?\.referral\?\.url\?\.trim\(\) \|\| ""/);
  assert.match(share, /const referralCode = platform\?\.referral\?\.code\?\.trim\(\) \|\| ""/);
  assert.match(share, /平台订阅成功后 · 介绍人可获积分/);
  assert.match(share, /班级付款永不计入/);
  assert.match(share, /class payments never qualify/);
  assert.doesNotMatch(share, /BACC|全球公民|Global Citizen|填写推荐码|班级推荐链接/);
});

test("profile attribution is read-only, single-level, and separate from class commerce", async () => {
  const profile = await read("../components/ProfileEditor.tsx");

  assert.match(profile, /平台直接介绍关系/);
  assert.match(profile, /一层直接介绍关系/);
  assert.match(profile, /通过平台订阅推荐链接在首次注册时自动记录/);
  assert.match(profile, /班级付款不产生介绍人积分/);
  assert.doesNotMatch(profile, /claim_referral|referralInput|输入 6 位推荐码|Enter 6-character code|BACC/);
});
