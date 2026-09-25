"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { learningExperienceCopy } from "../lib/learning-experience-copy";
import { joinedLanguageCodes } from "../lib/learning-language-codes";
import { learningUiCopy } from "../lib/learning-ui-copy";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, type SmartLingoCommunityLanguage } from "../lib/smartlingo-language-communities";
import type { InterfaceLanguage } from "../lib/interface-locale";
import { rememberTargetLanguage } from "./InterfaceLanguageMenu";

type Path = "flash" | "max";
const storageKey = "smartlingo-flash-languages-v1";

export function LearningLanguageTiles({ lang, path, initialLanguages = [], signedIn = false }: {
  lang: InterfaceLanguage;
  path: Path;
  initialLanguages?: readonly string[];
  signedIn?: boolean;
}) {
  const t = learningExperienceCopy[lang];
  const [languages, setLanguages] = useState<SmartLingoCommunityLanguage[]>(() => joinedLanguageCodes(initialLanguages));
  const [chooserOpen, setChooserOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (signedIn || path !== "flash") return;
    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as unknown;
        if (Array.isArray(parsed)) setLanguages(joinedLanguageCodes(parsed.filter(value => typeof value === "string")));
      } catch { /* A corrupted preference must not block free learning. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [path, signedIn]);

  async function choose(code: SmartLingoCommunityLanguage) {
    if (busy) return;
    setBusy(true);
    setError("");
    rememberTargetLanguage(code);
    if (signedIn) {
      const response = await fetch("/api/learning-plan", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ targetLanguage: code, useCase: "daily_life", dailyMinutes: 10, selfReportedLevel: "beginner", entryMode: "adaptive" }),
      }).catch(() => null);
      if (!response?.ok) {
        setError(learningUiCopy[lang].saveError);
        setBusy(false);
        return;
      }
    } else {
      const next = joinedLanguageCodes([...languages, code]);
      setLanguages(next);
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* A private browser can still visit the selected language. */ }
    }
    window.location.assign(`/${lang}/programs/${code}?path=${path}`);
  }

  return <section className="learning-language-panel" aria-label={t.yourLanguages}>
    <div className="learning-language-heading"><h2>{t.yourLanguages}</h2><p>{path === "flash" ? t.flashIntro : t.languageIntro}</p></div>
    <div className="learning-language-grid">
      {languages.map(code => {
        const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === code)!;
        return <Link className="learning-language-tile" href={`/${lang}/programs/${code}?path=${path}`} key={code} onClick={() => rememberTargetLanguage(code)}>
          <span>{code.toUpperCase()}</span><strong dir={item.direction}>{item.nativeName}</strong><small>{lang === "zh" ? item.nameZh : item.nameEn}</small><b aria-hidden="true">→</b>
        </Link>;
      })}
      <button className="learning-language-tile learning-language-add" type="button" aria-expanded={chooserOpen} onClick={() => setChooserOpen(value => !value)}>
        <span aria-hidden="true">＋</span><strong>{t.addLanguage}</strong>
      </button>
    </div>
    {!languages.length && <p className="learning-language-empty">{t.noLanguages}</p>}
    {chooserOpen && <div className="learning-language-chooser" role="group" aria-label={t.addLanguage}>
      {SMARTLINGO_LANGUAGE_COMMUNITIES.filter(item => !languages.includes(item.code)).map(item => <button type="button" key={item.code} disabled={busy} onClick={() => void choose(item.code)}><span>{item.code.toUpperCase()}</span><strong dir={item.direction}>{item.nativeName}</strong></button>)}
    </div>}
    {error && <p role="alert" className="learning-language-error">{error}</p>}
  </section>;
}
