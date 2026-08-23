import Link from "next/link";
import { notFound } from "next/navigation";
import { EverydaySpeakingPlayer } from "../../../../components/EverydaySpeakingPlayer";
import { GameLanguagePicker } from "../../../../components/GameLanguagePicker";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { buildEverydaySpeakingDeck, isSmartLingoEverydayScenario, SMARTLINGO_EVERYDAY_SCENARIOS } from "../../../../lib/smartlingo-everyday-speaking";
import { isSmartLingoCommunityLanguage, SMARTLINGO_LANGUAGE_COMMUNITIES } from "../../../../lib/smartlingo-language-communities";
import "./everyday.css";
import "./standard-links.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: lang === "zh" ? "生活口语 · SmartLingo" : "Everyday speaking · SmartLingo" };
}

export default async function EverydaySpeakingPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ language?: string; scene?: string }>;
}) {
  const { lang: rawLang } = await params;
  if (rawLang !== "en" && rawLang !== "zh" && rawLang !== "es" && rawLang !== "ja" && rawLang !== "ko" && rawLang !== "fr" && rawLang !== "de" && rawLang !== "ru" && rawLang !== "it" && rawLang !== "pt" && rawLang !== "ar" && rawLang !== "hi") notFound();
  const lang = rawLang;
  const zh = lang === "zh";
  const query = await searchParams;
  const language = query.language && isSmartLingoCommunityLanguage(query.language) ? query.language : undefined;
  const selected = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === language);
  const sceneId = query.scene && isSmartLingoEverydayScenario(query.scene) ? query.scene : undefined;
  const scene = SMARTLINGO_EVERYDAY_SCENARIOS.find(item => item.id === sceneId);

  if (language && selected && scene) return <main className="everyday-page everyday-player-page">
    <SiteHeader lang={lang as any}/>
    <EverydaySpeakingPlayer
      lang={lang as any}
      language={language}
      languageName={`${selected.nativeName} · ${zh ? selected.nameZh : selected.nameEn}`}
      speechLocale={selected.speechLocale}
      direction={selected.direction}
      scene={scene}
      slides={buildEverydaySpeakingDeck(language, scene.id)}
    />
    <SiteFooter lang={lang as any}/>
  </main>;

  return <main className="everyday-page">
    <SiteHeader lang={lang as any}/>
    <section className="everyday-hero" data-layout-fill="everyday-speaking-hero">
      <p>REAL LIFE · LISTEN · SPEAK</p>
      <h1>{zh ? "生活口语，从真实的一天开始。" : "Everyday speaking starts with real life."}</h1>
      <span>{selected
        ? (zh ? `已选择${selected.nameZh}。选择一个场景，进入 12 张自动听说幻灯片。` : `${selected.nameEn} selected. Choose a scene for twelve automatic listen-and-repeat slides.`)
        : (zh ? "先选择想学习的语言，再进入十二个最常用的初级生活场景。" : "Choose a target language, then enter twelve essential beginner situations.")}</span>
    </section>
    {!language || !selected ? <GameLanguagePicker lang={lang as any} basePath={`/${lang}/play/everyday`}/> : <>
      <section className="everyday-standard" data-layout-fill="everyday-speaking-standard"><strong>{zh ? "初级任务式口语" : "Beginner task-based speaking"}</strong><div><p>{zh ? "课程按 CEFR A1 / Pre-A1、ACTFL Novice 与成人生活适用性原则设计：先听懂熟悉短句，再用练过的词和简单表达满足即时需求。" : "Built around CEFR A1 / Pre-A1, ACTFL Novice, and adult life-applicability principles: understand familiar short language, then use practiced words and simple expressions for immediate needs."}</p><nav><a href="https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors" target="_blank" rel="noreferrer">CEFR ↗</a><a href="https://www.actfl.org/educator-resources/ncssfl-actfl-can-do-statements" target="_blank" rel="noreferrer">ACTFL Can-Do ↗</a><a href="https://www.cal.org/adultesl/resources/fundamental-principles.php" target="_blank" rel="noreferrer">CAL Adult ESL ↗</a></nav></div></section>
      <section className="everyday-scenes" aria-label={zh ? "生活口语场景" : "Everyday speaking scenes"}>
        {SMARTLINGO_EVERYDAY_SCENARIOS.map((item, index) => <Link key={item.id} href={`/${lang}/play/everyday?language=${language}&scene=${item.id}`}>
          <img src={item.image} alt=""/>
          <div><small>{String(index + 1).padStart(2, "0")} · 12 {zh ? "张" : "SLIDES"}</small><span>{item.icon}</span><strong>{zh ? item.nameZh : item.nameEn}</strong><p>{zh ? item.goalZh : item.goalEn}</p><b>{zh ? "进入场景" : "Enter scene"} →</b></div>
        </Link>)}
      </section>
      <nav className="everyday-back"><Link href={`/${lang}/play?language=${language}`}>← {zh ? "返回游戏" : "Back to Play"}</Link></nav>
    </>}
    <SiteFooter lang={lang as any}/>
  </main>;
}
