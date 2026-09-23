"use client";

import Link from "next/link";
import { interfaceText } from "../lib/interface-locale";
import type { SiteLanguage } from "../lib/site-locale";
import { SMARTLINGO_COURSE_PACKAGES, fixedCourseId } from "../lib/smartlingo-course-packages";
import type { SmartLingoCommunityLanguage } from "../lib/smartlingo-language-communities";
import { languageCatalogEntry } from "../lib/smartlingo-paths";

export function LanguageSubscriptionCatalog({ lang, language }: { lang: SiteLanguage; language: SmartLingoCommunityLanguage }) {
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  return <section className="sl-package-catalog" data-layout-fill="course-levels">
    <header>
      <p className="section-kicker">{t("YOUR STARTING POINT", "找到适合您的起点")}</p>
      <h2>{t("Find your level, then start learning", "先测评，再从合适的起点学习")}</h2>
      <p>{t("Our free five-skill placement recommends Beginner, Intermediate, or Advanced. You can change the recommendation. Taking the placement or viewing a course never starts your Max trial.", "免费五项技能测评会推荐初级、中级或高级；您也可以改选。参加测评或查看课程都不会启动 Max 试用。")}</p>
    </header>
    <Link className="primary-button sl-placement-cta" href={`/${lang}/classes/${languageCatalogEntry(language)!.classId}/placement`}>{t("Find my starting point", "测出我的学习起点")} →</Link>
    <details className="sl-level-chooser"><summary>{t("Browse or choose a level myself", "浏览课程或自行选择等级")}</summary><div className="sl-subscription-grid">{SMARTLINGO_COURSE_PACKAGES.map(course => <article key={course.tier}>
      <span>{course.level}</span><h3>{t(course.name.en, course.name.zh)}</h3>
      <ul>{course.features.en.map((feature, index) => <li key={feature}>✓ {t(feature, course.features.zh[index])}</li>)}</ul>
      <Link className="secondary-button" href={`/${lang}/classes/${fixedCourseId(language, course.tier)}`}>{t("View course", "查看课程")} →</Link>
    </article>)}</div></details>
    <section className="sl-max-cta" aria-labelledby="sl-max-heading">
      <div><p className="section-kicker">SMARTLINGO MAX</p><h2 id="sl-max-heading">{t("Beginner free. Max for higher levels.", "初级免费，Max 学习更高等级。")}</h2><p>{t("Learn Beginner free with ads. A 7-day Max trial starts only if you explicitly choose to begin an Intermediate or Advanced course. After it ends, choose Max for ad-free higher-level access. Max is $119 for 6 months or $199 annually.", "初级课程可带广告免费学习。仅当您明确选择开始中级或高级课程时，才会启动一次 7 天 Max 试用；试用结束后选择 Max，即可无广告继续更高等级。Max 为 6 个月 $119 或年度 $199。")}</p></div>
      <Link className="primary-button" href={`/${lang}/pricing`}>{t("See Free and Max", "查看免费与 Max")} →</Link>
    </section>
    <style>{`.sl-package-catalog{width:min(1200px,calc(100% - 40px));margin:0 auto;padding:70px 0 100px}.sl-package-catalog>header h2{margin:8px 0 14px;font:600 clamp(34px,4.5vw,58px)/1.05 "Iowan Old Style","Noto Serif SC",Georgia,serif}.sl-package-catalog>header>p:last-child{max-width:76ch;color:var(--muted);line-height:1.7}.sl-placement-cta{display:inline-flex;margin-top:24px}.sl-level-chooser{margin-top:32px}.sl-level-chooser summary{width:max-content;max-width:100%;font-weight:800;cursor:pointer;text-decoration:underline;text-underline-offset:4px}.sl-subscription-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:24px}.sl-subscription-grid>article{min-width:0;padding:28px;display:flex;flex-direction:column;border:1px solid rgba(18,32,42,.14);border-radius:20px;background:#fffaf0}.sl-subscription-grid>article:nth-child(2){background:#eef8f3;border-color:#9fd5c0}.sl-subscription-grid>article>span{color:var(--vermillion);font-weight:900}.sl-subscription-grid h3{margin:12px 0 18px;font-size:30px}.sl-subscription-grid ul{margin:4px 0 28px;padding:0;display:grid;gap:10px;list-style:none;color:var(--muted)}.sl-subscription-grid .secondary-button{margin-top:auto;text-align:center}.sl-max-cta{width:100%;margin-top:28px;padding:32px 38px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;border:1px solid #a8cbe0;border-radius:22px;background:#eaf6ff}.sl-max-cta h2{margin:8px 0 10px;font-size:clamp(30px,4vw,46px)}.sl-max-cta p:last-child{max-width:74ch;margin:0;color:#53666f;line-height:1.65}.sl-max-cta .primary-button{white-space:normal;text-align:center}@media(max-width:900px){.sl-subscription-grid{grid-template-columns:1fr}.sl-max-cta{grid-template-columns:1fr}.sl-max-cta .primary-button{width:100%}}@media(max-width:540px){.sl-package-catalog{width:calc(100% - 28px);padding-top:52px}.sl-placement-cta{width:100%;justify-content:center}.sl-subscription-grid>article{padding:20px}.sl-max-cta{padding:24px 20px}}`}</style>
  </section>;
}
