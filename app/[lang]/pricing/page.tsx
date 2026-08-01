import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";

const copy = {
  en: {
    title: "Free learning, deeper practice, and classes with clear economics.",
    intro: "SmartLingo keeps its learning foundation accessible and separates platform subscriptions from member-created class payments. Launch prices are targets until production billing and regional tax review are complete.",
    plans: [
      {name:"Free",label:"$0",body:"Start a language path and learn with the community.",items:["Core lessons and daily goals","Vocabulary and mistake review","Public text Ask Guru","Community, messages, and class discovery"],action:"Start free"},
      {name:"Plus",label:"PLANNED · $6.99/MO",body:"Practice more deeply with personal progress and live audio.",items:["Everything in Free","Expanded review and progress insights","Monthly live-audio allowance","Priority access to new practice modes"],action:"Join launch list"},
      {name:"Coordinator",label:"PLANNED · $12.99/MO",body:"Coordinate more learners and run richer class operations.",items:["Everything in Plus","Higher class and roster limits","Assignments, office hours, and analytics","Class templates and operating tools"],action:"Prepare a class"},
    ],
    noteTitle:"No live charge is started from this page",
    noteBody:"Final regional prices appear at checkout. Published competitor prices vary by market and time, so SmartLingo compares the current checkout value rather than claiming one permanent global competitor price.",
    splitKicker:"MEMBER-CREATED CLASS PAYMENTS",
    splitTitle:"A separate Stripe Connect flow: 70% class owner, 30% platform.",
    splitBody:"The split uses the learner’s actual discounted, pre-tax amount. Each learner receives 15% off the first successful payment for each class, once. Stripe fees, taxes, refunds, and disputes are handled separately and appear in the owner ledger.",
    split:[
      ["Owner onboarding", "A class owner completes Stripe-hosted identity, bank, tax, and payout requirements before accepting real payment."],
      ["First-payment discount", "The platform verifies eligibility in D1 and Stripe; a repeated checkout cannot consume the 15% discount twice."],
      ["Webhook authority", "Access, payout, refund, and dispute states change only from verified server webhooks, never from a success-page redirect."],
      ["Refund reversal", "Applicable owner transfers and platform fees are reversed consistently when an order is refunded or disputed."],
    ],
    rewardKicker:"INTRODUCER POINTS",
    rewardTitle:"Only successful platform subscription payments qualify.",
    rewardBody:"On every successfully paid platform subscription invoice, the direct introducer may receive the published points once for that invoice. No points are created from class checkout, owner payout, refund, dispute, tip, or connected-account payment.",
    start:"Create free account",
  },
  zh: {
    title: "免费学习、深入训练，班级收益规则清楚透明。",
    intro: "SmartLingo 保持基础学习可用，并把平台订阅与会员创建班级的付款完全分开。正式计费和地区税务审核完成前，页面价格均为上线目标。",
    plans: [
      {name:"免费方案",label:"0 美元",body:"开始一门语言学习路径，并和社区一起进步。",items:["基础课程与每日目标","词汇与错题复习","公开文字智能导师","社区、消息与班级发现"],action:"免费开始"},
      {name:"进阶方案",label:"计划价 · 每月 6.99 美元",body:"使用个人进度和实时语音，进行更深入训练。",items:["包含免费方案","更多复习与进度分析","每月实时语音额度","优先使用新的训练模式"],action:"加入上线名单"},
      {name:"协调员方案",label:"计划价 · 每月 12.99 美元",body:"协调更多学员，使用更完整的班级运营能力。",items:["包含进阶方案","更高班级与名册上限","作业、答疑时间与分析","班级模板和运营工具"],action:"准备开班"},
    ],
    noteTitle:"本页面不会发起真实收费",
    noteBody:"最终地区价格以结账页为准。竞争平台价格会随市场和时间改变，所以 SmartLingo 比较当时的实际结账价值，不声称存在一个永久不变的全球竞争者价格。",
    splitKicker:"会员创建班级的付款",
    splitTitle:"采用独立 Stripe Connect 路径：班主 70%，平台 30%。",
    splitBody:"分账以学员实际折后、税前金额为基础。每位学员在每个班级的首次成功付款享一次 15% 优惠。Stripe 费用、税款、退款与争议另行处理，并显示在班主账本中。",
    split:[
      ["班主收款认证", "班主完成 Stripe 托管的身份、银行、税务和提现要求后，才能接受真实付款。"],
      ["首次付款优惠", "平台同时在 D1 与 Stripe 校验资格；重复结账不能再次使用 15% 优惠。"],
      ["以回调为准", "使用权、分账、退款和争议状态只根据服务端验证回调变化，不依赖成功页面跳转。"],
      ["退款同步冲正", "订单退款或发生争议时，按规则同步冲正班主转账和平台费用。"],
    ],
    rewardKicker:"介绍人积分",
    rewardTitle:"只有成功支付的平台订阅才符合条件。",
    rewardBody:"平台订阅账单每次成功支付后，该用户的直接介绍人可按公布规则对该账单获得一次积分。班级结账、班主提现、退款、争议、打赏和连接账户付款都不会产生介绍人积分。",
    start:"免费创建账户",
  },
} as const;

export async function generateMetadata({ params }: {params:Promise<{lang:string}>}):Promise<Metadata>{const {lang}=await params;return{title:lang==="zh"?"方案与班级分账":"Plans and class economics"};}

export default async function PricingPage({params}:{params:Promise<{lang:string}>}){
  const {lang}=await params;if(lang!=="en"&&lang!=="zh")notFound();const t=copy[lang];
  return <main className="ai-cert-public-page lingo-public-page"><div className="ai-public-hero-shell"><SiteHeader lang={lang}/><section className="ai-public-hero"><p className="section-kicker">SMARTLINGO · {lang==="zh"?"方案":"PLANS"}</p><h1>{t.title}</h1><p>{t.intro}</p><Link className="primary-button" href={`/${lang}/auth/sign-up`}>{t.start} →</Link></section></div>
    <section className="lingo-pricing-grid">{t.plans.map((plan,index)=><article key={plan.name} className={index===1?"featured":""}><span>{plan.label}</span><h2>{plan.name}</h2><p>{plan.body}</p><ul>{plan.items.map(item=><li key={item}>{item}</li>)}</ul><Link href={index===2?`/${lang}/classes`:`/${lang}/auth/sign-up`}>{plan.action} →</Link></article>)}</section>
    <section className="ai-pricing-note"><div><span>!</span></div><article><h2>{t.noteTitle}</h2><p>{t.noteBody}</p></article></section>
    <section className="lingo-split-section"><div className="lingo-heading"><p className="section-kicker">{t.splitKicker}</p><h2>{t.splitTitle}</h2><p>{t.splitBody}</p></div><div>{t.split.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="ai-license-band"><div><p className="section-kicker">{t.rewardKicker}</p><h2>{t.rewardTitle}</h2><p>{t.rewardBody}</p></div><Link className="secondary-button" href={`/${lang}/account`}>{lang==="zh"?"查看账户":"View account"} →</Link></section>
    <SiteFooter lang={lang}/></main>;
}
