"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  SMARTLINGO_LANGUAGE_COMMUNITIES,
  type SmartLingoCommunityLanguage,
} from "../lib/smartlingo-language-communities";

type Lang = "en" | "zh";

const TARGET_LANGUAGE_KEY = "smartlingo-target-language";
const TARGET_LANGUAGE_EVENT = "smartlingo-target-language-change";
const INTERFACE_LANGUAGE_KEY = "smartlingo-interface-language";
const INTERFACE_LANGUAGE_EVENT = "smartlingo-interface-language-change";

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

function subscribeToInterfaceLanguage(update: () => void) {
  window.addEventListener(INTERFACE_LANGUAGE_EVENT, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(INTERFACE_LANGUAGE_EVENT, update);
    window.removeEventListener("storage", update);
  };
}

function isCommunityLanguage(value: string | null): value is SmartLingoCommunityLanguage {
  return SMARTLINGO_LANGUAGE_COMMUNITIES.some(language => language.code === value);
}

function localizedPath(pathname: string, language: Lang) {
  const segments = pathname.split("/");
  if (segments[1] === "zh" || segments[1] === "en") segments[1] = language;
  else segments.splice(1, 0, language);
  return segments.join("/") || `/${language}`;
}

export function InterfaceLanguageMenu({ lang, mobile = false, onNavigate }: { lang: Lang; mobile?: boolean; onNavigate?: () => void }) {
  const zh = lang === "zh";
  const menu = useRef<HTMLDetailsElement>(null);
  const selected = useSyncExternalStore(
    subscribeToInterfaceLanguage,
    () => {
      const saved = window.localStorage.getItem(INTERFACE_LANGUAGE_KEY);
      return isCommunityLanguage(saved) ? saved : lang;
    },
    () => lang,
  );

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
    window.dispatchEvent(new Event(INTERFACE_LANGUAGE_EVENT));
    if (menu.current) menu.current.open = false;
    onNavigate?.();

    const renderedLanguage: Lang = code === "zh" ? "zh" : "en";
    window.localStorage.setItem("smartlingo-language", renderedLanguage);
    window.location.assign(localizedPath(window.location.pathname, renderedLanguage));
  }

  const options = SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => {
    return (
      <button
        key={language.code}
        type="button"
        role="menuitemradio"
        aria-checked={selected === language.code}
        onClick={() => choose(language.code)}
      >
        <span className="interface-language-option">
          <b dir={language.direction}>{language.nativeName}</b>
        </span>
      </button>
    );
  });

  if (mobile) return <section className="mobile-language-options" aria-label={zh ? "语言选择" : "Language selection"}>
    <strong><GlobeIcon/>{zh ? "语言" : "Language"}</strong>
    <div role="menu">{options}</div>
  </section>;

  return (
    <details ref={menu} className="interface-language-menu">
      <summary aria-label={zh ? `当前界面语言：${currentInterface.nativeName}。打开语言选择` : `Current interface language: ${currentInterface.nativeName}. Open language selection`}>
        <span className="interface-language-current">{currentInterface.nativeName}</span>
        <span className="interface-language-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="interface-language-popover" role="menu" aria-label={zh ? "语言选择" : "Language selection"}>
        <header>
          <strong>{zh ? "选择语言" : "Choose a language"}</strong>
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
