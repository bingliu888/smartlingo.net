import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { disclaimerFor } from "../../../lib/disclaimer-copy";
import { isInterfaceLanguage } from "../../../lib/interface-locale";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: disclaimerFor(lang).label };
}

export default async function DisclaimerPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const copy = disclaimerFor(lang);
  return <main className="ai-cert-legal-page lingo-public-page" data-no-translate>
    <SiteHeader lang={lang}/>
    <article className="ai-cert-legal-main">
      <p className="section-kicker">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="ai-legal-intro">{copy.intro}</p>
      <div className="ai-legal-sections">{copy.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div>
    </article>
    <SiteFooter lang={lang}/>
  </main>;
}
