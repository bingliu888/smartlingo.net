import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";

const copy = {
  en: {
    title: "Learn, teach, coordinate, and refer responsibly.",
    intro: "Draft for preview as of July 31, 2026. Final terms require formal legal, tax, payment, and regional review.",
    sections: [
      ["Accounts and conduct", "Provide accurate information, protect your account, respect learners, and do not harass, impersonate, publish unlawful content, manipulate progress or rewards, scrape private data, or interfere with the service."],
      ["AI-assisted learning", "AI explanations, corrections, pronunciation feedback, and scores can be incomplete or wrong. They support practice and are not an official language examination, professional advice, or a guarantee of educational, employment, visa, or other outcomes."],
      ["Member-led classes", "Every signed-in member may prepare a private class as teacher or coordinator using an approved language path. Public listing, higher-risk content, and production payment require applicable review. Class owners are responsible for truthful descriptions, lawful conduct, learner support, and their tax obligations."],
      ["Class economics", "The planned first successful payment by a learner in each class receives one 15% discount. The actual discounted pre-tax amount is split 70% to the class owner and 30% to the platform. Taxes, processing fees, refunds, and disputes are handled separately and shown in the ledger."],
      ["Platform subscriptions and rewards", "Platform subscriptions are separate from member-created class payments. A verified successful platform-subscription charge may create the published points for one direct introducer. Signup, class checkout, owner payouts, refunds, disputes, tips, and connected-account charges never create those points."],
      ["Content and Community", "You retain rights in content you submit and grant the limited permission required to host, deliver, moderate, and protect it. Do not upload content you lack rights to use. Community, messages, and live chat are subject to moderation and reporting controls."],
      ["Payment readiness", "No page represented as planned or disabled authorizes a live charge. Real billing opens only after provider credentials, connected-account readiness, taxes, refund rules, verified webhooks, and production acceptance are complete."],
      ["Availability and changes", "Features and courses may evolve, pause, or be withdrawn. A legally reviewed version will state its effective date and provide appropriate notice of material changes."],
    ],
  },
  zh: {
    title: "负责任地学习、教学、协调班级与直接推荐。",
    intro: "预览草案，日期为 2026 年 7 月 31 日。最终条款仍须完成正式法律、税务、支付与地区审核。",
    sections: [
      ["账户与行为", "请提供准确资料、保护账户并尊重学习者。不得骚扰、冒充、发布违法内容、操纵进度或奖励、抓取私人资料，或干扰平台运行。"],
      ["人工智能辅助学习", "人工智能解释、纠正、发音反馈与评分可能不完整或有误，只用于辅助训练，不是官方语言考试、专业意见，也不保证教育、就业、签证或其他结果。"],
      ["会员自主开班", "每位登录会员都可使用经批准的语言路径，以老师或协调员身份准备私有班级。进入公开目录、高风险内容与生产收费须完成适用审核。班主应对真实描述、合法运营、学员支持与自身税务义务负责。"],
      ["班级分账", "每位学员在每个班级的首次成功付款计划享一次八五折；以实际折后税前金额为基础，班主获得七成，平台获得三成。税款、处理费、退款和争议另行处理并显示在账本中。"],
      ["平台订阅与奖励", "平台订阅和会员创建班级的付款彼此独立。验证成功的平台订阅收费可按公布规则为一位直接介绍人产生积分；注册、班级结账、班主收款、退款、争议、打赏和连接账户收费永不产生这些积分。"],
      ["内容与社区", "您保留所提交内容的权利，并授权平台在托管、交付、治理与保护服务所需范围内使用。不得上传无权使用的内容；社区、消息与实时聊天受治理和举报控制。"],
      ["付款启用条件", "标注为计划中或已停用的页面不会发起真实收费。只有在服务商凭据、连接账户、税务、退款规则、验证回调与生产验收全部完成后，才会开放真实计费。"],
      ["可用性与变更", "功能和课程可能更新、暂停或停止。完成法律审核的版本会注明生效日期，并对重大变更提供适当通知。"],
    ],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> { const { lang } = await params; return { title: lang === "en" ? "Terms of Use — Draft" : "使用条款（草案）" }; }
export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) { const { lang } = await params; if (lang !== "en" && lang !== "zh") notFound(); const t = copy[lang]; return <main className="ai-cert-legal-page lingo-public-page"><SiteHeader lang={lang}/><article className="ai-cert-legal-main"><div className="ai-draft-note"><strong>{lang === "zh" ? "草案 · 待正式法律审核" : "DRAFT · FORMAL LEGAL REVIEW PENDING"}</strong><span>{t.intro}</span></div><p className="section-kicker">{lang === "zh" ? "使用条款" : "TERMS OF USE"}</p><h1>{t.title}</h1><div className="ai-legal-sections">{t.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></article><SiteFooter lang={lang}/></main>; }
