"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeaderAccount } from "./HeaderAccount";
import { InterfaceLanguageMenu } from "./InterfaceLanguageMenu";

function GlobalLinks({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  return <>
    <Link href={`/${lang}/play/everyday`}>{zh ? "生活口语" : "Everyday speaking"}</Link>
    <Link href={`/${lang}/play`}>{zh ? "边玩边学" : "Learn through play"}</Link>
    <Link href={`/${lang}/programs`}>{zh ? "选择课程" : "Choose course"}</Link>
    <Link href={`/${lang}/colleges`}>{zh ? "选择学院" : "Choose College"}</Link>
    <Link href={`/${lang}/assistant`}>{zh ? "咨询AI" : "Ask AI"}</Link>
  </>;
}

export function SiteHeader({ lang }: { lang: "en" | "zh" }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setMobileOpen(false); }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mobileOpen]);
  return (
    <header className="site-header ai-cert-header">
      <Link className="brand ai-cert-brand" href={`/${lang}`} aria-label={lang === "zh" ? "SmartLingo 首页" : "SmartLingo home"}>
        <span className="lingo-brand-mark" aria-hidden="true">S</span>
        <span>Smart<em>Lingo</em></span>
      </Link>
      <nav className="desktop-nav" aria-label={lang === "zh" ? "主导航" : "Primary navigation"}>
        <GlobalLinks lang={lang}/>
      </nav>
      <div className="header-actions">
        <HeaderAccount lang={lang}/>
      </div>
      <InterfaceLanguageMenu lang={lang}/>
      <button
        className={`hamburger-button${mobileOpen ? " open" : ""}`}
        type="button"
        aria-label={mobileOpen ? (lang === "zh" ? "关闭菜单" : "Close menu") : (lang === "zh" ? "打开菜单" : "Open menu")}
        aria-expanded={mobileOpen}
        aria-controls="mobile-header-menu"
        onClick={() => setMobileOpen(value => !value)}
      ><span/><span/><span/></button>
      {mobileOpen ? <div className="mobile-header-menu" id="mobile-header-menu">
        <nav aria-label={lang === "zh" ? "主导航" : "Primary navigation"} onClick={() => setMobileOpen(false)}>
          <GlobalLinks lang={lang}/>
        </nav>
        <InterfaceLanguageMenu lang={lang} mobile onNavigate={() => setMobileOpen(false)}/>
        <div className="mobile-account"><HeaderAccount lang={lang} mobile onNavigate={() => setMobileOpen(false)}/></div>
      </div> : null}
    </header>
  );
}
