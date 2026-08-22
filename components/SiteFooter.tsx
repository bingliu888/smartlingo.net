import Link from "next/link";
import { LanguageLink } from "./LanguageMemory";
import { interfaceCopyFor, type InterfaceLanguage } from "../lib/interface-locale";

export function SiteFooter({ lang }: { lang: InterfaceLanguage }) {
  const t = interfaceCopyFor(lang);
  return (
    <footer className="global-site-footer ai-cert-footer">
      <div className="footer-identity">
        <strong>Smart<span>Lingo</span></strong>
        <span>{t.footerTagline}</span>
        <small>© 2026 SmartLingo.net</small>
      </div>
      <nav aria-label={t.footerNav}>
        <Link href={`/${lang}/programs`}>{t.courses}</Link>
        <Link href={`/${lang}/assistant`}>{t.askGuru}</Link>
        <Link href={`/${lang}/project`}>{t.project}</Link>
        <Link href={`/${lang}/about`}>{t.about}</Link>
        <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
        <Link href={`/${lang}/terms`}>{t.terms}</Link>
        <LanguageLink lang={lang} compact/>
      </nav>
    </footer>
  );
}
