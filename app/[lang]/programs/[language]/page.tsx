import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningPathPlanner } from "../../../../components/LearningPathPlanner";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../lib/smartlingo-language-communities";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; language: string }> }): Promise<Metadata> {
  const { lang, language } = await params;
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language);
  return { title: item ? `${lang === "zh" ? item.nameZh : item.nameEn} · ${lang === "zh" ? "课程详情" : "Course details"}` : "SmartLingo" };
}

export default async function CourseLanguagePage({ params }: { params: Promise<{ lang: string; language: string }> }) {
  const { lang, language } = await params;
  if ((lang !== "en" && lang !== "zh") || !isSmartLingoCommunityLanguage(language)) notFound();
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language)!;
  return <main className="ai-cert-public-page lingo-public-page" data-layout-page="program-detail">
    <SiteHeader lang={lang}/>
    <section className="ai-public-hero" data-layout-fill="program-detail-hero">
      <p className="section-kicker">{language.toUpperCase()} · {lang === "zh" ? "课程详情" : "COURSE DETAILS"}</p>
      <h1>{item.nativeName} · {lang === "zh" ? item.nameZh : item.nameEn}</h1>
      <p>{lang === "zh" ? "查看课程内容、选择学习目标与起点；确认前不会自动加入课程。" : "Review the course, choose your goal and starting point. You will not be enrolled until you confirm."}</p>
      <Link className="secondary-button" href={`/${lang}/programs`}>← {lang === "zh" ? "返回选择课程" : "Back to courses"}</Link>
    </section>
    <LearningPathPlanner lang={lang} initialLanguage={language}/>
    <SiteFooter lang={lang}/>
  </main>;
}
