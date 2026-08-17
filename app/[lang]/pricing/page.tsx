import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { SMARTLINGO_COURSE_PACKAGES } from "../../../lib/smartlingo-course-packages";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "课程与月费" : "Courses and monthly pricing" };
}

export default async function PricingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const zh = lang === "zh";
  return <main className="ai-cert-public-page lingo-public-page">
    <div className="ai-public-hero-shell"><SiteHeader lang={lang}/><section className="ai-public-hero"><p className="section-kicker">SMARTLINGO · {zh ? "固定课程" : "FIXED COURSES"}</p><h1>{zh ? "三级课程，首月免费。" : "Three course levels. First month free."}</h1><p>{zh ? "每种语言都有相同的基础、中级和高级月费方案。会员不能创建课程或自行收费。" : "Every language offers the same Basic, Intermediate, and Advanced monthly plans. Members cannot create courses or set fees."}</p><Link className="primary-button" href={`/${lang}/programs`}>{zh ? "选择课程" : "Choose course"} →</Link></section></div>
    <section className="lingo-pricing-grid">{SMARTLINGO_COURSE_PACKAGES.map((plan, index) => <article key={plan.tier} className={index === 1 ? "featured" : ""}><span>${plan.monthlyPriceCents / 100} / {zh ? "月" : "month"}</span><h2>{plan.name[lang]}</h2><p>{zh ? "第一个月免费；之后按月续订。" : "The first month is free; monthly renewal follows."}</p><ul>{plan.features[lang].map(item => <li key={item}>{item}</li>)}</ul><Link href={`/${lang}/programs`}>{zh ? "选择语言" : "Choose language"} →</Link></article>)}</section>
    <section className="ai-pricing-note"><div><span>30</span></div><article><h2>{zh ? "免费首月由服务器记录" : "The free first month is server-recorded"}</h2><p>{zh ? "开通时建立 30 天试用订阅，不会向课程管理员分账。试用结束后需保持有效月费订阅才能继续使用课程和教室。" : "Starting a course creates a 30-day trial subscription with no course-owner payout. After the trial, an active monthly subscription is required for course and classroom access."}</p></article></section>
    <SiteFooter lang={lang}/>
  </main>;
}
