import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";

const copy = {
  en: {
    title: "Language, course, community, and voice data should stay understandable.",
    intro: "Draft for preview as of July 31, 2026. Formal legal and regional privacy review remains required before production billing.",
    sections: [
      ["Information we process", "Account and language preferences, learning progress, practice attempts, course membership, direct introducer attribution, platform-subscription reward records, Community and message content, and files you deliberately upload."],
      ["Voice and AI practice", "Microphone access requires permission and sign-in. Content deliberately submitted to the AI Guru or live-audio practice may be sent to the configured AI provider. Raw audio, transcripts, and model responses follow the published retention controls; do not submit unnecessary sensitive information."],
      ["Course visibility", "A course owner may see roster, attendance, assignments, and privacy-safe progress required to operate that class. Private answers and unrelated account activity are not shared. A course is private unless it completes public-directory review."],
      ["Payments", "Stripe and connected accounts process payment, identity, bank, tax, refund, and payout data under their own notices. SmartLingo stores auditable order amounts, discount eligibility, split, status, and provider references, not full card or bank credentials."],
      ["Introducer rewards", "A one-level introducer relationship may be stored. Reward records are created only by verified successful platform-subscription payment events. Member-created course purchases and owner payouts do not create introducer rewards."],
      ["Guest SmartCards", "A random HttpOnly device key may keep provisional challenge attempts and points before sign-in. SmartLingo stores its hash, deck version, server score, answer fingerprint, local date, and claim state for continuity and abuse prevention. Provisional points cannot be spent until claimed by a signed-in account."],
      ["Your choices", "Where applicable, you may update your profile, leave a course, manage communications, withdraw optional consent, and request access, correction, export, or deletion through the published contact process."],
      ["Retention and security", "Data is retained only as needed for service delivery, learning continuity, payments, disputes, fraud prevention, and legal duties. Reasonable safeguards are used, but no online service can promise absolute security."],
      ["Children and changes", "Age eligibility and guardian-consent rules must be configured for each launch region. A legally reviewed version will state its effective date and material changes will receive an appropriate notice."],
    ],
  },
  zh: {
    title: "让语言学习、课程、社区与语音资料的处理方式清楚易懂。",
    intro: "预览草案，日期为 2026 年 7 月 31 日。启用生产收费前，仍须完成正式法律与地区隐私审核。",
    sections: [
      ["我们处理的资料", "账户与语言偏好、学习进度、训练记录、所属课程、直接介绍人归因、平台订阅奖励记录、社区与消息内容，以及您主动上传的文件。"],
      ["语音与人工智能训练", "麦克风需要取得权限并登录。您主动提交给人工智能导师或实时语音训练的内容可能发送给已配置的人工智能服务商。原始音频、文字记录与模型回答遵守公布的保留控制，请勿提交没有必要的敏感资料。"],
      ["课程可见范围", "班主可查看运营该班所需的名册、出勤、作业与保护隐私的进度汇总；私人作答和与课程无关的账户活动不会共享。课程在完成公开目录审核前保持私有。"],
      ["付款资料", "Stripe 与连接账户根据各自说明处理付款、身份、银行、税务、退款与提现资料。SmartLingo 保存可审计的订单金额、优惠资格、分账、状态和服务商引用，不保存完整银行卡或银行凭据。"],
      ["介绍人奖励", "系统可保存一层直接介绍关系。奖励记录只能由验证成功的平台订阅付款事件创建；会员创建课程的购买与班主收款不产生介绍人奖励。"],
      ["访客 SmartCard", "登录前可由随机 HttpOnly 设备密钥保存待领取的挑战与积分。为延续学习和防止滥用，SmartLingo 保存该密钥的哈希、词卡版本、服务器评分、答案指纹、本地日期与领取状态。待领取积分在绑定登录账户前不能使用。"],
      ["您的选择", "在适用范围内，您可更新档案、退出课程、管理沟通偏好、撤回可选同意，并通过公布的联系流程申请访问、更正、导出或删除资料。"],
      ["保留与安全", "资料只在提供服务、延续学习、付款、争议、防止欺诈和履行法律义务所需期间保留。平台采用合理保护措施，但任何网络服务都无法保证绝对安全。"],
      ["未成年人及变更", "每个上线地区都必须配置年龄资格与监护人同意规则。完成法律审核的版本会注明生效日期，重大变更会通过适当方式通知。"],
    ],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "Privacy Policy — Draft" : "隐私政策（草案）" };
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const t = copy[lang];
  return <main className="ai-cert-legal-page lingo-public-page"><SiteHeader lang={lang}/><article className="ai-cert-legal-main"><div className="ai-draft-note"><strong>{lang === "zh" ? "草案 · 待正式法律审核" : "DRAFT · FORMAL LEGAL REVIEW PENDING"}</strong><span>{t.intro}</span></div><p className="section-kicker">{lang === "zh" ? "隐私政策" : "PRIVACY POLICY"}</p><h1>{t.title}</h1><div className="ai-legal-sections">{t.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></article><SiteFooter lang={lang}/></main>;
}
