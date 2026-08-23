import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { interfaceText, isInterfaceLanguage, safeInterfaceLanguage } from "../../../../lib/interface-locale";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../lib/smartlingo-language-communities";
import { SMARTLINGO_COURSE_PACKAGES, fixedCourseId } from "../../../../lib/smartlingo-course-packages";

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
        <p>{interfaceText(locale, "Choose a fixed monthly course. Every plan includes a free first month and a dedicated A/V webinar classroom.", "选择固定月费课程。每个方案首月免费，并包含专属音视频网络研讨会教室。")}</p>
        <div className="ai-cert-actions" data-layout-track="program-detail-actions"><Link className="primary-button" href={`/${locale}/play?language=${language}`}>▶ {interfaceText(locale, "Free to Play", "免费游戏")}</Link><Link className="secondary-button" href={`/${locale}/programs/${language}/trial`}>{interfaceText(locale, "Free Trial", "免费试学")}</Link><Link className="secondary-button" href={`/${locale}/play/everyday?language=${language}`}>☀ {interfaceText(locale, "Everyday Speaking", "生活口语")}</Link></div>
      </section>
    </div>
    <section className="sl-package-catalog" data-layout-fill="course-packages">
      <header><p className="section-kicker">{interfaceText(locale, "FIRST MONTH FREE", "首月免费")}</p><h2>{interfaceText(locale, "Choose your course level", "选择课程等级")}</h2><p>{interfaceText(locale, "Fixed monthly pricing with no member-created courses or custom fees.", "固定月费，无会员自建课程或自定义收费。")}</p></header>
      <div>{SMARTLINGO_COURSE_PACKAGES.map(course => <article key={course.tier}>
        <span>{course.level}</span><h3>{interfaceText(locale, course.name.en, course.name.zh)}</h3>
        <strong>${(course.monthlyPriceCents / 100).toFixed(0)}<small> / {interfaceText(locale, "month", "月")}</small></strong>
        <b>{interfaceText(locale, "First month free", "第一个月免费")}</b>
        <ul>{course.features.en.map((feature, index) => <li key={feature}>✓ {interfaceText(locale, feature, course.features.zh[index])}</li>)}</ul>
        <Link className="primary-button" href={`/${locale}/classes/${fixedCourseId(language, course.tier)}`}>{interfaceText(locale, "View and subscribe", "查看并订阅")} →</Link>
      </article>)}</div>
    </section>
    <SiteFooter lang={locale}/>
    <style>{`.sl-package-catalog{width:min(1200px,calc(100% - 40px));margin:0 auto;padding:70px 0 100px}.sl-package-catalog header{width:100%}.sl-package-catalog h2{margin:8px 0 14px;font:600 clamp(34px,4.5vw,58px)/1.05 "Iowan Old Style","Noto Serif SC",Georgia,serif}.sl-package-catalog header>p:last-child{color:var(--muted)}.sl-package-catalog>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:30px}.sl-package-catalog article{padding:28px;display:flex;flex-direction:column;border:1px solid rgba(18,32,42,.14);border-radius:20px;background:#fffaf0}.sl-package-catalog article:nth-child(2){background:#eef8f3;border-color:#9fd5c0}.sl-package-catalog article>span{color:var(--vermillion);font-weight:900}.sl-package-catalog h3{margin:12px 0 18px;font-size:30px}.sl-package-catalog strong{font-size:40px}.sl-package-catalog strong small{font-size:14px;color:var(--muted)}.sl-package-catalog article>b{margin-top:8px;color:var(--jade)}.sl-package-catalog ul{margin:24px 0;padding:0;display:grid;gap:10px;list-style:none;color:var(--muted)}.sl-package-catalog a{width:100%;margin-top:auto;text-align:center}@media(max-width:820px){.sl-package-catalog>div{grid-template-columns:1fr}.sl-package-catalog{width:calc(100% - 28px)}}`}</style>
  </main>;
}
