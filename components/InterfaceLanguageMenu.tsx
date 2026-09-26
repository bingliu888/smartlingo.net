"use client";

import { useEffect, useRef } from "react";
import {
  type SmartLingoCommunityLanguage,
} from "../lib/smartlingo-language-communities";
import { interfaceCopyFor, interfaceLanguages, isInterfaceLanguage, type InterfaceLanguage } from "../lib/interface-locale";

type Lang = InterfaceLanguage;

const TARGET_LANGUAGE_KEY = "smartlingo-target-language";
const TARGET_LANGUAGE_EVENT = "smartlingo-target-language-change";
const INTERFACE_LANGUAGE_KEY = "smartlingo-interface-language";

export function isOutsideLanguageMenu(menu: Pick<HTMLDetailsElement, "open" | "contains"> | null, target: EventTarget | null) {
  return Boolean(menu?.open && !menu.contains(target as Node));
}

export function rememberTargetLanguage(code: SmartLingoCommunityLanguage) {
  try { window.localStorage.setItem(TARGET_LANGUAGE_KEY, code); } catch { /* Private browsing can restrict storage; navigation still works. */ }
  window.dispatchEvent(new CustomEvent(TARGET_LANGUAGE_EVENT, { detail: code }));
}

export function localizedPath(pathname: string, language: Lang, search = "", hash = "") {
  const segments = pathname.split("/");
  if (isInterfaceLanguage(segments[1])) segments[1] = language;
  else segments.splice(1, 0, language);
  return `${segments.join("/") || `/${language}`}${search}${hash}`;
}

export function InterfaceLanguageMenu({ lang, mobile = false, onNavigate }: { lang: Lang; mobile?: boolean; onNavigate?: () => void }) {
  const t = interfaceCopyFor(lang);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (isOutsideLanguageMenu(menu.current, event.target) && menu.current) menu.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current) menu.current.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  // The header reports the interface language, not the independently selected
  // learning target. Keeping these two states separate prevents an English
  // page from being labelled 中文 after someone joins a Chinese class.
  const currentInterface = interfaceLanguages.find(language => language.code === lang)
    ?? interfaceLanguages[0];

  function choose(code: InterfaceLanguage) {
    try { window.localStorage.setItem(INTERFACE_LANGUAGE_KEY, code); } catch { /* Locale routing also works without persistent storage. */ }
    if (menu.current) menu.current.open = false;
    onNavigate?.();

    try { window.localStorage.setItem("smartlingo-language", code); } catch { /* Private browsing may restrict storage. */ }
    window.location.assign(localizedPath(window.location.pathname, code, window.location.search, window.location.hash));
  }

  const options = interfaceLanguages.map(language => {
    return (
      <button
        key={language.code}
        type="button"
        aria-pressed={lang === language.code}
        className={lang === language.code ? "active" : ""}
        onClick={() => choose(language.code)}
      >
        <span dir={language.direction}>{language.nativeName}</span>
      </button>
    );
  });

  if (mobile) return <section className="mobile-language-options" aria-label={t.chooseLanguage}>
    <strong><GlobeIcon/>{t.language}</strong>
    <div>{options}</div>
  </section>;

  return (
    <details ref={menu} className="header-language-menu icon-language-menu">
      <summary className="language-icon-button" data-no-translate aria-label={`${t.language}: ${currentInterface.nativeName}`} title={`${t.language}: ${currentInterface.nativeName}`}>
        <GlobeIcon/>
      </summary>
      <div className="header-language-options">
        <strong>{t.language}</strong>
        {options}
      </div>
    </details>
  );
}

function GlobeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.25"/><path d="M3.9 12h16.2M12 3.75c2.05 2.27 3.1 5.02 3.1 8.25S14.05 17.98 12 20.25C9.95 17.98 8.9 15.23 8.9 12S9.95 6.02 12 3.75Z"/></svg>;
}
