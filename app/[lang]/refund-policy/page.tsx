import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";

const copy = {
  en: {
    title: "Refunds must reverse access and the class split consistently.",
    intro: "Draft for preview as of July 31, 2026. Live payment remains disabled until this policy completes legal and provider review.",
    sections: [
      ["Platform subscriptions", "Cancellation stops future renewals under the checkout terms. Refund eligibility for a paid period will be stated at checkout and remains subject to non-waivable consumer rights."],
      ["Member-created classes", "Each class must disclose schedule, delivery, owner, price, and refund window before purchase. The first-payment discount does not remove applicable refund rights."],
      ["Split reversal", "An approved class refund reverses applicable owner transfer and platform application fee consistently. Partial refunds reverse the corresponding amounts and update access and ledgers from verified webhooks."],
      ["Disputes", "A dispute can pause class access and owner payout while evidence is reviewed. Platform records distinguish paid, refunded, partially refunded, disputed, failed, and cancelled orders."],
      ["Mandatory rights", "Any non-waivable refund, withdrawal, or consumer right under applicable law controls over this draft."],
    ],
  },
  zh: {
    title: "退款必须同步冲正使用权和班级分账。",
    intro: "预览草案，日期为 2026 年 7 月 31 日。本政策完成法律与服务商审核前，真实付款保持关闭。",
    sections: [
      ["平台订阅", "取消会依照结账条款停止未来续费；已付周期的退款资格会在结账时说明，并始终受不可放弃的消费者权利约束。"],
      ["会员创建班级", "每个班级在购买前必须披露日程、交付方式、班主、价格与退款窗口。首次付款优惠不会取消适用的退款权利。"],
      ["分账冲正", "批准班级退款时，按规则同步冲正班主转账与平台应用费；部分退款按相应金额冲正，并根据验证回调更新使用权和账本。"],
      ["付款争议", "争议处理期间可以暂停班级使用权与班主提现。平台会区分已付款、已退款、部分退款、争议、失败与取消订单。"],
      ["法律强制权利", "适用法律规定的任何不可放弃退款、撤回或消费者权利，优先于本草案。"],
    ],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> { const { lang } = await params; return { title: lang === "en" ? "Refund Policy — Draft" : "退款政策（草案）" }; }
export default async function RefundPolicyPage({ params }: { params: Promise<{ lang: string }> }) { const { lang } = await params; if (lang !== "en" && lang !== "zh") notFound(); const t = copy[lang]; return <main className="ai-cert-legal-page lingo-public-page"><SiteHeader lang={lang}/><article className="ai-cert-legal-main"><div className="ai-draft-note"><strong>{lang === "zh" ? "草案 · 待正式法律审核" : "DRAFT · FORMAL LEGAL REVIEW PENDING"}</strong><span>{t.intro}</span></div><p className="section-kicker">{lang === "zh" ? "退款政策" : "REFUND POLICY"}</p><h1>{t.title}</h1><div className="ai-legal-sections">{t.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></article><SiteFooter lang={lang}/></main>; }
