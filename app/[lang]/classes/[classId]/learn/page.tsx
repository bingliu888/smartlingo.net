import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LearningWorkspace } from "../../../../../components/LearningWorkspace";
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
    <main className="learning-page">
      <SiteHeader lang={lang} />
      <LearningWorkspace lang={lang} classId={classId} />
      <SiteFooter lang={lang} />
    </main>
  );
}
