import Link from "next/link";
import { interfaceCopyFor, type InterfaceLanguage } from "../lib/interface-locale";
import { SmartLingoWordmark } from "./SmartLingoWordmark";

export function SiteFooter({ lang }: { lang: InterfaceLanguage }) {
  const t = interfaceCopyFor(lang);
  return (
    <footer className="global-site-footer ai-cert-footer">
      <div className="footer-identity">
        <strong className="smartlingo-footer-brand"><SmartLingoWordmark/></strong>
        <span>{t.footerTagline}</span>
        <small>© 2026 SmartLingo.net</small>
      </div>
      <nav aria-label={t.footerNav}>
        <Link href={`/${lang}/about`}>{t.about}</Link>
        <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
        <Link href={`/${lang}/terms`}>{t.terms}</Link>
        <Link href={`/${lang}/project`}>{t.project}</Link>
      </nav>
    </footer>
  );
}
