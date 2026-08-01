import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("homepage exposes the complete SmartLingo learning, class, and social flow", async () => {
  const source = await read("../app/[lang]/page.tsx");

  assert.match(source, /七种语言，同一套完整学习闭环/);
  assert.match(source, /听、说、读、写/);
  assert.match(source, /每日短任务、间隔复习/);
  assert.match(source, /登录会员可以作为老师或协调员创建私有班级/);
  assert.match(source, /班级社区/);
  assert.match(source, /消息与实时聊天/);
  assert.match(source, /人工智能导师与实时语音/);
  assert.match(source, /每位学员在每个班级的首次付款可享一次 15% 优惠/);
  assert.match(source, /班主获得 70%，平台获得 30%/);
  assert.match(source, /介绍人积分只来自平台订阅付款/);
  assert.match(source, /班级购买、老师收款、退款、打赏和连接账户付款一律不产生介绍人积分/);
  assert.doesNotMatch(source, /人工智能实操营|21 天|BACC|黄金会员|铂金会员|授权码|PayPal/);
});

test("SmartLingo brand and original social preview assets are locally hosted", async () => {
  await Promise.all([
    access(new URL("../public/favicon.svg", import.meta.url)),
    access(new URL("../public/smartlingo-language-community-1600.png", import.meta.url)),
  ]);
  const layout = await read("../app/layout.tsx");
  assert.match(layout, /images: \[\{ url: "\/smartlingo-language-community-1600\.png"/);
  assert.match(layout, /SmartLingo — 从第一天开口，与班级一起进步/);
  assert.match(layout, /七种语言、听说读写、实时语音导师、会员自主开班、班级社区与透明分账/);
});

test("Guru, live audio, class commerce, and reward boundaries are explicit", async () => {
  const [assistant, live, terms, programs, pricing] = await Promise.all([
    read("../app/api/assistant/route.ts"),
    read("../app/api/assistant/live/route.ts"),
    read("../app/[lang]/terms/page.tsx"),
    read("../app/[lang]/programs/page.tsx"),
    read("../app/[lang]/pricing/page.tsx"),
  ]);

  assert.match(assistant, /Every signed-in member may prepare a private class as teacher or coordinator/);
  assert.match(assistant, /only a verified successful platform subscription payment may create published introducer points/);
  assert.match(assistant, /member-created class payments never qualify/);
  assert.match(live, /Never promise fluency, education, employment, visa, income/);
  assert.match(programs, /实时语音需要登录/);
  assert.match(terms, /不是官方语言考试/);
  assert.match(pricing, /本页面不会发起真实收费/);
  assert.match(pricing, /Stripe Connect/);
});
