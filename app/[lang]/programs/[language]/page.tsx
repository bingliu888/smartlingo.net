import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { interfaceText, isInterfaceLanguage, safeInterfaceLanguage } from "../../../../lib/interface-locale";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../lib/smartlingo-language-communities";
import { SMARTLINGO_COURSE_DURATIONS, SMARTLINGO_COURSE_PACKAGES, courseSubscriptionPackage, fixedCourseId } from "../../../../lib/smartlingo-course-packages";

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
    <section className="sl-package-catalog" data-layout-fill="course-packages">
      <header><p className="section-kicker">{interfaceText(locale, "9 FIXED-TERM PACKAGES", "9 个固定期限套餐")}</p><h2>{interfaceText(locale, "Choose a level and access period", "选择等级和学习期限")}</h2><p>{interfaceText(locale, "Pay once for 3, 6, or 12 months. There is no automatic renewal. Polygon USDT and GLC are available only for three-month packages.", "一次支付 3、6 或 12 个月费用，不会自动续费。Polygon USDT 和 GLC 仅用于三个月套餐。")}</p></header>
      <div>{SMARTLINGO_COURSE_PACKAGES.map(course => <article key={course.tier}>
        <span>{course.level}</span><h3>{interfaceText(locale, course.name.en, course.name.zh)}</h3>
        <ul>{course.features.en.map((feature, index) => <li key={feature}>✓ {interfaceText(locale, feature, course.features.zh[index])}</li>)}</ul>
        <nav aria-label={interfaceText(locale, `${course.name.en} package duration`, `${course.name.zh}套餐期限`)}>{SMARTLINGO_COURSE_DURATIONS.map(months => {
          const subscriptionPackage=courseSubscriptionPackage(course.tier,months)!;
          return <Link key={months} href={`/${locale}/classes/${fixedCourseId(language,course.tier)}?language=${language}&months=${months}`}>
            <span>{months} {interfaceText(locale,"months","个月")}</span><strong>${subscriptionPackage.priceCents/100}</strong>
            {months===3?<small>Polygon USDT · GLC</small>:<small>{interfaceText(locale,"Card payment","信用卡支付")}</small>}
          </Link>;
        })}</nav>
      </article>)}</div>
    </section>
    <SiteFooter lang={locale}/>
    <style>{`.sl-package-catalog{width:min(1200px,calc(100% - 40px));margin:0 auto;padding:70px 0 100px}.sl-package-catalog header{width:100%}.sl-package-catalog h2{margin:8px 0 14px;font:600 clamp(34px,4.5vw,58px)/1.05 "Iowan Old Style","Noto Serif SC",Georgia,serif}.sl-package-catalog header>p:last-child{color:var(--muted)}.sl-package-catalog>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:30px}.sl-package-catalog article{padding:28px;display:flex;flex-direction:column;border:1px solid rgba(18,32,42,.14);border-radius:20px;background:#fffaf0}.sl-package-catalog article:nth-child(2){background:#eef8f3;border-color:#9fd5c0}.sl-package-catalog article>span{color:var(--vermillion);font-weight:900}.sl-package-catalog h3{margin:12px 0 18px;font-size:30px}.sl-package-catalog ul{margin:4px 0 24px;padding:0;display:grid;gap:10px;list-style:none;color:var(--muted)}.sl-package-catalog nav{display:grid;gap:9px;margin-top:auto}.sl-package-catalog nav a{min-height:70px;padding:12px 15px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:3px 14px;border:1px solid #9fc7b9;border-radius:12px;background:#fff;color:var(--ink);text-decoration:none}.sl-package-catalog nav a:hover,.sl-package-catalog nav a:focus-visible{border-color:var(--jade);box-shadow:0 8px 20px rgba(8,125,98,.14);transform:translateY(-1px)}.sl-package-catalog nav a>span{font-weight:850}.sl-package-catalog nav a>strong{font-size:26px;color:var(--jade)}.sl-package-catalog nav a>small{grid-column:1/-1;color:var(--muted)}@media(max-width:820px){.sl-package-catalog>div{grid-template-columns:1fr}.sl-package-catalog{width:calc(100% - 28px)}}`}</style>
  </main>;
}
