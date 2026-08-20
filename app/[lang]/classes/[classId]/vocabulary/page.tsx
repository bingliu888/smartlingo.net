import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { VocabularyMemoryWorkspace } from "../../../../../components/VocabularyMemoryWorkspace";
import { requestUser } from "../../../../../lib/request-user";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "21 天词汇记忆 · SmartLingo" : "21-day vocabulary memory · SmartLingo" };
}

export default async function VocabularyPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "zh" && lang !== "en") notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/vocabulary`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return <main className="vocabulary-memory-page">
    <SiteHeader lang={lang}/>
    <VocabularyMemoryWorkspace lang={lang} classId={classId}/>
    <SiteFooter lang={lang}/>
  </main>;
}
