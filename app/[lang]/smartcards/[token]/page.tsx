import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSmartCardChallenge } from "../../../../components/PublicSmartCardChallenge";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params; return { title: lang === "zh" ? "SmartCard 免费学习挑战" : "Free SmartCard learning challenge" };
}

export default async function PublicSmartCardPage({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang, token } = await params; if (lang !== "en" && lang !== "zh") notFound();
  return <PublicSmartCardChallenge lang={lang} token={token}/>;
}
