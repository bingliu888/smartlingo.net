import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnonymousBeginnerTrial } from "../../../../../../components/AnonymousBeginnerTrial";
import { SiteFooter } from "../../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../../components/SiteHeader";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../../../lib/smartlingo-language-communities";
import { buildDailyPracticeItem, getBeginnerSessionVocabularyDeck } from "../../../../../../lib/smartlingo-learning";

const SKILLS = ["vocabulary", "reading", "writing", "listening", "dialogue"] as const;
type Skill = (typeof SKILLS)[number];

export async function generateMetadata({ params }: { params: Promise<{ lang: string; skill: string }> }): Promise<Metadata> {
  const { lang, skill } = await params;
  const label = skill === "vocabulary" ? (lang === "zh" ? "词汇" : "Vocabulary") : skill;
  return { title: `${label} · ${lang === "zh" ? "免费试学" : "Free Trial"} · SmartLingo` };
}

export default async function CourseTrialSkillPage({ params }: { params: Promise<{ lang: string; classId: string; skill: string }> }) {
  const { lang, classId, skill } = await params;
  const match = /^course_([a-z]{2})_basic$/.exec(classId);
  const language = match?.[1] || "";
  if ((lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") || !isSmartLingoCommunityLanguage(language) || !SKILLS.includes(skill as Skill)) notFound();
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language)!;
  const date = new Date().toISOString().slice(0, 10);
  const taskSkills = ["reading", "writing", "listening", "dialogue"] as const;
  const cards = getBeginnerSessionVocabularyDeck(language, 1).map(card => ({ stableId: card.stableId, form: card.form, pronunciation: card.pronunciation, meaning: card.meaning }));
  const tasks = taskSkills.map(taskSkill => buildDailyPracticeItem(language, taskSkill, date, lang === "zh" ? "zh" : "en", "beginner"));
  return <main className="learning-page" data-layout-page="anonymous-course-trial"><SiteHeader lang={lang as any}/><AnonymousBeginnerTrial lang={lang as any} language={language} languageName={`${item.nativeName} · ${lang === "zh" ? item.nameZh : item.nameEn}`} speechLocale={item.speechLocale} direction={item.direction} cards={cards} tasks={tasks} initialSkill={skill as Skill} lockedSkill classId={classId}/><SiteFooter lang={lang as any}/></main>;
}
