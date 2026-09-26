import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";

const copy = {
  en: {
    title: "Refunds must reverse Max access and prepaid AIGC credit consistently.",
    intro: "Draft for preview as of July 31, 2026. Live payment remains disabled until this policy completes legal and provider review.",
    sections: [
      ["Free and Max", "Every Beginner course is free with ads. Entering Intermediate or Advanced starts one 7-day Max trial; after it expires, Max is required to continue those levels. Max is sold once for six months or one year and never renews automatically. Refund eligibility is stated at checkout and remains subject to non-waivable consumer rights."],
      ["AIGC credits", "AIGC credit packs are prepaid, non-cash balances independent from Max. An approved refund reverses unused credits consistently; completed image, audio, or video generation may consume the published credit amount."],
      ["Payment reversal", "An approved Max or AIGC refund updates the matching access or balance from verified Stripe or SmartPay evidence. Partial refunds reverse the corresponding amount consistently."],
      ["Disputes", "A dispute can pause paid Max access while evidence is reviewed. Platform records distinguish paid, refunded, partially refunded, disputed, failed, and cancelled orders."],
      ["Mandatory rights", "Any non-waivable refund, withdrawal, or consumer right under applicable law controls over this draft."],
    ],
  },
  zh: {
    title: "退款必须同步冲正 Max 权益和预付人工智能生成额度。",
    intro: "预览草案，日期为 2026 年 7 月 31 日。本政策完成法律与服务商审核前，真实付款保持关闭。",
    sections: [
      ["免费与 Max", "全部初级课程可带广告免费学习。首次进入中级或高级课程会自动开始一次 7 天 Max 试用；试用到期后需购买 Max 才能继续这些等级。Max 一次性购买六个月或一年、不会自动续费。退款资格会在结账时说明，并始终受不可放弃的消费者权利约束。"],
      ["人工智能生成额度", "人工智能生成额度包是与 Max 相互独立的预付非现金余额。批准退款时会一致冲正尚未使用的额度；已经完成的图片、音频或视频生成会按公布数量扣除额度。"],
      ["付款冲正", "批准 Max 或人工智能生成额度退款时，根据验证后的 Stripe 或 SmartPay 证据同步更新对应使用权或余额；部分退款按相应金额一致冲正。"],
      ["付款争议", "争议处理期间可以暂停已付费 Max 使用权。平台会区分已付款、已退款、部分退款、争议、失败与取消订单。"],
      ["法律强制权利", "适用法律规定的任何不可放弃退款、撤回或消费者权利，优先于本草案。"],
    ],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> { const { lang } = await params; return { title: lang === "en" ? "Refund Policy — Draft" : "退款政策（草案）" }; }
export default async function RefundPolicyPage({ params }: { params: Promise<{ lang: string }> }) { const { lang } = await params; if (lang !== "en" && lang !== "zh" && lang !== "zh-tw" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound(); const t = copy[(lang === "zh" || lang === "zh-tw") ? "zh" : "en"]; return <main className="ai-cert-legal-page lingo-public-page"><SiteHeader lang={lang}/><article className="ai-cert-legal-main"><div className="ai-draft-note"><strong>{(lang === "zh" || lang === "zh-tw") ? "草案 · 待正式法律审核" : "DRAFT · FORMAL LEGAL REVIEW PENDING"}</strong><span>{t.intro}</span></div><p className="section-kicker">{(lang === "zh" || lang === "zh-tw") ? "退款政策" : "REFUND POLICY"}</p><h1>{t.title}</h1><div className="ai-legal-sections">{t.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></article><SiteFooter lang={lang}/></main>; }
