import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("homepage exposes the complete SmartLingo learning and fixed-course flow", async () => {
  const source = await read("../app/[lang]/page.tsx");

  assert.match(source, /十二种语言，同一套完整学习闭环/);
  for (const skill of ["词汇", "阅读", "写作", "听力", "对话"]) {
    assert.match(source, new RegExp(skill));
  }
  assert.match(source, /每日短任务、间隔复习/);
  assert.match(source, /每种语言都有由 SmartLingo 管理员维护的基础、中级和高级课程/);
  assert.match(source, /班级社区/);
  assert.match(source, /消息与实时聊天/);
  assert.match(source, /人工智能导师与实时语音/);
  assert.match(source, /今天开通课程不会收费/);
  assert.match(source, /30 天后按固定月费续订/);
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
  assert.match(layout, /十二种语言、三级固定月费课程、首月免费/);
});

test("Guru, live audio, and fixed-course boundaries are explicit", async () => {
  const [assistant, live, terms, programs, pricing] = await Promise.all([
    read("../app/api/assistant/route.ts"),
    read("../app/api/assistant/live/route.ts"),
    read("../app/[lang]/terms/page.tsx"),
    read("../app/[lang]/programs/page.tsx"),
    read("../app/[lang]/pricing/page.tsx"),
  ]);

  assert.match(assistant, /Courses are created and priced only by SmartLingo administrators/);
  assert.match(assistant, /A\/V webinar classroom/);
  assert.match(assistant, /Do not claim that members can create courses/);
  assert.match(live, /Never promise fluency, education, employment, visa, income/);
  assert.match(programs, /实时语音需要登录/);
  assert.match(terms, /不是官方语言考试/);
  assert.match(pricing, /第一个月免费/);
  assert.match(pricing, /有效月费订阅/);
});
