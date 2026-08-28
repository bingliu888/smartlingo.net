import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CryptoCheckout } from "@/components/CryptoCheckout";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isInterfaceLanguage, safeInterfaceLanguage } from "@/lib/interface-locale";
import type { CryptoPlanId } from "@/lib/crypto-contract";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export const metadata: Metadata = { title: "Course crypto payment · SmartLingo" };

export default async function LanguageCryptoPage({ params, searchParams }: {
  params: Promise<{ lang: string; language: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { lang, language } = await params;
  if (!isInterfaceLanguage(lang) || !isSmartLingoCommunityLanguage(language)) notFound();
  const locale = safeInterfaceLanguage(lang);
  const level = (await searchParams).level;
  const initialPlan: CryptoPlanId = level === "intermediate" || level === "advanced" ? level : "basic";
  return <main className="billing-page"><SiteHeader lang={locale}/><CryptoCheckout initialPlan={initialPlan} initialLanguageCode={language} lang={locale}/><SiteFooter lang={locale}/></main>;
}
