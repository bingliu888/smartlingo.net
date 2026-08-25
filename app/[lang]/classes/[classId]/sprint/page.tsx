import { notFound, redirect } from "next/navigation";
import { DailySprint } from "../../../../../components/DailySprint";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { isInterfaceLanguage } from "../../../../../lib/interface-locale";
import { requestUser } from "../../../../../lib/request-user";
import { isPublicBeginnerSprintClassId } from "../../../../../lib/smartlingo-learning-access";

export default async function SprintPage({ params, searchParams }: {
  params: Promise<{ lang: string; classId: string }>;
  searchParams: Promise<{ minutes?: string; source?: string; day?: string; fresh?: string }>;
}) {
  const { lang, classId } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const query = await searchParams;
  const publicPlay = query.source === "play" || isPublicBeginnerSprintClassId(classId);
  if (!publicPlay && !await requestUser()) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/classes/${classId}/sprint`)}`);
  const value = Number(query.minutes || 10);
  const minutes = (value === 5 || value === 15 || value === 20 ? value : 10) as 5 | 10 | 15 | 20;
  const rawDay = query.day == null ? undefined : Number(query.day);
  const day = rawDay != null && Number.isInteger(rawDay) ? Math.max(1, Math.min(21, rawDay)) : undefined;
  return <main style={{ background: "radial-gradient(circle at 85% 0,#c8ffe7,transparent 25%),#f7f3ea" }}>
    <SiteHeader lang={lang}/>
    <DailySprint lang={lang} classId={classId} durationMinutes={minutes} dayNumber={day} publicPlay={publicPlay} freshAnonymous={query.fresh === "1"}/>
    <SiteFooter lang={lang}/>
  </main>;
}
