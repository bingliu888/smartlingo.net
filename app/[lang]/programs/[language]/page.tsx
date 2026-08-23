import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../lib/smartlingo-language-communities";
import { SMARTLINGO_COURSE_PACKAGES, fixedCourseId } from "../../../../lib/smartlingo-course-packages";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; language: string }> }): Promise<Metadata> {
  const { lang, language } = await params;
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language);
  return { title: item ? `${lang === "zh" ? item.nameZh : item.nameEn} · ${lang === "zh" ? "课程详情" : "Course details"}` : "SmartLingo" };
}

export default async function CourseLanguagePage({ params }: { params: Promise<{ lang: string; language: string }> }) {
  const { lang, language } = await params;
  if ((lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") || !isSmartLingoCommunityLanguage(language)) notFound();
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language)!;
  return <main className="ai-cert-public-page lingo-public-page" data-layout-page="program-detail">
    <div className="ai-public-hero-shell" data-layout-fill="program-detail-hero-shell">
      <SiteHeader lang={lang}/>
      <section className="ai-public-hero" data-layout-fill="program-detail-hero">
        <p className="section-kicker">{language.toUpperCase()} · {lang === "zh" ? "课程详情" : "COURSE DETAILS"}</p>
        <h1>{item.nativeName} · {lang === "zh" ? item.nameZh : item.nameEn}</h1>
        <p>{lang === "zh" ? "选择固定月费课程。每个方案首月免费，并包含专属音视频网络研讨会教室。" : "Choose a fixed monthly course. Every plan includes a free first month and a dedicated A/V webinar classroom."}</p>
        <div className="ai-cert-actions" data-layout-track="program-detail-actions"><Link className="primary-button" href={`/${lang}/play?language=${language}`}>▶ {lang === "zh" ? "免费游戏" : "Free to Play"}</Link><Link className="secondary-button" href={`/${lang}/programs/${language}/trial`}>{lang === "zh" ? "免费试学" : "Free Trial"}</Link><Link className="secondary-button" href={`/${lang}/play/everyday?language=${language}`}>☀ {lang === "zh" ? "生活口语" : "Everyday Speaking"}</Link></div>
      </section>
    </div>
    <section className="sl-package-catalog" data-layout-fill="course-packages">
      <header><p className="section-kicker">{lang === "zh" ? "首月免费" : "FIRST MONTH FREE"}</p><h2>{lang === "zh" ? "选择课程等级" : "Choose your course level"}</h2><p>{lang === "zh" ? "固定月费，无会员自建课程或自定义收费。" : "Fixed monthly pricing with no member-created courses or custom fees."}</p></header>
      <div>{SMARTLINGO_COURSE_PACKAGES.map(course => <article key={course.tier}>
        <span>{course.level}</span><h3>{course.name[lang]}</h3>
        <strong>${(course.monthlyPriceCents / 100).toFixed(0)}<small> / {lang === "zh" ? "月" : "month"}</small></strong>
        <b>{lang === "zh" ? "第一个月免费" : "First month free"}</b>
        <ul>{course.features[lang].map(feature => <li key={feature}>✓ {feature}</li>)}</ul>
        <Link className="primary-button" href={`/${lang}/classes/${fixedCourseId(language, course.tier)}`}>{lang === "zh" ? "查看并订阅" : "View and subscribe"} →</Link>
      </article>)}</div>
    </section>
    <SiteFooter lang={lang}/>
    <style>{`.sl-package-catalog{width:min(1200px,calc(100% - 40px));margin:0 auto;padding:70px 0 100px}.sl-package-catalog header{width:100%}.sl-package-catalog h2{margin:8px 0 14px;font:600 clamp(34px,4.5vw,58px)/1.05 "Iowan Old Style","Noto Serif SC",Georgia,serif}.sl-package-catalog header>p:last-child{color:var(--muted)}.sl-package-catalog>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:30px}.sl-package-catalog article{padding:28px;display:flex;flex-direction:column;border:1px solid rgba(18,32,42,.14);border-radius:20px;background:#fffaf0}.sl-package-catalog article:nth-child(2){background:#eef8f3;border-color:#9fd5c0}.sl-package-catalog article>span{color:var(--vermillion);font-weight:900}.sl-package-catalog h3{margin:12px 0 18px;font-size:30px}.sl-package-catalog strong{font-size:40px}.sl-package-catalog strong small{font-size:14px;color:var(--muted)}.sl-package-catalog article>b{margin-top:8px;color:var(--jade)}.sl-package-catalog ul{margin:24px 0;padding:0;display:grid;gap:10px;list-style:none;color:var(--muted)}.sl-package-catalog a{width:100%;margin-top:auto;text-align:center}@media(max-width:820px){.sl-package-catalog>div{grid-template-columns:1fr}.sl-package-catalog{width:calc(100% - 28px)}}`}</style>
  </main>;
}
