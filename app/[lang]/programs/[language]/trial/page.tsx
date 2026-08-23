import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnonymousBeginnerTrial } from "../../../../../components/AnonymousBeginnerTrial";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../../lib/smartlingo-language-communities";
import { buildDailyPracticeItem, getBeginnerSessionVocabularyDeck } from "../../../../../lib/smartlingo-learning";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; language: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "初级课程免费试学 · SmartLingo" : "Free Beginner trial · SmartLingo" };
}

export default async function AnonymousTrialPage({ params }: { params: Promise<{ lang: string; language: string }> }) {
  const { lang, language } = await params;
  if ((lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") || !isSmartLingoCommunityLanguage(language)) notFound();
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language)!;
  const date = new Date().toISOString().slice(0, 10);
  const skills = ["reading", "writing", "listening", "dialogue"] as const;
  const cards = getBeginnerSessionVocabularyDeck(language, 1).map(card => ({ stableId: card.stableId, form: card.form, pronunciation: card.pronunciation, meaning: card.meaning }));
  const tasks = skills.map(skill => buildDailyPracticeItem(language, skill, date, lang === "zh" ? "zh" : "en", "beginner"));
  return <main className="learning-page" data-layout-page="anonymous-trial"><SiteHeader lang={lang as any}/><AnonymousBeginnerTrial lang={lang as any} language={language} languageName={`${item.nativeName} · ${lang === "zh" ? item.nameZh : item.nameEn}`} speechLocale={item.speechLocale} direction={item.direction} cards={cards} tasks={tasks}/><SiteFooter lang={lang as any}/></main>;
}
