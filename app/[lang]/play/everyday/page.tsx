import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EverydaySpeakingPlayer } from "../../../../components/EverydaySpeakingPlayer";
import { GameLanguagePicker } from "../../../../components/GameLanguagePicker";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { buildEverydaySpeakingDeck, buildEverydaySpeakingDeckFromDatabase, isSmartLingoEverydayScenario, SMARTLINGO_EVERYDAY_SCENARIOS } from "../../../../lib/smartlingo-everyday-speaking";
import { isSmartLingoCommunityLanguage, SMARTLINGO_LANGUAGE_COMMUNITIES } from "../../../../lib/smartlingo-language-communities";
import { isInterfaceLanguage } from "../../../../lib/interface-locale";
import { getDatabase } from "../../../../lib/auth";
import "./everyday.css";
import "./standard-links.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: lang === "zh" ? "生活口语 · SmartLingo" : "Everyday speaking · SmartLingo" };
}

export default async function EverydaySpeakingPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ language?: string; scene?: string; level?: string }>;
}) {
  const { lang: rawLang } = await params;
  if (!isInterfaceLanguage(rawLang)) notFound();
  const lang = rawLang;
  const zh = lang === "zh";
  const query = await searchParams;
  const language = query.language && isSmartLingoCommunityLanguage(query.language) ? query.language : undefined;
  const selected = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === language);
  const sceneId = query.scene && isSmartLingoEverydayScenario(query.scene) ? query.scene : undefined;
  const scene = SMARTLINGO_EVERYDAY_SCENARIOS.find(item => item.id === sceneId);
  const level = query.level === "intermediate" || query.level === "advanced" ? query.level : "beginner";

  if (language && selected && scene) {
    let slides;
    try {
      slides = await buildEverydaySpeakingDeckFromDatabase({ database: getDatabase(), language, sceneId: scene.id, level });
    } catch {
      // English and Chinese have reviewed, scene-specific authored dialogue.
      // Other languages must never fall back to unrelated navigation drills.
      if (language === "en" || language === "zh") slides = buildEverydaySpeakingDeck(language, scene.id, level);
      else return <main className="everyday-page everyday-player-page">
        <SiteHeader lang={lang}/>
        <section className="everyday-hero" role="status">
          <p>{zh ? "场景暂时不可用" : "SCENE TEMPORARILY UNAVAILABLE"}</p>
          <h1>{zh ? "这组对话还没有准备好。" : "This dialogue is not ready yet."}</h1>
          <span>{zh ? "为了不教您错误的句子，这次不会显示不匹配的练习。请稍后重试，或先选择其他语言和场景。" : "To avoid teaching mismatched phrases, this activity is paused. Please retry later or choose another language and scene."}</span>
          <nav className="everyday-back"><Link href={`/${lang}/play/everyday?language=${language}`}>{zh ? "返回场景" : "Back to scenes"}</Link></nav>
        </section>
        <SiteFooter lang={lang}/>
      </main>;
    }
    return <main className="everyday-page everyday-player-page" data-layout-page="everyday-player">
    <SiteHeader lang={lang}/>
    <EverydaySpeakingPlayer
      lang={zh ? "zh" : "en"}
      siteLang={lang}
      language={language}
      languageName={`${selected.nativeName} · ${zh ? selected.nameZh : selected.nameEn}`}
      speechLocale={selected.speechLocale}
      direction={selected.direction}
      scene={scene}
      level={level}
      slides={slides}
      roleTutorEnabled={process.env.SMARTLINGO_ROLE_TUTOR_ENABLED !== "0"}
    />
    <SiteFooter lang={lang}/>
    </main>;
  }

  return <main className="everyday-page">
    <SiteHeader lang={lang}/>
    <section className="everyday-hero" data-layout-fill="everyday-speaking-hero">
      <p>REAL LIFE · LISTEN · SPEAK</p>
      <h1>{zh ? "生活口语，从真实的一天开始。" : "Everyday speaking starts with real life."}</h1>
      <span>{selected
        ? (zh ? `已选择${selected.nameZh}。请选择场景与等级，先看实物词汇，再进入模拟场景对话。` : `${selected.nameEn} selected. Choose a scene and level, meet the essential objects, then enter a simulated scene dialogue.`)
        : (zh ? "先选择想学习的语言，再进入十二个真实生活场景；每个场景都有初、中、高三级。" : "Choose a target language, then enter twelve real-life scenes with beginner, intermediate, and advanced levels.")}</span>
    </section>
    {!language || !selected ? <GameLanguagePicker lang={zh ? "zh" : "en"} basePath={`/${lang}/play/everyday`}/> : <>
      <section className="everyday-standard" data-layout-fill="everyday-speaking-standard"><strong>{zh ? "三级任务式场景对话" : "Three-level scene dialogue"}</strong><div><p>{zh ? "按 CEFR、ACTFL 与成人生活适用性原则设计：初级完成即时任务，中级处理变化，高级自然协商；AI 场景媒体与预构建实用对话结合，弱网时也能稳定学习。" : "Built around CEFR, ACTFL, and adult life-applicability principles: complete immediate tasks at beginner, handle variation at intermediate, and negotiate naturally at advanced. AI scene media combines with reliable prebuilt dialogue for dependable learning."}</p><nav><a href="https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors" target="_blank" rel="noreferrer">CEFR ↗</a><a href="https://www.actfl.org/educator-resources/ncssfl-actfl-can-do-statements" target="_blank" rel="noreferrer">ACTFL Can-Do ↗</a><a href="https://www.cal.org/adultesl/resources/fundamental-principles.php" target="_blank" rel="noreferrer">CAL Adult ESL ↗</a></nav></div></section>
      <section className="everyday-scenes" aria-label={zh ? "生活口语场景" : "Everyday speaking scenes"}>
        {SMARTLINGO_EVERYDAY_SCENARIOS.map((item, index) => <article className="everyday-scene-choice" key={item.id}><Link href={`/${lang}/play/everyday?language=${language}&scene=${item.id}&level=beginner`}>
          <Image src={item.image} alt="" width={1200} height={800} unoptimized/>
          <div><small>{String(index + 1).padStart(2, "0")} · {zh ? "模拟场景对话" : "SCENE DIALOGUE"}</small><span>{item.icon}</span><strong>{zh ? item.nameZh : item.nameEn}</strong><p>{zh ? item.goalZh : item.goalEn}</p><b>{zh ? "进入初级场景" : "Enter beginner scene"} →</b></div>
        </Link><nav aria-label={zh ? `${item.nameZh}其他学习等级` : `Other ${item.nameEn} learning levels`}><Link href={`/${lang}/play/everyday?language=${language}&scene=${item.id}&level=intermediate`}>{zh ? "中级" : "Intermediate"}</Link><Link href={`/${lang}/play/everyday?language=${language}&scene=${item.id}&level=advanced`}>{zh ? "高级" : "Advanced"}</Link>{process.env.SMARTLINGO_ROLE_TUTOR_ENABLED !== "0" ? <Link href={`/${lang}/assistant/role-tutor?language=${language}&scene=${item.id}&level=beginner`}>{zh ? "Max · AI 角色教师" : "Max · AI role tutor"}</Link> : null}</nav></article>)}
      </section>
      <nav className="everyday-back"><Link href={`/${lang}/play?language=${language}`}>← {zh ? "返回游戏" : "Back to Play"}</Link></nav>
    </>}
    <SiteFooter lang={lang}/>
  </main>;
}
