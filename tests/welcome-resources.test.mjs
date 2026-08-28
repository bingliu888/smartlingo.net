import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("homepage exposes the complete SmartLingo learning and fixed-course flow", async () => {
  const [source, choices, locale] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../components/HomeLearningChoices.tsx"),
    read("../lib/interface-locale.ts"),
  ]);

  assert.match(source, /十二种语言，同一套完整学习闭环/);
  for (const skill of ["词汇", "阅读", "写作", "听力", "对话"]) {
    assert.match(source, new RegExp(skill));
  }
  assert.match(source, /每日短任务、间隔复习/);
  assert.match(source, /每种语言都有由 SmartLingo 管理员维护的初期、中级和高级课程/);
  assert.match(source, /课程社区/);
  assert.match(source, /消息与实时聊天/);
  assert.match(source, /人工智能导师与实时语音/);
  assert.match(source, /九个套餐，不自动续费/);
  assert.match(source, /先选择学习语言，再从三级课程及 3、6、12 个月中选择/);
  assert.match(source, /三类积分独立记账、可追溯/);
  assert.match(source, /经验证的 SmartCard 挑战积分只能抵符合条件的 SmartLingo 课程套餐/);
  assert.match(source, /课程购买、收款、打赏和退款都不会产生介绍人积分/);
  for (const label of ["生活口语", "边玩边学", "选择课程", "咨询AI"]) assert.match(`${source}\n${choices}\n${locale}`, new RegExp(label));
  assert.doesNotMatch(source, /人工智能实操营|21 天|BACC|黄金会员|铂金会员|授权码|PayPal/);
});

test("SmartLingo brand and original social preview assets are locally hosted", async () => {
  await Promise.all([
    access(new URL("../public/favicon.svg", import.meta.url)),
    access(new URL("../public/smartlingo-language-community-1600.png", import.meta.url)),
  ]);
  const layout = await read("../app/layout.tsx");
  assert.match(layout, /images: \[\{ url: "\/smartlingo-language-community-1600\.png"/);
  assert.match(layout, /SmartLingo — 从第一天开口，与课程一起进步/);
  assert.match(layout, /十二种语言、三级课程、九个固定期限套餐/);
});

test("Guru, live audio, and fixed-course boundaries are explicit", async () => {
  const [assistant, live, terms, programs, planner, pricing] = await Promise.all([
    read("../app/api/assistant/route.ts"),
    read("../app/api/assistant/live/route.ts"),
    read("../app/[lang]/terms/page.tsx"),
    read("../app/[lang]/programs/page.tsx"),
    read("../components/LearningPathPlanner.tsx"),
    read("../app/[lang]/pricing/page.tsx"),
  ]);

  assert.match(assistant, /Courses are created and priced only by SmartLingo administrators/);
  assert.match(assistant, /A\/V webinar classroom/);
  assert.match(assistant, /Do not claim that members can create courses/);
  assert.match(live, /Never promise fluency, education, employment, visa, income/);
  assert.match(planner, /麦克风与实时语音只在登录后开放/);
  assert.match(terms, /不是官方语言考试/);
  assert.match(pricing, /redirect\(`\/\$\{lang\}\/programs`\)/);
  assert.match(programs, /建立真正可用的词汇、阅读、写作、听力与对话能力/);
});
