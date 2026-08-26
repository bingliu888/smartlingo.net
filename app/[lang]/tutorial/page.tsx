import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { isInterfaceLanguage } from "../../../lib/interface-locale";
import { smartLingoTutorialCopyFor, smartLingoTutorialMediaFor } from "../../../lib/smartlingo-tutorial";
import "./tutorial.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) return {};
  const copy = smartLingoTutorialCopyFor(lang);
  return {
    title: copy.metaTitle,
    description: copy.intro,
    openGraph: {
      title: copy.metaTitle,
      description: copy.intro,
      images: [smartLingoTutorialMediaFor(lang).poster],
    },
  };
}

export default async function TutorialPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const copy = smartLingoTutorialCopyFor(lang);
  const media = smartLingoTutorialMediaFor(lang);

  return (
    <main className="tutorial-page" dir={lang === "ar" ? "rtl" : "ltr"} data-layout-page="tutorial">
      <SiteHeader lang={lang}/>
      <div className="tutorial-hero-shell" data-layout-fill="tutorial-hero-shell">
        <section className="tutorial-hero">
          <div className="tutorial-hero-copy" data-readable-copy="tutorial-hero-copy">
            <p className="section-kicker">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
            <div className="tutorial-duration"><span aria-hidden="true">▶</span>{copy.duration}</div>
          </div>
          <div className="tutorial-parts" aria-label={copy.watchLabel}>
            <article>
              <p>{copy.visitorLabel}</p>
              <h2>{copy.visitorTitle}</h2>
              <span>{copy.visitorBody}</span>
            </article>
            <article>
              <p>{copy.memberLabel}</p>
              <h2>{copy.memberTitle}</h2>
              <span>{copy.memberBody}</span>
            </article>
          </div>
        </section>
      </div>

      <section className="tutorial-player-section" aria-labelledby="tutorial-player-title">
        <div className="tutorial-player-heading">
          <div>
            <p className="section-kicker">VIDEO · 10+ MIN</p>
            <h2 id="tutorial-player-title">{copy.watchLabel}</h2>
          </div>
          <p>{copy.mediaNote}</p>
        </div>
        <div className="tutorial-video-frame">
          <video
            controls
            playsInline
            preload="metadata"
            poster={media.poster}
            aria-label={copy.watchLabel}
          >
            <source src={media.video} type="video/mp4"/>
            <track
              default
              kind="captions"
              src={media.captions}
              srcLang={media.narrationLanguage}
              label={media.narrationLanguage === "zh" ? "中文" : "English"}
            />
          </video>
        </div>
        <p className="tutorial-caption-note">{copy.captionsNote}</p>
      </section>

      <section className="tutorial-assurance">
        <article data-layout-overlap-check="tutorial-account-assurance">
          <span aria-hidden="true">01</span>
          <div><h2>{copy.accountTitle}</h2><p>{copy.accountBody}</p></div>
        </article>
        <article data-layout-overlap-check="tutorial-privacy-assurance">
          <span aria-hidden="true">02</span>
          <div><h2>{copy.privacyTitle}</h2><p>{copy.privacyBody}</p></div>
        </article>
      </section>

      <section className="tutorial-actions">
        <Link className="primary-button" href={`/${lang}/play`}>{copy.startLink} →</Link>
        <Link className="secondary-button" href={`/${lang}`}>{copy.homeLink}</Link>
      </section>
      <SiteFooter lang={lang}/>
    </main>
  );
}
