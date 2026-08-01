"use client";

import Link from "next/link";
import { useEffect } from "react";

export type SiteLanguage = "en" | "zh";
const storageKey = "smartlingo-language";

export function LanguageSync({ lang }: { lang: SiteLanguage }) {
  useEffect(() => {
    window.localStorage.setItem(storageKey, lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  return null;
}

export function LanguageLink({ lang, className }: { lang: SiteLanguage; className?: string; compact?: boolean }) {
  const next = lang === "en" ? "zh" : "en";
  return <Link className={className ?? "language-link"} href={`/${next}`} hrefLang={next} onClick={() => window.localStorage.setItem(storageKey, next)} aria-label={lang === "en" ? "Switch website to Chinese" : "切换为英文"}>{lang === "en" ? "中文" : "EN"}</Link>;
}

export function RootLanguageRedirect() {
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    window.location.replace(saved === "en" ? "/en" : "/zh");
  }, []);
  return <main className="language-loading"><span>SmartLingo.net</span></main>;
}
