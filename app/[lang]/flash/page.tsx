import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningLanguageTiles } from "../../../components/LearningLanguageTiles";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { learningExperienceCopy } from "../../../lib/learning-experience-copy";
import { interfaceCopyFor, isInterfaceLanguage } from "../../../lib/interface-locale";
import "../../../components/learning-experience.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: `Flash · SmartLingo`, description: isInterfaceLanguage(lang) ? learningExperienceCopy[lang].flashBody : undefined };
}

export default async function FlashPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const t = learningExperienceCopy[lang];
  const ui = interfaceCopyFor(lang);
  return <main className="learning-entry-page" data-layout-page="flash" data-layout-ready="true" data-layout-overlap-check="flash-page">
    <SiteHeader lang={lang}/>
    <div className="learning-entry-shell">
      <section className="learning-entry-intro"><p className="section-kicker">SMARTLINGO · FLASH</p><h1>Flash</h1><p>{t.flashIntro}</p></section>
      <LearningLanguageTiles lang={lang} path="flash"/>
      <div className="learning-hub-grid">
        <article className="learning-hub-card"><h2>{ui.play}</h2><p>{t.flashBody}</p><Link href={`/${lang}/play`}>{t.continueLearning} →</Link></article>
        <article className="learning-hub-card"><h2>{ui.everyday}</h2><p>{t.languageIntro}</p><Link href={`/${lang}/play/everyday`}>{t.continueLearning} →</Link></article>
      </div>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
