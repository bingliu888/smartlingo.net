"use client";

import Link from "next/link";
import { useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { interfaceLanguages, interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { rememberTargetLanguage } from "./InterfaceLanguageMenu";
import { LearningDayPicker } from "./LearningDayPicker";

const DURATIONS = [5, 10, 15, 20] as const;

export function DailySprintSetup({ lang }: { lang: InterfaceLanguage }) {
  const zh = lang === "zh";
  const text = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const sourceName = interfaceLanguages.find(item => item.code === lang)?.nativeName ?? "English";
  const [language, setLanguage] = useState("");
  const [minutes, setMinutes] = useState<(typeof DURATIONS)[number]>(10);
  const [day, setDay] = useState(1);
  const target = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === language);
  return <section className="sprint-setup" data-layout-fill="sprint-setup">
    <header><p>TODAY’S SPRINT</p><h1>{text("Choose a language for today", "选择今天要学习的语言")}</h1><span>{text("No course choice is required. Pick a target language and duration, then start the Beginner five-skill Sprint.", "无需选择课程。选择目标语言和时长后，直接开始初级五技能速成。")}</span></header>
    <div className="sprint-setup-languages">{SMARTLINGO_LANGUAGE_COMMUNITIES.map(item => <button type="button" className={language === item.code ? "selected" : ""} aria-pressed={language === item.code} onClick={() => { setLanguage(item.code); rememberTargetLanguage(item.code); }} key={item.code}><span>{item.code.toUpperCase()}</span><strong data-no-translate>{item.nativeName}</strong><small>{zh ? `用${sourceName}学${item.nameZh}` : `Learn ${item.nameEn} through ${sourceName}`}</small></button>)}</div>
    <div className="sprint-setup-time"><h2>{text("Choose today’s time", "选择今天的学习时长")}</h2><div>{DURATIONS.map(value => <button type="button" className={minutes === value ? "selected" : ""} aria-pressed={minutes === value} onClick={() => setMinutes(value)} key={value}><strong>{value}</strong><span>{text("minutes", "分钟")}</span><small>{value / 5} {text(value === 5 ? "round" : "rounds", "回合")}</small></button>)}</div></div>
    <div className="sprint-setup-time"><h2>{text("Start from a learning day", "选择从第几天开始")}</h2><LearningDayPicker lang={zh ? "zh" : "en"} day={day} onChange={setDay}/></div>
    {target ? <Link className="sprint-setup-start" href={`/${lang}/classes/course_${target.code}_basic/sprint?minutes=${minutes}&day=${day}&source=dashboard`}>{text("Start", "开始")} {text("day", "第")} {day}{zh ? " 天" : ""} · {minutes} {text("minutes", "分钟")} · {zh ? `用${sourceName}学${target.nameZh}` : `Learn ${target.nameEn} through ${sourceName}`} →</Link> : <button className="sprint-setup-start" type="button" disabled>{text("Choose a language first", "请先选择语言")}</button>}
  </section>;
}
