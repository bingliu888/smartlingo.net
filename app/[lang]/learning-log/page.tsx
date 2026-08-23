import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LearningWorkspace } from "../../../components/LearningWorkspace";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { requestUser } from "../../../lib/request-user";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "学习日历 · SmartLingo" : "Learning calendar · SmartLingo" };
}

export default async function LearningLogPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ classId?: string }>;
}) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query = await searchParams;
  if (!await requestUser()) {
    const returnTo = `/${lang}/learning-log${query.classId ? `?classId=${encodeURIComponent(query.classId)}` : ""}`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="learning-page">
      <SiteHeader lang={lang as any} />
      <LearningWorkspace lang={lang as any} classId={query.classId || ""} calendarOnly />
      <SiteFooter lang={lang as any} />
    </main>
  );
}
