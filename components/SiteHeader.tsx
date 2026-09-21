"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HeaderAccount } from "./HeaderAccount";
import { InterfaceLanguageMenu } from "./InterfaceLanguageMenu";
import { SmartLingoWordmark } from "./SmartLingoWordmark";
import { fittingNavigationCount } from "../lib/header-navigation-fit";
import { interfaceCopyFor, type InterfaceLanguage } from "../lib/interface-locale";

export function SiteHeader({ lang }: { lang: InterfaceLanguage }) {
  const t = interfaceCopyFor(lang);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const navigationMeasureRef = useRef<HTMLDivElement>(null);
  const headerControlsRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const links = [
    [t.learn, `/${lang}/learn`, "learn", pathname === `/${lang}/learn` || pathname.startsWith(`/${lang}/learn/`)],
    [t.practice, `/${lang}/smartcards`, "practice", pathname === `/${lang}/smartcards` || pathname.startsWith(`/${lang}/smartcards/`)],
    [t.speak, `/${lang}/play/everyday`, "speak", pathname === `/${lang}/play/everyday` || pathname.startsWith(`/${lang}/play/everyday/`)],
    [t.community, `/${lang}/community`, "community", pathname === `/${lang}/community` || pathname.startsWith(`/${lang}/community/`)],
  ] as const;
  const [visibleLinkCount, setVisibleLinkCount] = useState<number>(links.length);
  const hiddenLinks = links.slice(visibleLinkCount);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (mobileMenuRef.current?.contains(target) || mobileMenuButtonRef.current?.contains(target)) return;
      setMobileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      mobileMenuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const brand = brandRef.current;
    const navigationMeasure = navigationMeasureRef.current;
    const controls = headerControlsRef.current;
    if (!header || !brand || !navigationMeasure || !controls) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headerStyle = getComputedStyle(header);
        const availableWidth = header.clientWidth - parseFloat(headerStyle.paddingLeft) - parseFloat(headerStyle.paddingRight);
        const headerGap = parseFloat(headerStyle.columnGap) || 0;
        const brandItems = Array.from(brand.children) as HTMLElement[];
        const brandGap = parseFloat(getComputedStyle(brand).columnGap) || 0;
        const brandWidth = brandItems.reduce((total, item) => total + item.getBoundingClientRect().width, 0) + brandGap * Math.max(0, brandItems.length - 1);
        const navigationItems = Array.from(navigationMeasure.children) as HTMLElement[];
        const navigationGap = parseFloat(getComputedStyle(navigationMeasure).columnGap) || 0;
        const itemWidths = navigationItems.map(item => item.getBoundingClientRect().width);
        const controlsWidth = controls.getBoundingClientRect().width;
        const nextVisibleCount = fittingNavigationCount({ availableWidth, brandWidth, controlsWidth, headerGap, itemWidths, itemGap: navigationGap });
        setVisibleLinkCount(current => current === nextVisibleCount ? current : nextVisibleCount);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(brand);
    Array.from(brand.children).forEach(item => observer.observe(item));
    observer.observe(navigationMeasure);
    navigationMeasure.querySelectorAll("span").forEach(item => observer.observe(item));
    observer.observe(controls);
    document.fonts?.ready.then(measure).catch(() => undefined);
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [lang]);

  return <header ref={headerRef} className="site-header ai-cert-header" data-visible-nav-count={visibleLinkCount} data-layout-fill="header">
    <Link ref={brandRef} className="brand ai-cert-brand" href={`/${lang}`} aria-label={t.home}><SmartLingoWordmark/></Link>
    <nav className="desktop-nav" aria-label={t.primaryNav}>{links.slice(0, visibleLinkCount).map(([label, href, key, active]) => <Link key={href} href={href} data-nav={key} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{label}</Link>)}</nav>
    <div className="header-nav-measure" ref={navigationMeasureRef} aria-hidden="true">{links.map(([label, href]) => <span key={href}>{label}</span>)}</div>
    <div ref={headerControlsRef} className="header-controls">
      <InterfaceLanguageMenu lang={lang}/>
      <button ref={mobileMenuButtonRef} className={`hamburger-button${mobileOpen ? " open" : ""}`} type="button" aria-label={mobileOpen ? t.closeMenu : t.openMenu} aria-expanded={mobileOpen} aria-controls="mobile-header-menu" onClick={() => setMobileOpen(value => !value)}><span/><span/><span/></button>
    </div>
    {mobileOpen ? <div ref={mobileMenuRef} className="mobile-header-menu" id="mobile-header-menu">
      {hiddenLinks.length ? <nav aria-label={t.primaryNav}>{hiddenLinks.map(([label, href, key, active]) => <Link key={href} href={href} data-nav={key} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}>{label}<span>→</span></Link>)}</nav> : null}
      <div className="mobile-account"><HeaderAccount lang={lang} mobile onNavigate={() => setMobileOpen(false)}/></div>
    </div> : null}
  </header>;
}
