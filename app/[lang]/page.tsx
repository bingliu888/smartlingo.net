import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import { learningExperienceCopy } from "../../lib/learning-experience-copy";
import { interfaceCopyFor, isInterfaceLanguage } from "../../lib/interface-locale";
import { smartLingoTutorialCopyFor } from "../../lib/smartlingo-tutorial";
import "../../components/learning-experience.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: isInterfaceLanguage(lang) ? learningExperienceCopy[lang].homeTitle : "SmartLingo", description: isInterfaceLanguage(lang) ? learningExperienceCopy[lang].homeIntro : undefined };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const t = learningExperienceCopy[lang];
  const ui = interfaceCopyFor(lang);
  const tutorial = smartLingoTutorialCopyFor(lang);
  return <main className="learning-entry-page" data-layout-page="home" data-layout-ready="true" data-layout-overlap-check="home-page" data-layout-fill="home-hero-shell">
    <SiteHeader lang={lang}/>
    <div className="learning-entry-shell">
      <section className="learning-entry-intro" data-readable-copy="home-hero-copy">
        <p className="section-kicker">SMARTLINGO · FLASH / MAX / GURU</p>
        <h1 data-layout-text-fit="home-hero-title">{t.homeTitle}</h1>
        <p>{t.homeIntro}</p>
        <Link className="lingo-tour-spotlight" href={`/${lang}/tutorial`}><span aria-hidden="true">▶</span><strong>{tutorial.homeAction}</strong><small>{tutorial.duration}</small></Link>
      </section>
      <div className="learning-path-cards">
        <article className="learning-path-card flash">
          <p className="eyebrow">{t.flashAudience}</p><h2>Flash</h2><p>{t.flashBody}</p>
          <Link href={`/${lang}/flash`}>{t.continueLearning} →</Link>
        </article>
        <article className="learning-path-card max">
          <p className="eyebrow">{t.maxAudience}</p><h2>Max</h2><p>{t.maxBody}</p><p>{t.trialStatus}</p>
          <Link href={`/${lang}/max`}>{t.continueLearning} →</Link>
        </article>
      </div>
      <section className="learning-guru-card">
        <div><p className="section-kicker">SMARTLINGO · GURU</p><h2>{ui.askGuru}</h2><p>{t.guruBody}</p></div>
        <Link href={`/${lang}/assistant`}>{ui.askGuru} →</Link>
      </section>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
