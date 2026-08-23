import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/SiteHeader";
import { AssistantClient } from "../../../components/AssistantClient";
import { isSmartLingoCommunityLanguage, SMARTLINGO_LANGUAGE_COMMUNITIES } from "../../../lib/smartlingo-language-communities";
import "./composer-bottom.css";

export const dynamic = "force-dynamic";

export default async function AssistantPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ language?: string; mode?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query = await searchParams;
  const target = query.language && isSmartLingoCommunityLanguage(query.language)
    ? SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === query.language)
    : undefined;
  return <main className="assistant-page" data-layout-page="assistant"><SiteHeader lang={lang as any}/><AssistantClient lang={lang as any} targetLanguage={target?.code} speechLocale={target?.speechLocale} mode={query.mode}/></main>;
}
