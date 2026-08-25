import { notFound } from "next/navigation";
import { GameLanguagePicker } from "../../../../components/GameLanguagePicker";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { SmartCardChallengeCalendar } from "../../../../components/SmartCardChallengeCalendar";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../lib/smartlingo-language-communities";

export default async function SmartCardChallengePage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ language?: string; level?: string }> }) {
  const value = await params; if (value.lang !== "en" && value.lang !== "zh" && value.lang !== "es" && value.lang !== "ja" && value.lang !== "ko" && value.lang !== "fr" && value.lang !== "de" && value.lang !== "ru" && value.lang !== "it" && value.lang !== "pt" && value.lang !== "ar" && value.lang !== "hi") notFound(); const lang = value.lang; const zh = lang === "zh"; const query = await searchParams;
  const language = query.language && isSmartLingoCommunityLanguage(query.language) ? query.language : undefined;
  const level = query.level === "intermediate" || query.level === "advanced" ? query.level : "beginner";
  const selected = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === language);
  return <main className="daily-challenge"><SiteHeader lang={lang}/><section className="challenge-hero"><p>SMART CARD CHALLENGE · 500 × 3 LEVELS</p><h1>{zh ? "每天同一套 20 题，登上排行榜。" : "The same 20 daily questions. Rise on the leaderboard."}</h1><span>{selected ? (zh ? `${selected.nameZh} · ${level === "beginner" ? "初级" : level === "intermediate" ? "中级" : "高级"}挑战日历` : `${selected.nameEn} · ${level} challenge calendar`) : (zh ? "先选择挑战语言；点击语言默认进入初级。" : "Choose a language; its tile opens Beginner by default.")}</span></section>{language ? <SmartCardChallengeCalendar lang={lang === "zh" ? "zh" : "en"} targetLanguage={language} level={level}/> : <GameLanguagePicker lang={lang === "zh" ? "zh" : "en"} basePath={`/${lang}/play/challenge`}/>}<SiteFooter lang={lang}/><style>{`.daily-challenge{min-height:100vh;background:radial-gradient(circle at 85% 0,#eadcff,transparent 27%),#f7f3ea;color:#17302a}.challenge-hero{width:min(1080px,calc(100% - 32px));margin:auto;padding:90px 0 45px}.challenge-hero>p{color:#7555a6;font-size:12px;font-weight:950;letter-spacing:.14em}.challenge-hero h1{max-width:920px;margin:12px 0 18px;font:600 clamp(46px,7vw,84px)/.98 "Iowan Old Style","Noto Serif SC",serif}.challenge-hero>span{display:block;color:#60716b;font-size:18px}`}</style></main>;
}
