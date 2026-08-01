import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlacementAssessment } from "../../../../../components/PlacementAssessment";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { requestUser } from "../../../../../lib/request-user";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "入班分级 · SmartLingo" : "Class placement · SmartLingo" };
}

export default async function PlacementPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "zh" && lang !== "en") notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/placement`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="placement-page">
      <SiteHeader lang={lang} />
      <PlacementAssessment lang={lang} classId={classId} />
      <SiteFooter lang={lang} />
    </main>
  );
}
