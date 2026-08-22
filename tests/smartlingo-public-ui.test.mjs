import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("SmartLingo branding exposes the four primary learning choices", async () => {
  const [header, footer, wordmark, layout, languageLayout, locale, css] = await Promise.all([
    read("../components/SiteHeader.tsx"),
    read("../components/SiteFooter.tsx"),
    read("../components/SmartLingoWordmark.tsx"),
    read("../app/layout.tsx"),
    read("../app/[lang]/layout.tsx"),
    read("../lib/interface-locale.ts"),
    read("../app/globals.css"),
  ]);

  assert.match(header, /<SmartLingoWordmark\/>/);
  assert.match(footer, /<SmartLingoWordmark\/>/);
  assert.match(wordmark, /<span>Smart<\/span><em>Lingo<\/em>/);
  assert.match(css, /@media\(min-width:1101px\) and \(max-width:1320px\)\{\.smartlingo-wordmark\{display:grid/);
  for (const path of ["play/everyday", "programs", "play", "assistant"]) assert.match(header, new RegExp(`/${path}`));
  for (const label of ["生活口语", "边玩边学", "选择课程", "咨询AI"]) assert.match(locale, new RegExp(label));
  assert.doesNotMatch(header, /\/classes|\/community/);
  assert.match(footer, /© 2026 SmartLingo\.net/);
  for (const path of ["about", "privacy", "terms", "project"]) assert.match(footer, new RegExp(`/${path}`));
  assert.ok(footer.indexOf("/about") < footer.indexOf("/privacy") && footer.indexOf("/privacy") < footer.indexOf("/terms") && footer.indexOf("/terms") < footer.indexOf("/project"));
  assert.doesNotMatch(footer, /\/programs|\/assistant/);
  assert.doesNotMatch(footer, /\/pricing/);
  assert.doesNotMatch(footer, /\/community/);
  assert.doesNotMatch(footer, /LanguageLink|interface-language|language-menu/);
  assert.match(layout, /"smartlingo\.net"/);
  assert.match(layout, /smartlingo-language-community-1600\.png/);
  assert.match(layout, /<html lang="zh-CN"/);
  assert.match(languageLayout, /十二种语言、三级固定月费课程、首月免费/);
  assert.match(languageLayout, /twelve languages with three fixed monthly course levels/);
  assert.doesNotMatch(`${header}\n${footer}\n${layout}`, /SmartAICert|SmartCert\.pro|BingAcademy certificate/i);
});

test("homepage exposes twelve target-language communities and one complete five-skill loop", async () => {
  const [home, catalog] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../lib/smartlingo-language-communities.ts"),
  ]);

  for (const language of ["中文", "英语", "西班牙语", "日语", "韩语", "法语", "德语", "俄语", "意大利语", "葡萄牙语", "阿拉伯语", "印地语"]) assert.match(catalog, new RegExp(language));
  for (const skill of ["词汇", "阅读", "写作", "听力", "对话"]) assert.match(home, new RegExp(skill));
  assert.match(home, /从第一天开始，开口说一门新语言/);
  assert.match(home, /每日短任务、间隔复习、透明技能分和可见进度/);
  assert.match(home, /人工智能导师与实时语音/);
  assert.match(home, /课程学习社区/);
  assert.doesNotMatch(home, /21 天|人工智能实操营|BingAcademy 可验证证书|39 美元|Gold|Platinum|BACC/);
});

test("member-led courses and commerce follow the approved boundaries", async () => {
  const [home, pricing, programs, about, terms, readme, product] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../app/[lang]/pricing/page.tsx"),
    read("../app/[lang]/programs/page.tsx"),
    read("../app/[lang]/about/page.tsx"),
    read("../app/[lang]/terms/page.tsx"),
    read("../README.md"),
    read("../docs/smartlingo-product-foundation.md"),
  ]);
  const joined = [home, pricing, programs, about, terms, readme, product].join("\n");

  assert.match(joined, /任何已登录会员都可|每位登录会员都可/);
  assert.match(joined, /老师或协调员/);
  assert.match(joined, /专属课堂/);
  assert.match(joined, /15%|八五折/);
  assert.match(joined, /70%|七成/);
  assert.match(joined, /30%|三成/);
  assert.match(joined, /折后税前/);
  assert.match(joined, /Stripe Connect/);
  assert.match(joined, /课程购买、收款、打赏和退款都不会产生介绍人积分/);
  assert.match(joined, /平台订阅/);
  assert.match(joined, /SmartCard course credit is a third, independent accounting domain/);
  assert.doesNotMatch(joined, /开班权限从黄金会员开始|铂金会员|管理员签发的授权码|license key|PayPal|BACC/);
});

test("course activation starts with a free month and no immediate charge", async () => {
  const [home, pricing, programs, terms, refund] = await Promise.all([
    read("../app/[lang]/page.tsx"),
    read("../app/[lang]/pricing/page.tsx"),
    read("../app/[lang]/programs/page.tsx"),
    read("../app/[lang]/terms/page.tsx"),
    read("../app/[lang]/refund-policy/page.tsx"),
  ]);
  const joined = [home, pricing, programs, terms, refund].join("\n");

  assert.match(home, /30 天后按固定月费续订/);
  assert.match(pricing, /redirect\(`\/\$\{lang\}\/programs`\)/);
  assert.match(home, /第一个月免费/);
  assert.match(terms, /付款启用条件/);
  assert.match(refund, /真实付款保持关闭/);
  assert.doesNotMatch(joined, /当前已启用真实收费|charged:\s*true/);
});

test("privacy, terms, and refund policy remain visibly labeled legal drafts", async () => {
  const [privacy, terms, refund] = await Promise.all([
    read("../app/[lang]/privacy/page.tsx"),
    read("../app/[lang]/terms/page.tsx"),
    read("../app/[lang]/refund-policy/page.tsx"),
  ]);

  for (const source of [privacy, terms, refund]) {
    assert.match(source, /草案 · 待正式法律审核/);
    assert.match(source, /ai-draft-note/);
  }
  assert.match(terms, /不是官方语言考试/);
  assert.match(privacy, /语音与人工智能训练/);
  assert.match(privacy, /会员创建课程的购买与班主收款不产生介绍人奖励/);
  assert.match(refund, /退款必须同步冲正使用权和课程分账/);
});

test("public assets are local and the responsive system contains text at desktop, tablet, and phone widths", async () => {
  await access(new URL("../public/smartlingo-language-community-1600.png", import.meta.url));
  const css = await read("../app/globals.css");

  assert.match(css, /\.lingo-home\{[^}]*overflow-x:clip/);
  assert.match(css, /\.lingo-hero\{width:min\(1420px,100%\)/);
  assert.match(css, /\.lingo-hero-copy h2\{[^}]*text-wrap:wrap[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.lingo-heading h2,[^{]+\{[^}]*max-width:100%[^}]*overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:1080px\)/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /grid-template-columns:1fr!important/);
});
