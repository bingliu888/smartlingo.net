import { notFound, redirect } from "next/navigation";
import { CollegeCoordinatorComplete } from "../../../../../components/CollegeCoordinatorComplete";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { isInterfaceLanguage } from "../../../../../lib/interface-locale";
import { requestUser } from "../../../../../lib/request-user";

export default async function CollegeCoordinatorCompletePage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { lang } = await params; const { session_id: sessionId } = await searchParams;
  if (!isInterfaceLanguage(lang) || !sessionId) notFound();
  if (!await requestUser()) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/colleges/mine/complete?session_id=${sessionId}`)}`);
  return <main className="college-complete-page"><SiteHeader lang={lang}/><CollegeCoordinatorComplete lang={lang} sessionId={sessionId}/><SiteFooter lang={lang}/></main>;
}
