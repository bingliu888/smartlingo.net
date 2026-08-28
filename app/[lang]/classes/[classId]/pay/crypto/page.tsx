import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CryptoCheckout } from "@/components/CryptoCheckout";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { CryptoPlanId } from "@/lib/crypto-contract";
import { requestUser } from "@/lib/request-user";

export const metadata: Metadata = { title: "Course crypto payment · SmartLingo" };

export default async function CourseCryptoPage({ params,searchParams }: { params: Promise<{ lang: string; classId: string }>;searchParams:Promise<{language?:string;months?:string;supervisor?:string}> }) {
  const { lang, classId } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const match = /^course_([a-z]{2})_(basic|intermediate|advanced)$/.exec(classId);
  if (!match) notFound();
  const query=await searchParams;
  if((query.language&&query.language!==match[1])||(query.months&&query.months!=="3"))notFound();
  const supervisorRefId=/^[A-HJ-NP-Z2-9]{6}$/i.test(query.supervisor||"")?String(query.supervisor).toUpperCase():undefined;
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/pay/crypto?language=${match[1]}&months=3${supervisorRefId?`&supervisor=${encodeURIComponent(supervisorRefId)}`:""}`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return <main className="billing-page"><SiteHeader lang={lang}/><CryptoCheckout initialPlan={match[2] as CryptoPlanId} initialLanguageCode={match[1]} lockedCourseId={classId} lang={lang} supervisorRefId={supervisorRefId}/><SiteFooter lang={lang}/></main>;
}
