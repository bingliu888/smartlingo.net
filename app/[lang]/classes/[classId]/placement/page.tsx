import { notFound, redirect } from "next/navigation";
import { PlacementAssessment } from "../../../../../components/PlacementAssessment";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { requestUser } from "../../../../../lib/request-user";

export default async function PlacementPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/placement`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return <main className="learning-page" data-layout-page="placement">
    <SiteHeader lang={lang}/>
    <PlacementAssessment lang={lang === "zh" ? "zh" : "en"} routeLang={lang} classId={classId}/>
    <SiteFooter lang={lang}/>
  </main>;
}
