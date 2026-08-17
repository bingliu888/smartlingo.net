import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CryptoCheckout from "@/components/CryptoCheckout";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { CryptoPlanId } from "@/lib/crypto-contract";
import { requestUser } from "@/lib/request-user";

export const metadata: Metadata = { title: "Course crypto payment · SmartLingo" };

export default async function CourseCryptoPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const match = /^course_([a-z]{2})_(basic|intermediate|advanced)$/.exec(classId);
  if (!match) notFound();
  if (!await requestUser()) {
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}/pay/crypto`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return <main className="billing-page"><SiteHeader lang={lang}/><CryptoCheckout initialPlan={match[2] as CryptoPlanId} initialLanguageCode={match[1]} lockedCourseId={classId} lang={lang}/><SiteFooter lang={lang}/></main>;
}
