import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CardCheckoutComplete } from "@/components/CardCheckoutComplete";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { requestUser } from "@/lib/request-user";

export const metadata: Metadata = { title: "Card subscription · SmartLingo" };

export default async function CardCompletePage({ params, searchParams }: { params: Promise<{ lang: string; classId: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { lang, classId } = await params;
  const { session_id: sessionId } = await searchParams;
  if ((lang !== "en" && lang !== "zh") || !/^course_[a-z]{2}_(?:basic|intermediate|advanced)$/.test(classId) || !sessionId) notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/pay/card/complete?session_id=${encodeURIComponent(sessionId)}`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return <main className="billing-page"><SiteHeader lang={lang}/><CardCheckoutComplete lang={lang} classId={classId} sessionId={sessionId}/><SiteFooter lang={lang}/></main>;
}
