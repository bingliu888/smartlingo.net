import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { LanguageSubscriptionCatalog } from "../../../../components/LanguageSubscriptionCatalog";
import { interfaceText, isInterfaceLanguage, safeInterfaceLanguage } from "../../../../lib/interface-locale";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../lib/smartlingo-language-communities";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; language: string }> }): Promise<Metadata> {
  const { lang, language } = await params;
  const locale = safeInterfaceLanguage(lang);
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language);
  return { title: item ? `${item.nativeName} · ${interfaceText(locale, "Course details", "课程详情")}` : "SmartLingo" };
}

export default async function CourseLanguagePage({ params }: { params: Promise<{ lang: string; language: string }> }) {
  const { lang, language } = await params;
  if (!isInterfaceLanguage(lang) || !isSmartLingoCommunityLanguage(language)) notFound();
  const locale = safeInterfaceLanguage(lang);
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language)!;
  return <main className="ai-cert-public-page lingo-public-page" data-layout-page="program-detail">
    <div className="ai-public-hero-shell" data-layout-fill="program-detail-hero-shell">
      <SiteHeader lang={locale}/>
      <section className="ai-public-hero" data-layout-fill="program-detail-hero">
        <p className="section-kicker">{language.toUpperCase()} · {interfaceText(locale, "COURSE DETAILS", "课程详情")}</p>
        <h1>{item.nativeName}</h1>
        <p>{interfaceText(locale, "You chose the learning language. Now choose one of nine fixed-term packages; every package opens that language course and its dedicated A/V webinar classroom.", "您已选择学习语言。现在从九个固定期限套餐中选择一个；每个套餐都会开通该语言课程及其专属音视频网络研讨会教室。")}</p>
        <div className="ai-cert-actions" data-layout-track="program-detail-actions"><Link className="primary-button" href={`/${locale}/play?language=${language}`}>▶ {interfaceText(locale, "Free to Play", "免费游戏")}</Link><Link className="secondary-button" href={`/${locale}/programs/${language}/trial`}>{interfaceText(locale, "Free Trial", "免费试学")}</Link><Link className="secondary-button" href={`/${locale}/play/everyday?language=${language}`}>☀ {interfaceText(locale, "Everyday Speaking", "生活口语")}</Link></div>
      </section>
    </div>
    <LanguageSubscriptionCatalog lang={locale} language={language}/>
    <SiteFooter lang={locale}/>
  </main>;
}
