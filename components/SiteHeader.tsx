"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { HeaderAccount } from "./HeaderAccount";
import { InterfaceLanguageMenu } from "./InterfaceLanguageMenu";

function GlobalLinks({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  return <>
    <Link href={`/${lang}/programs`}>{zh ? "学习" : "Learn"}</Link>
    <Link href={`/${lang}/classes`}>{zh ? "课程" : "Courses"}</Link>
    <Link href={`/${lang}/community`}>{zh ? "社区" : "Community"}</Link>
    <Link href={`/${lang}/assistant`}>{zh ? "导师" : "Guru"}</Link>
  </>;
}

export function SiteHeader({ lang }: { lang: "en" | "zh" }) {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) { if (mobileMenu.current?.open && !mobileMenu.current.contains(event.target as Node)) mobileMenu.current.open = false; }
    function escape(event: KeyboardEvent) { if (event.key === "Escape" && mobileMenu.current) mobileMenu.current.open = false; }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, []);
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
      <details ref={mobileMenu} className="mobile-menu">
        <summary aria-label={lang === "zh" ? "打开菜单" : "Open menu"}><span /><span /><span /></summary>
        <div onClick={event => { if ((event.target as HTMLElement).closest("a")) mobileMenu.current!.open = false; }}>
          <GlobalLinks lang={lang}/>
          <HeaderAccount lang={lang}/>
        </div>
      </details>
      <InterfaceLanguageMenu lang={lang} />
    </header>
  );
}
