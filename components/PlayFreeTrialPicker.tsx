"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";

const SKILLS = [
  { id: "vocabulary", zh: "词汇", en: "Vocabulary", noteZh: "智慧卡、跟读与组句", noteEn: "SmartCards, speaking, and sentences" },
  { id: "reading", zh: "阅读", en: "Reading", noteZh: "理解初级真实语境", noteEn: "Understand beginner contexts" },
  { id: "writing", zh: "写作", en: "Writing", noteZh: "点选词语组成句子", noteEn: "Build sentences from word tiles" },
  { id: "listening", zh: "听力", en: "Listening", noteZh: "听音后按顺序组句", noteEn: "Listen and order the words" },
  { id: "dialogue", zh: "口语", en: "Speaking", noteZh: "听 AI 并开口回应", noteEn: "Listen and respond aloud" },
] as const;

export function PlayFreeTrialPicker({ lang, initialLanguage }: { lang: "zh" | "en"; initialLanguage?: string }) {
  const zh = lang === "zh";
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(initialLanguage || "");
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <>
    <button className="game-tile free-trial-tile" type="button" onClick={() => setOpen(true)}>
      <small>06 · FREE BEGINNER COURSE</small><strong>{zh ? "免费试学" : "Free Trial"}</strong>
      <em>{zh ? "先选语言，再从五项技能中选择一项独立试学" : "Choose a language, then open one separate beginner skill"}</em>
      <b>{zh ? "选择语言与学习项目" : "Choose language and activity"} →</b>
    </button>
    {open ? <div className="trial-picker-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="trial-picker" role="dialog" aria-modal="true" aria-labelledby="trial-picker-title">
        <button className="trial-picker-close" type="button" onClick={() => setOpen(false)}>×</button>
        <p>FREE TRIAL · BEGINNER</p><h2 id="trial-picker-title">{zh ? "选择语言，再选择一项学习" : "Choose a language, then one activity"}</h2>
        <span>{zh ? "五项学习默认全部未选择。每项进入独立页面，网址包含对应的初级课程编号。" : "Nothing is preselected. Each activity opens its own page with the beginner course ID in the URL."}</span>
        <h3>{zh ? "1. 选择语言" : "1. Choose a language"}</h3>
        <div className="trial-picker-languages">{SMARTLINGO_LANGUAGE_COMMUNITIES.map(item => <button type="button" className={language === item.code ? "selected" : ""} aria-pressed={language === item.code} onClick={() => setLanguage(item.code)} key={item.code}><small>{item.code.toUpperCase()}</small><strong>{zh ? item.nameZh : item.nameEn}</strong><span>{item.nativeName}</span></button>)}</div>
        <h3>{zh ? "2. 选择一项学习" : "2. Choose one activity"}</h3>
        <div className="trial-picker-skills">{SKILLS.map(skill => language ? <Link href={`/${lang}/classes/course_${language}_basic/trial/${skill.id}`} key={skill.id}><strong>{zh ? skill.zh : skill.en}</strong><span>{zh ? skill.noteZh : skill.noteEn}</span><b>→</b></Link> : <button type="button" disabled key={skill.id}><strong>{zh ? skill.zh : skill.en}</strong><span>{zh ? "请先选择语言" : "Choose a language first"}</span></button>)}</div>
      </section>
    </div> : null}
    <style>{`.trial-picker-backdrop{position:fixed;z-index:1100;inset:0;padding:18px;display:grid;place-items:center;background:#071c17c9}.trial-picker{position:relative;width:min(940px,100%);max-height:calc(100dvh - 36px);padding:clamp(24px,5vw,44px);overflow:auto;border-radius:28px;background:#f7f3ea;color:#153129}.trial-picker-close{position:absolute;right:18px;top:18px;width:44px;height:44px;border:0;border-radius:12px;background:#123f35;color:#fff;font-size:27px}.trial-picker>p{margin:0;color:#087d62;font-size:12px;font-weight:950;letter-spacing:.14em}.trial-picker h2{max-width:760px;margin:9px 0 12px;font-size:clamp(34px,5vw,55px);line-height:1.04}.trial-picker>span{color:#60726b}.trial-picker h3{margin:27px 0 12px}.trial-picker-languages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.trial-picker-languages button{min-width:0;min-height:82px;padding:12px;display:grid;gap:3px;border:1px solid #c8d8d1;border-radius:14px;background:#fff;color:#153129;text-align:left}.trial-picker-languages button.selected{border:2px solid #087d62;background:#e2f6ed}.trial-picker-languages small{color:#087d62;font-weight:950}.trial-picker-languages span{color:#6b7a75;font-size:12px}.trial-picker-skills{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.trial-picker-skills a,.trial-picker-skills button{min-width:0;min-height:125px;padding:15px;display:flex;flex-direction:column;border:1px solid #c8d8d1;border-radius:15px;background:#fff;color:#153129;text-decoration:none;text-align:left}.trial-picker-skills strong{font-size:20px}.trial-picker-skills span{margin-top:7px;color:#687a73;font-size:13px;line-height:1.4}.trial-picker-skills b{margin-top:auto;color:#087d62}.trial-picker-skills button:disabled{opacity:.48}@media(max-width:760px){.trial-picker-languages{grid-template-columns:repeat(2,minmax(0,1fr))}.trial-picker-skills{grid-template-columns:1fr 1fr}}`}</style>
  </>;
}
