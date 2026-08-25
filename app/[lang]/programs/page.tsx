import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { LearningPathPlanner } from "../../../components/LearningPathPlanner";
import { interfaceText, isInterfaceLanguage, safeInterfaceLanguage } from "../../../lib/interface-locale";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = safeInterfaceLanguage(lang);
  return { title: interfaceText(locale, "Language learning paths", "语言学习路径") };
}

export default async function ProgramsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const locale = safeInterfaceLanguage(lang);
  const t = {
    title: interfaceText(locale, "Build usable vocabulary, reading, writing, listening, and dialogue.", "建立真正可用的词汇、阅读、写作、听力与对话能力。"),
    intro: interfaceText(locale, "Choose one of twelve target languages, set a goal and daily time, then start with fundamentals, a self-reported level, or a transparent adaptive placement.", "从十二种目标语言中选择一门，设定使用场景与每日时长，再从基础、自报水平或透明的自适应分级开始。"),
    start: interfaceText(locale, "Choose a language", "选择学习语言"),
    guide: interfaceText(locale, "Ask Guru for guidance", "向智能导师咨询"),
  };
  return <main className="ai-cert-public-page lingo-public-page" data-layout-page="programs">
    <div className="ai-public-hero-shell" data-layout-fill="programs-hero-shell"><SiteHeader lang={locale}/><section className="ai-public-hero"><p className="section-kicker">SMARTLINGO · {interfaceText(locale, "CHOOSE COURSE", "选择课程")}</p><h1 data-layout-text-fit="programs-title">{t.title}</h1><p data-readable-copy="programs-hero-copy">{t.intro}</p><div className="ai-cert-actions" data-layout-track="programs-actions"><Link className="primary-button" href="#language-catalog">{t.start} →</Link><Link className="secondary-button" href={`/${locale}/assistant`}>{t.guide}</Link></div></section></div>
    <LearningPathPlanner lang={locale} catalogOnly/>
    <SiteFooter lang={locale}/>
  </main>;
}
