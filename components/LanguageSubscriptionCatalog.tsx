"use client";

import Link from "next/link";
import { interfaceText } from "../lib/interface-locale";
import type { SiteLanguage } from "../lib/site-locale";
import { SMARTLINGO_COURSE_PACKAGES, fixedCourseId } from "../lib/smartlingo-course-packages";
import type { SmartLingoCommunityLanguage } from "../lib/smartlingo-language-communities";

export function LanguageSubscriptionCatalog({ lang, language }: { lang: SiteLanguage; language: SmartLingoCommunityLanguage }) {
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  return <section className="sl-package-catalog" data-layout-fill="course-levels">
    <header>
      <p className="section-kicker">{t("THREE COURSE LEVELS · ONE MAX PLAN", "三级课程 · 一个 MAX 方案")}</p>
      <h2>{t("Choose any level with Max", "使用 Max 选择任意课程等级")}</h2>
      <p>{t("Courses keep their Beginner, Intermediate, and Advanced learning design without separate payment products. Beginner is always free; entering Intermediate or Advanced starts one 7-day Max trial, and active Max is required after it ends.", "课程继续保留初级、中级和高级的教学设计，且不再分别收费。初级永久免费；首次进入中级或高级会开始一次 7 天 Max 试用，到期后需有效 Max 才能继续。")}</p>
    </header>
    <div className="sl-subscription-grid">{SMARTLINGO_COURSE_PACKAGES.map(course => <article key={course.tier}>
      <span>{course.level}</span><h3>{t(course.name.en, course.name.zh)}</h3>
      <ul>{course.features.en.map((feature, index) => <li key={feature}>✓ {t(feature, course.features.zh[index])}</li>)}</ul>
      <Link className="secondary-button" href={`/${lang}/classes/${fixedCourseId(language, course.tier)}`}>{t("View course", "查看课程")} →</Link>
    </article>)}</div>
    <section className="sl-max-cta" aria-labelledby="sl-max-heading">
      <div><p className="section-kicker">SMARTLINGO MAX</p><h2 id="sl-max-heading">{t("Beginner free. Max for higher levels.", "初级免费，Max 学习更高等级。")}</h2><p>{t("Learn Beginner free with ads. Your first Intermediate or Advanced visit starts one 7-day Max trial; after it ends, choose Max for ad-free higher-level access. Max is $59 for 6 months or $99 annually.", "初级课程可带广告免费学习。首次进入中级或高级会开始一次 7 天 Max 试用；试用结束后选择 Max，即可无广告继续更高等级。Max 为 6 个月 $59 或年度 $99。")}</p></div>
      <Link className="primary-button" href={`/${lang}/pricing`}>{t("See Free and Max", "查看免费与 Max")} →</Link>
    </section>
    <style>{`.sl-package-catalog{width:min(1200px,calc(100% - 40px));margin:0 auto;padding:70px 0 100px}.sl-package-catalog>header h2{margin:8px 0 14px;font:600 clamp(34px,4.5vw,58px)/1.05 "Iowan Old Style","Noto Serif SC",Georgia,serif}.sl-package-catalog>header>p:last-child{max-width:76ch;color:var(--muted);line-height:1.7}.sl-subscription-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:30px}.sl-subscription-grid>article{min-width:0;padding:28px;display:flex;flex-direction:column;border:1px solid rgba(18,32,42,.14);border-radius:20px;background:#fffaf0}.sl-subscription-grid>article:nth-child(2){background:#eef8f3;border-color:#9fd5c0}.sl-subscription-grid>article>span{color:var(--vermillion);font-weight:900}.sl-subscription-grid h3{margin:12px 0 18px;font-size:30px}.sl-subscription-grid ul{margin:4px 0 28px;padding:0;display:grid;gap:10px;list-style:none;color:var(--muted)}.sl-subscription-grid .secondary-button{margin-top:auto;text-align:center}.sl-max-cta{width:100%;margin-top:28px;padding:32px 38px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;border:1px solid #a8cbe0;border-radius:22px;background:#eaf6ff}.sl-max-cta h2{margin:8px 0 10px;font-size:clamp(30px,4vw,46px)}.sl-max-cta p:last-child{max-width:74ch;margin:0;color:#53666f;line-height:1.65}.sl-max-cta .primary-button{white-space:normal;text-align:center}@media(max-width:900px){.sl-subscription-grid{grid-template-columns:1fr}.sl-max-cta{grid-template-columns:1fr}.sl-max-cta .primary-button{width:100%}}@media(max-width:540px){.sl-package-catalog{width:calc(100% - 28px);padding-top:52px}.sl-subscription-grid>article{padding:20px}.sl-max-cta{padding:24px 20px}}`}</style>
  </section>;
}
