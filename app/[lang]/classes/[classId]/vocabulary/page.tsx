import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { VocabularyMemoryWorkspace } from "../../../../../components/VocabularyMemoryWorkspace";
import { requestUser } from "../../../../../lib/request-user";
import { interfaceText, safeInterfaceLanguage } from "../../../../../lib/interface-locale";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = safeInterfaceLanguage(lang);
  return { title: interfaceText(locale, "21-day vocabulary memory · SmartLingo", "21 天词汇记忆 · SmartLingo") };
}

export default async function VocabularyPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/vocabulary`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return <main className="vocabulary-memory-page" data-layout-page="vocabulary-memory">
    <SiteHeader lang={lang}/>
    <VocabularyMemoryWorkspace lang={safeInterfaceLanguage(lang)} classId={classId}/>
    <SiteFooter lang={lang}/>
  </main>;
}
