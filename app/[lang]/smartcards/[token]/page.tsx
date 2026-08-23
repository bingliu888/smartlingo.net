import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSmartCardChallenge } from "../../../../components/PublicSmartCardChallenge";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params; return { title: lang === "zh" ? "SmartCard 免费学习挑战" : "Free SmartCard learning challenge" };
}

export default async function PublicSmartCardPage({ params, searchParams }: { params: Promise<{ lang: string; token: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { lang, token } = await params; if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  return <PublicSmartCardChallenge lang={lang} token={token} gameMode={(await searchParams).mode === "challenge" ? "challenge" : "practice"}/>;
}
