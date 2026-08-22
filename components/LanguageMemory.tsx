"use client";

import Link from "next/link";
import { useEffect } from "react";
import { interfaceLanguages, isInterfaceLanguage, type InterfaceLanguage } from "../lib/interface-locale";

export type SiteLanguage = InterfaceLanguage;
const storageKey = "smartlingo-language";

export function LanguageSync({ lang }: { lang: SiteLanguage }) {
  useEffect(() => {
    window.localStorage.setItem(storageKey, lang);
    const selected = interfaceLanguages.find(language => language.code === lang);
    document.documentElement.lang = selected?.speechLocale ?? lang;
    document.documentElement.dir = selected?.direction ?? "ltr";
  }, [lang]);
  return null;
}

export function LanguageLink({ lang, className }: { lang: SiteLanguage; className?: string; compact?: boolean }) {
  const index = interfaceLanguages.findIndex(language => language.code === lang);
  const nextLanguage = interfaceLanguages[(index + 1) % interfaceLanguages.length];
  return <Link className={className ?? "language-link"} href={`/${nextLanguage.code}`} hrefLang={nextLanguage.code} onClick={() => window.localStorage.setItem(storageKey, nextLanguage.code)}>{nextLanguage.nativeName}</Link>;
}

export function RootLanguageRedirect() {
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    window.location.replace(`/${isInterfaceLanguage(saved ?? "") ? saved : "en"}`);
  }, []);
  return <main className="language-loading"><span>SmartLingo.net</span></main>;
}
