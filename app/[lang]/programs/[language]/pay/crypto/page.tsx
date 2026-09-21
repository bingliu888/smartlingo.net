import { notFound, redirect } from "next/navigation";
import { isInterfaceLanguage } from "@/lib/interface-locale";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export default async function LanguageCryptoPage({ params }: {
  params: Promise<{ lang: string; language: string }>;
}) {
  const { lang, language } = await params;
  if (!isInterfaceLanguage(lang) || !isSmartLingoCommunityLanguage(language)) notFound();
  redirect(`/${lang}/pricing`);
}
