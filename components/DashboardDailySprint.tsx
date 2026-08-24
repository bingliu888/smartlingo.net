"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import type { DashboardJoinedCourse } from "./DashboardLearningHub";
import styles from "./DashboardDailySprint.module.css";
import { interfaceLanguages, interfaceText, type InterfaceLanguage } from "../lib/interface-locale";

const DURATIONS = [5, 10, 15, 20] as const;

export function DashboardDailySprint({ lang, courses }: { lang: InterfaceLanguage; courses: DashboardJoinedCourse[] }) {
  const zh = lang === "zh";
  const text = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const [minutes, setMinutes] = useState<Record<string, (typeof DURATIONS)[number]>>({});
  const entries = useMemo(() => SMARTLINGO_LANGUAGE_COMMUNITIES.flatMap(language => {
    const matching = courses.filter(course => course.targetLanguage === language.code);
    if (!matching.length) return [];
    const course = matching.find(item => item.packageTier === "basic" || item.packageTier === "beginner") || matching[0];
    return [{ language, course }];
  }), [courses]);

  const sourceName = interfaceLanguages.find(item => item.code === lang)?.nativeName ?? "English";
  return <section className={styles.sprint} aria-labelledby="dashboard-sprint-title">
    <header><div><p>TODAY’S SPRINT</p><h2 id="dashboard-sprint-title">{zh ? "今日速成" : "Today’s Sprint"}</h2><span>{zh ? "选择学习时长，继续已经保存的五技能进度。添加语言时只选择学习语言，不需要先选择课程。" : "Choose a duration and continue your saved five-skill progress. Adding a language does not require choosing a course."}</span></div></header>
    <div className={styles.rail}>{entries.map(({ language, course }) => {
      const duration = minutes[language.code] || 10;
      return <article key={language.code}>
        <div className={styles.language}><span>{language.code.toUpperCase()}</span><div><strong data-no-translate>{language.nativeName}</strong><small>{zh ? `用${sourceName}学${language.nameZh}` : `Learn ${language.nameEn} through ${sourceName}`}</small></div></div>
        <div className={styles.times} role="group" aria-label={`${text(language.nameEn, language.nameZh)} ${text("Sprint time", "速成时长")}`}>{DURATIONS.map(value => <button type="button" aria-pressed={duration === value} className={duration === value ? styles.active : ""} onClick={() => setMinutes(current => ({ ...current, [language.code]: value }))} key={value}>{value}<small>{zh ? "分" : "m"}</small></button>)}</div>
        <p>{duration / 5} {text(duration === 5 ? "round" : "rounds", "回合")} · {duration * 2} {text("words", "个词")} · {text("five skills", "五技能")}</p>
        <Link className={styles.start} href={`/${lang}/classes/${encodeURIComponent(course.id)}/sprint?minutes=${duration}`}>{text("Start", "开始")} {duration} {text("minutes", "分钟")} →</Link>
      </article>;
    })}<Link className={styles.addTile} href={`/${lang}/play/sprint`}><span>＋</span><strong>{zh ? "添加语言" : "Add language"}</strong><small>{zh ? "前往今日速成选择学习语言与时长" : "Choose a learning language and duration for Today’s Sprint"}</small></Link></div>
  </section>;
}
