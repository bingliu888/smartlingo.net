"use client";

import { useEffect, useRef } from "react";
import {
  SMARTLINGO_LANGUAGE_COMMUNITIES,
  type SmartLingoCommunityLanguage,
} from "../lib/smartlingo-language-communities";
import { interfaceCopyFor, isInterfaceLanguage, type InterfaceLanguage } from "../lib/interface-locale";

type Lang = InterfaceLanguage;

const TARGET_LANGUAGE_KEY = "smartlingo-target-language";
const TARGET_LANGUAGE_EVENT = "smartlingo-target-language-change";
const INTERFACE_LANGUAGE_KEY = "smartlingo-interface-language";

export function rememberTargetLanguage(code: SmartLingoCommunityLanguage) {
  window.localStorage.setItem(TARGET_LANGUAGE_KEY, code);
  window.dispatchEvent(new CustomEvent(TARGET_LANGUAGE_EVENT, { detail: code }));
}

function subscribeToTargetLanguage(update: () => void) {
  window.addEventListener(TARGET_LANGUAGE_EVENT, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(TARGET_LANGUAGE_EVENT, update);
    window.removeEventListener("storage", update);
  };
}

function isCommunityLanguage(value: string | null): value is SmartLingoCommunityLanguage {
  return SMARTLINGO_LANGUAGE_COMMUNITIES.some(language => language.code === value);
}

function localizedPath(pathname: string, language: Lang) {
  const segments = pathname.split("/");
  if (isInterfaceLanguage(segments[1])) segments[1] = language;
  else segments.splice(1, 0, language);
  return segments.join("/") || `/${language}`;
}

export function InterfaceLanguageMenu({ lang, mobile = false, onNavigate }: { lang: Lang; mobile?: boolean; onNavigate?: () => void }) {
  const t = interfaceCopyFor(lang);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
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
  const currentInterface = SMARTLINGO_LANGUAGE_COMMUNITIES.find(language => language.code === lang)
    ?? SMARTLINGO_LANGUAGE_COMMUNITIES[0];

  function choose(code: SmartLingoCommunityLanguage) {
    window.localStorage.setItem(INTERFACE_LANGUAGE_KEY, code);
    if (menu.current) menu.current.open = false;
    onNavigate?.();

    window.localStorage.setItem("smartlingo-language", code);
    window.location.assign(localizedPath(window.location.pathname, code));
  }

  const options = SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => {
    return (
      <button
        key={language.code}
        type="button"
        role="menuitemradio"
        aria-checked={lang === language.code}
        onClick={() => choose(language.code)}
      >
        <span className="interface-language-option">
          <b dir={language.direction}>{language.nativeName}</b>
        </span>
      </button>
    );
  });

  if (mobile) return <section className="mobile-language-options" aria-label={t.chooseLanguage}>
    <strong><GlobeIcon/>{t.language}</strong>
    <div role="menu">{options}</div>
  </section>;

  return (
    <details ref={menu} className="interface-language-menu">
      <summary aria-label={`${t.language}: ${currentInterface.nativeName}`}>
        <span className="interface-language-current">{currentInterface.nativeName}</span>
        <span className="interface-language-chevron" aria-hidden="true">▾</span>
      </summary>
      <div className="interface-language-popover" role="menu" aria-label={t.chooseLanguage}>
        <header>
          <strong>{t.chooseLanguage}</strong>
        </header>
        <div>
          {options}
        </div>
      </div>
    </details>
  );
}

function GlobeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.25"/><path d="M3.9 12h16.2M12 3.75c2.05 2.27 3.1 5.02 3.1 8.25S14.05 17.98 12 20.25C9.95 17.98 8.9 15.23 8.9 12S9.95 6.02 12 3.75Z"/></svg>;
}
