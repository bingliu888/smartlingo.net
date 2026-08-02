"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  SMARTLINGO_LANGUAGE_COMMUNITIES,
  type SmartLingoCommunityLanguage,
} from "../lib/smartlingo-language-communities";

type Lang = "en" | "zh";

const TARGET_LANGUAGE_KEY = "smartlingo-target-language";
const TARGET_LANGUAGE_EVENT = "smartlingo-target-language-change";

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
  if (segments[1] === "zh" || segments[1] === "en") segments[1] = language;
  else segments.splice(1, 0, language);
  return segments.join("/") || `/${language}`;
}

export function InterfaceLanguageMenu({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
  const menu = useRef<HTMLDetailsElement>(null);
  const selected = useSyncExternalStore(
    subscribeToTargetLanguage,
    () => {
      const saved = window.localStorage.getItem(TARGET_LANGUAGE_KEY);
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
    rememberTargetLanguage(code);
    if (menu.current) menu.current.open = false;

    if (code === "zh" || code === "en") {
      window.localStorage.setItem("smartlingo-language", code);
      window.location.assign(localizedPath(window.location.pathname, code));
      return;
    }

    const anchor = `language-community-${code}`;
    if (window.location.pathname === `/${lang}` || window.location.pathname === `/${lang}/`) {
      window.history.pushState(null, "", `#${anchor}`);
      window.requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    window.location.assign(`/${lang}#${anchor}`);
  }

  return (
    <details ref={menu} className="interface-language-menu">
      <summary aria-label={zh ? `当前界面语言：${currentInterface.nativeName}。打开语言选择` : `Current interface language: ${currentInterface.nativeName}. Open language selection`}>
        <span className="interface-language-current">{currentInterface.nativeName}</span>
        <span className="interface-language-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="interface-language-popover" role="menu" aria-label={zh ? "语言选择" : "Language selection"}>
        <header>
          <strong>{zh ? "选择语言" : "Choose a language"}</strong>
          <small>{zh ? "中文与英文切换界面；其他选项设置目标学习语言。" : "Chinese and English switch the interface; other choices set your target language."}</small>
        </header>
        <div>
          {SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => {
            const changesInterface = language.code === "zh" || language.code === "en";
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
                  <small>{changesInterface
                    ? (zh ? "界面与目标语言" : "Interface and target")
                    : (zh ? `${language.nameZh}目标社区` : `${language.nameEn} target community`)}</small>
                </span>
                <i aria-hidden="true">{selected === language.code ? "✓" : "→"}</i>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
