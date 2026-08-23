"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import type { DashboardJoinedCourse } from "./DashboardLearningHub";
import styles from "./DashboardDailySprint.module.css";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";

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

  return <section className={styles.sprint} aria-labelledby="dashboard-sprint-title">
    <header><div><p>TODAY’S SPRINT</p><h2 id="dashboard-sprint-title">{zh ? "今日速成" : "Today’s Sprint"}</h2><span>{zh ? "为每种已加入语言选择时长；默认 10 分钟，每 5 分钟完成一轮五技能学习。" : "Choose a time for each joined language. Ten minutes is the default, with one five-skill round every five minutes."}</span></div><Link href={`/${lang}/programs`} aria-label={zh ? "添加一种新语言" : "Add a new language"}>＋<span>{zh ? "添加语言" : "Add language"}</span></Link></header>
    <div className={styles.rail}>{entries.map(({ language, course }) => {
      const duration = minutes[language.code] || 10;
      return <article key={language.code}>
        <div className={styles.language}><span>{language.code.toUpperCase()}</span><div><strong data-no-translate>{language.nativeName}</strong><small>{text(language.nameEn, language.nameZh)}</small></div></div>
        <div className={styles.times} role="group" aria-label={`${text(language.nameEn, language.nameZh)} ${text("Sprint time", "速成时长")}`}>{DURATIONS.map(value => <button type="button" aria-pressed={duration === value} className={duration === value ? styles.active : ""} onClick={() => setMinutes(current => ({ ...current, [language.code]: value }))} key={value}>{value}<small>{zh ? "分" : "m"}</small></button>)}</div>
        <p>{duration / 5} {text(duration === 5 ? "round" : "rounds", "回合")} · {duration * 2} {text("words", "个词")} · {text("five skills", "五技能")}</p>
        <Link className={styles.start} href={`/${lang}/classes/${encodeURIComponent(course.id)}/sprint?minutes=${duration}`}>{text("Start", "开始")} {duration} {text("minutes", "分钟")} →</Link>
      </article>;
    })}{!entries.length ? <article className={styles.empty}><strong>{zh ? "添加第一种学习语言" : "Add your first learning language"}</strong><p>{zh ? "加入初级课程后，即可从用户面板直接开始今日速成。" : "Join a Beginner course to start Today’s Sprint directly from your dashboard."}</p><Link className={styles.start} href={`/${lang}/programs`}>{zh ? "选择课程" : "Choose a course"} →</Link></article> : null}<Link className={styles.addTile} href={`/${lang}/programs`}><span>＋</span><strong>{zh ? "添加新语言" : "Add a language"}</strong><small>{zh ? "选择新的初级课程" : "Choose another Beginner course"}</small></Link></div>
  </section>;
}
