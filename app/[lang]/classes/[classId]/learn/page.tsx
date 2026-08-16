import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearningWorkspace } from "../../../../../components/LearningWorkspace";
import { CourseClassroomTile } from "../../../../../components/CourseClassroomTile";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { requestUser } from "../../../../../lib/request-user";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "每日学习 · SmartLingo" : "Daily learning · SmartLingo" };
}

export default async function LearnPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "zh" && lang !== "en") notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/learn`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="learning-page" data-layout-page="learning">
      <SiteHeader lang={lang} />
      <section className="daily-practice-modes" aria-labelledby="daily-practice-modes-title">
        <header><p>{lang === "zh" ? "每日练习" : "DAILY PRACTICE"}</p><h1 id="daily-practice-modes-title">{lang === "zh" ? "选择训练方式" : "Choose your training"}</h1><span>{lang === "zh" ? "先掌握词汇，再把它带进真实对话。" : "Build vocabulary, then bring it into real conversation."}</span></header>
        <Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn/session?training=vocabulary`}><i aria-hidden="true">Aa</i><strong>Vocab</strong><small>{lang === "zh" ? "词卡 · 主动回忆 · 连续掌握" : "Flashcards · active recall · mastery"}</small><b>{lang === "zh" ? "开始词汇训练" : "Start vocab"} →</b></Link>
        <Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn/session?training=dialogue`}><i aria-hidden="true">◉</i><strong>Speaking</strong><small>{lang === "zh" ? "人工智能导师 · 情景对话 · 即时反馈" : "AI tutor · role-play · instant feedback"}</small><b>{lang === "zh" ? "开始口语训练" : "Start speaking"} →</b></Link>
      </section>
      <LearningWorkspace lang={lang} classId={classId} />
      <CourseClassroomTile lang={lang} classId={classId} compact />
      <SiteFooter lang={lang} />
      <style>{`.daily-practice-modes{width:min(1200px,calc(100% - 40px));margin:44px auto 18px;padding:28px;display:grid;grid-template-columns:minmax(220px,.9fr) repeat(2,minmax(220px,1fr));gap:14px;border-radius:24px;background:#123f35;color:#fff}.daily-practice-modes header{padding:10px 18px 10px 0}.daily-practice-modes header p{margin:0;color:#63d4b0;font-size:12px;font-weight:900;letter-spacing:.12em}.daily-practice-modes h1{margin:10px 0;font-size:clamp(28px,3.5vw,44px)}.daily-practice-modes header span{color:#c5d8d1;line-height:1.55}.daily-practice-modes>a{padding:20px;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(255,255,255,.06);color:#fff}.daily-practice-modes i{width:48px;height:48px;display:grid;place-items:center;border-radius:13px;background:#62dab5;color:#123f35;font-style:normal;font-weight:900}.daily-practice-modes strong{margin-top:18px;font-size:27px}.daily-practice-modes small{margin:8px 0 20px;color:#bfd1cb;line-height:1.5}.daily-practice-modes b{margin-top:auto;color:#67dbb8;font-size:13px}@media(max-width:850px){.daily-practice-modes{grid-template-columns:1fr 1fr}.daily-practice-modes header{grid-column:1/-1}}@media(max-width:560px){.daily-practice-modes{width:calc(100% - 28px);grid-template-columns:1fr;padding:18px}.daily-practice-modes header{grid-column:auto}}`}</style>
    </main>
  );
}
