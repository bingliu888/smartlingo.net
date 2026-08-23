import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LearningWorkspace } from "../../../../../components/LearningWorkspace";
import { CourseClassroomTile } from "../../../../../components/CourseClassroomTile";
import { CourseTrainingMenu } from "../../../../../components/CourseTrainingMenu";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { requestUser } from "../../../../../lib/request-user";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "每日学习 · SmartLingo" : "Daily learning · SmartLingo" };
}

export default async function LearnPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/learn`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="learning-page" data-layout-page="learning">
      <SiteHeader lang={lang as any} />
      <CourseTrainingMenu lang={lang as any} classId={classId}/>
      <LearningWorkspace lang={lang as any} classId={classId} />
      <CourseClassroomTile lang={lang as any} classId={classId} compact />
      <SiteFooter lang={lang as any} />
    </main>
  );
}
