import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/SiteHeader";
import { AssistantClient } from "../../../components/AssistantClient";
import { isSmartLingoCommunityLanguage, SMARTLINGO_LANGUAGE_COMMUNITIES } from "../../../lib/smartlingo-language-communities";
import { smartLingoAiStudyPartner } from "../../../lib/smartlingo-ai-study-partners";
import "./composer-bottom.css";

export const dynamic = "force-dynamic";

export default async function AssistantPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ language?: string; mode?: string; partner?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query = await searchParams;
  const target = query.language && isSmartLingoCommunityLanguage(query.language)
    ? SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === query.language)
    : undefined;
  const partner = smartLingoAiStudyPartner(query.partner);
  return <main className="assistant-page" data-layout-page="assistant"><SiteHeader lang={lang}/><AssistantClient lang={lang} targetLanguage={target?.code} speechLocale={target?.speechLocale} mode={query.mode} partner={partner?.id}/></main>;
}
