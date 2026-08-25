"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeaderAccount } from "./HeaderAccount";
import { InterfaceLanguageMenu } from "./InterfaceLanguageMenu";
import { SmartLingoWordmark } from "./SmartLingoWordmark";
import { interfaceCopyFor, type InterfaceLanguage } from "../lib/interface-locale";

function GlobalLinks({ lang }: { lang: InterfaceLanguage }) {
  const t = interfaceCopyFor(lang);
  return <>
    <Link href={`/${lang}/learn`} data-nav="learn">{t.learn}</Link>
    <Link href={`/${lang}/smartcards`} data-nav="practice">{t.practice}</Link>
    <Link href={`/${lang}/play/everyday`} data-nav="speak">{t.speak}</Link>
    <Link href={`/${lang}/community`} data-nav="community">{t.community}</Link>
  </>;
}

export function SiteHeader({ lang }: { lang: InterfaceLanguage }) {
  const t = interfaceCopyFor(lang);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setMobileOpen(false); }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mobileOpen]);
  return (
    <header className="site-header ai-cert-header">
      <Link className="brand ai-cert-brand" href={`/${lang}`} aria-label={t.home}>
        <SmartLingoWordmark/>
      </Link>
      <nav className="desktop-nav" aria-label={t.primaryNav}>
        <GlobalLinks lang={lang}/>
      </nav>
      <div className="header-actions">
        <InterfaceLanguageMenu lang={lang}/>
        <HeaderAccount lang={lang}/>
      </div>
      <button
        className={`hamburger-button${mobileOpen ? " open" : ""}`}
        type="button"
        aria-label={mobileOpen ? t.closeMenu : t.openMenu}
        aria-expanded={mobileOpen}
        aria-controls="mobile-header-menu"
        onClick={() => setMobileOpen(value => !value)}
      ><span/><span/><span/></button>
      {mobileOpen ? <div className="mobile-header-menu" id="mobile-header-menu">
        <nav aria-label={t.primaryNav} onClick={() => setMobileOpen(false)}>
          <GlobalLinks lang={lang}/>
        </nav>
        <InterfaceLanguageMenu lang={lang} mobile onNavigate={() => setMobileOpen(false)}/>
        <div className="mobile-account"><HeaderAccount lang={lang} mobile onNavigate={() => setMobileOpen(false)}/></div>
      </div> : null}
    </header>
  );
}
