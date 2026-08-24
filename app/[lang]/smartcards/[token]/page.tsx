import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSmartCardChallenge } from "../../../../components/PublicSmartCardChallenge";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params; return { title: lang === "zh" ? "SmartCard 免费学习挑战" : "Free SmartCard learning challenge" };
}

export default async function PublicSmartCardPage({ params, searchParams }: { params: Promise<{ lang: string; token: string }>; searchParams: Promise<{ mode?: string; day?: string }> }) {
  const { lang, token } = await params; if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query=await searchParams,rawDay=Number(query.day||1),dayNumber=Number.isInteger(rawDay)?Math.max(1,Math.min(21,rawDay)):1;
  return <PublicSmartCardChallenge lang={lang as any} token={token} dayNumber={query.day ? dayNumber : undefined} gameMode={query.mode === "challenge" ? "challenge" : "practice"}/>;
}
