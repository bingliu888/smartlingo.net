"use client";

import Link from "next/link";
import { useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { LearningDayPicker } from "./LearningDayPicker";

export function SmartCardDirectoryGrid({ lang, challenge = false }: { lang: "zh" | "en"; challenge?: boolean }) {
  const zh = lang === "zh", [day,setDay]=useState(1);
  const href=(code:string,level:"beginner"|"intermediate"|"advanced")=>`/${lang}/smartcards/starter-${code}${level==="beginner"?"":`-${level}`}?day=${day}${challenge?"&mode=challenge":""}`;
  return <>
    {!challenge ? <div className="smartcard-day-choice"><LearningDayPicker lang={lang} day={day} onChange={setDay}/></div> : null}
    <section className="smartcard-language-grid">{SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => <article className="smartcard-language-choice" key={language.code}>
      <Link href={href(language.code,"beginner")}><span>{language.code.toUpperCase()}</span><h2>{zh ? language.nameZh : language.nameEn}</h2><p>{challenge ? (zh ? "初级 · 今日固定 20 题" : "Beginner · today's fixed 20") : (zh ? `初级 · 第 ${day}/21 天 · 20 个高频词` : `Beginner · day ${day}/21 · 20 frequent words`)}</p><b>{challenge ? (zh ? "进入初级挑战" : "Enter beginner challenge") : (zh ? "开始初级练习" : "Start beginner practice")} →</b></Link>
      <nav aria-label={zh?`${language.nameZh}其他级别`:`Other ${language.nameEn} levels`}><Link href={href(language.code,"intermediate")}>{zh?"中级":"Intermediate"}</Link><Link href={href(language.code,"advanced")}>{zh?"高级":"Advanced"}</Link></nav>
    </article>)}</section>
    <style>{`.smartcard-day-choice{width:min(760px,calc(100% - 40px));margin:0 auto 28px}.smartcard-language-choice{min-width:0}.smartcard-language-choice>a{height:100%;display:block}.smartcard-language-choice nav{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.smartcard-language-choice nav a{padding:12px;border:1px solid #afc9bf;border-radius:12px;background:#eef8f4;color:#075f4b;text-align:center;text-decoration:none;font-weight:900}`}</style>
  </>;
}
