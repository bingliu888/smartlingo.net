import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { homeInterfaceTranslations } from "../../../lib/home-interface-translations.generated";
import { isInterfaceLanguage, safeInterfaceLanguage, translateHomeCopy, translateTraditionalCopy } from "../../../lib/interface-locale";

const copy = {
  en: {
    metadata: "Terms of Use — Draft",
    draft: "DRAFT · FORMAL LEGAL REVIEW PENDING",
    eyebrow: "TERMS OF USE",
    title: "Learn, create, connect, and refer responsibly.",
    intro: "Draft for preview as of July 31, 2026. Final terms require formal legal, tax, payment, and regional review.",
    sections: [
      ["Accounts and conduct", "Provide accurate information, protect your account, respect learners, and do not harass, impersonate, publish unlawful content, manipulate progress or rewards, scrape private data, or interfere with the service."],
      ["AI-assisted learning", "AI explanations, corrections, pronunciation feedback, and scores can be incomplete or wrong. They support practice and are not an official language examination, professional advice, or a guarantee of educational, employment, visa, or other outcomes."],
      ["Built-in courses", "SmartLingo administrators publish the built-in Beginner, Intermediate, and Advanced curriculum. Courses are learning levels, not separate payment products, and users may not sell or relabel them as their own."],
      ["Free, Max, and rewards", "Every Beginner course is free with ads. Opening Intermediate or Advanced starts one 7-day Max trial; after it expires, active Max is required to continue those levels. Max is a one-time six-month or annual purchase with no automatic renewal. Only an eligible verified Max charge may create the published points for one direct introducer; signup, other checkout, refunds, disputes, tips, and unrelated charges never create those points."],
      ["SmartCards and reward points", "Public SmartCards may be used without an account. Guest points are provisional until claimed after sign-in. Only a first server-scored pass for a published deck version may earn reward points, subject to self-challenge, daily-cap, fraud, and eligibility controls. Reward points have no cash or transfer value and may be used only for published in-product digital rewards."],
      ["Content and Community", "You retain rights in content you submit and grant the limited permission required to host, deliver, moderate, and protect it. Do not upload content you lack rights to use. Community, messages, and live chat are subject to moderation and reporting controls."],
      ["Payment readiness", "No page represented as planned or disabled authorizes a live charge. Real billing opens only after provider credentials, connected-account readiness, taxes, refund rules, verified webhooks, and production acceptance are complete."],
      ["Availability and changes", "Features and courses may evolve, pause, or be withdrawn. A legally reviewed version will state its effective date and provide appropriate notice of material changes."],
    ],
  },
  zh: {
    metadata: "使用条款（草案）",
    draft: "草案 · 待正式法律审核",
    eyebrow: "使用条款",
    title: "负责任地学习、创作、交流与直接推荐。",
    intro: "预览草案，日期为 2026 年 7 月 31 日。最终条款仍须完成正式法律、税务、支付与地区审核。",
    sections: [
      ["账户与行为", "请提供准确资料、保护账户并尊重学习者。不得骚扰、冒充、发布违法内容、操纵进度或奖励、抓取私人资料，或干扰平台运行。"],
      ["人工智能辅助学习", "人工智能解释、纠正、发音反馈与评分可能不完整或有误，只用于辅助训练，不是官方语言考试、专业意见，也不保证教育、就业、签证或其他结果。"],
      ["内置课程", "SmartLingo 管理员发布内置的初级、中级和高级课程。课程是学习等级，不是独立付款产品；用户不得将其作为自己创建的课程出售或重新标示。"],
      ["免费、Max 与奖励", "全部初级课程可带广告免费学习。首次进入中级或高级课程会开始一次 7 天 Max 试用；试用到期后需有效 Max 才能继续这些等级。Max 一次性购买六个月或一年，不会自动续费。只有符合资格且验证成功的 Max 收费可按公布规则为一位直接介绍人产生积分；注册、其他结账、退款、争议、打赏和无关收费不会产生这些积分。"],
      ["SmartCard 与奖励积分", "公开 SmartCard 可在没有账户时使用；访客积分在登录领取前只是待领取记录。只有已发布词卡版本的首次服务器合格评分，才可能在自我挑战、每日上限、防欺诈与资格规则下产生奖励积分。奖励积分不可兑现或转让，只能用于已公布的站内数字奖励。"],
      ["内容与社区", "您保留所提交内容的权利，并授权平台在托管、交付、治理与保护服务所需范围内使用。不得上传无权使用的内容；社区、消息与实时聊天受治理和举报控制。"],
      ["付款启用条件", "标注为计划中或已停用的页面不会发起真实收费。只有在服务商凭据、连接账户、税务、退款规则、验证回调与生产验收全部完成后，才会开放真实计费。"],
      ["可用性与变更", "功能和课程可能更新、暂停或停止。完成法律审核的版本会注明生效日期，并对重大变更提供适当通知。"],
    ],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> { const { lang } = await params; const locale = safeInterfaceLanguage(lang); const t = locale === "zh" ? copy.zh : locale === "zh-tw" ? translateTraditionalCopy(copy.zh) : translateHomeCopy(copy.en, locale, homeInterfaceTranslations); return { title: t.metadata }; }
export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) { const { lang } = await params; if (!isInterfaceLanguage(lang)) notFound(); const locale = safeInterfaceLanguage(lang); const t = locale === "zh" ? copy.zh : locale === "zh-tw" ? translateTraditionalCopy(copy.zh) : translateHomeCopy(copy.en, locale, homeInterfaceTranslations); return <main className="ai-cert-legal-page lingo-public-page"><SiteHeader lang={locale}/><article className="ai-cert-legal-main"><div className="ai-draft-note"><strong>{t.draft}</strong><span>{t.intro}</span></div><p className="section-kicker">{t.eyebrow}</p><h1>{t.title}</h1><div className="ai-legal-sections">{t.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></article><SiteFooter lang={locale}/></main>; }
