import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LearningWorkspace } from "../../../../../../components/LearningWorkspace";
import { SiteFooter } from "../../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../../components/SiteHeader";
import { requestUser } from "../../../../../../lib/request-user";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "五项技能训练 · SmartLingo" : "Five-skill training · SmartLingo" };
}

export default async function LearningSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; classId: string }>;
  searchParams: Promise<{ training?: string }>;
}) {
  const { lang, classId } = await params;
  const query = await searchParams;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/learn/session`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="learning-page" data-layout-page="learning-session">
      <SiteHeader lang={lang as any} />
      <LearningWorkspace
        lang={lang as any}
        classId={classId}
        view="session"
        initialSkill={query.training === "quiz" ? "exam" : query.training === "dialogue" ? "dialogue" : query.training === "vocabulary" ? "vocabulary" : query.training === "writing" ? "writing" : query.training === "listening" ? "listening" : undefined}
      />
      <SiteFooter lang={lang as any} />
    </main>
  );
}
