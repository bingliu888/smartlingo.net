"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import styles from "./DashboardLearningHub.module.css";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";

export type DashboardJoinedCourse = { id: string; title: string; targetLanguage: string; packageTier: string };
type Area = "everyday" | "play" | "courses" | "ai";

export function DashboardLearningHub({ lang, courses }: { lang: InterfaceLanguage; courses: DashboardJoinedCourse[] }) {
  const zh = lang === "zh";
  const text = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const languages = useMemo(() => SMARTLINGO_LANGUAGE_COMMUNITIES.filter(language => courses.some(course => course.targetLanguage === language.code)), [courses]);
  const first = languages[0]?.code || "";
  const [selected, setSelected] = useState<Record<Area, string>>({ everyday: first, play: first, courses: first, ai: first });
  const areas: { id: Area; labelZh: string; labelEn: string; bodyZh: string; bodyEn: string }[] = [
    { id: "everyday", labelZh: "生活口语", labelEn: "Everyday speaking", bodyZh: "继续已加入语言的 12 个真实场景。", bodyEn: "Continue twelve real-life scenes in a joined language." },
    { id: "play", labelZh: "边玩边学", labelEn: "Learn through play", bodyZh: "练习智慧卡或进入每日挑战。", bodyEn: "Practice Smart Cards or enter the daily challenge." },
    { id: "courses", labelZh: "我的课程", labelEn: "My courses", bodyZh: "按语言查看已经加入的课程。", bodyEn: "View joined courses grouped by language." },
    { id: "ai", labelZh: "咨询AI", labelEn: "Ask AI", bodyZh: "带着所选语言进入 AI 对话与练习。", bodyEn: "Open AI conversation and practice with the selected language." },
  ];

  if (!languages.length) return <section className={styles.empty}><p>MY LEARNING</p><h2>{zh ? "还没有加入任何语言课程" : "No language course joined yet"}</h2><span>{zh ? "先从生活口语或边玩边学免费体验，再选择课程。" : "Try Everyday speaking or Learn through play for free, then choose a course."}</span><div><Link href={`/${lang}/play/everyday`}>{zh ? "生活口语" : "Everyday speaking"}</Link><Link href={`/${lang}/programs`}>{zh ? "选择课程" : "Choose course"}</Link></div></section>;

  return <section className={styles.hub} aria-label={zh ? "我的语言学习" : "My language learning"}>
    <header><p>MY LEARNING · BY LANGUAGE</p><h2>{zh ? "按语言继续已经加入的学习内容" : "Continue joined learning by language"}</h2><span>{zh ? "每个区域只显示您已经加入的语言；切换标签不会改变其他区域。" : "Each area shows only languages you joined. Tabs switch independently."}</span></header>
    <div className={styles.grid}>{areas.map(area => {
      const code = selected[area.id] || first;
      const language = languages.find(item => item.code === code) || languages[0];
      const languageCourses = courses.filter(course => course.targetLanguage === language.code);
      return <article key={area.id}>
        <div className={styles.title}><span>{area.id === "everyday" ? "☀" : area.id === "play" ? "◇" : area.id === "courses" ? "▤" : "●"}</span><div><h3>{zh ? area.labelZh : area.labelEn}</h3><p>{zh ? area.bodyZh : area.bodyEn}</p></div></div>
        <div className={styles.tabs} role="tablist" aria-label={`${text(area.labelEn, area.labelZh)} ${text("languages", "语言")}`}>{languages.map(item => <button role="tab" aria-selected={language.code === item.code} className={language.code === item.code ? styles.active : ""} onClick={() => setSelected(current => ({ ...current, [area.id]: item.code }))} key={item.code}>{text(item.nameEn, item.nameZh)}</button>)}</div>
        <div className={styles.content} role="tabpanel">
          <strong><span data-no-translate>{language.nativeName}</span> · {text(language.nameEn, language.nameZh)}</strong>
          {area.id === "everyday" ? <><p>{zh ? "12 个场景 · 每个场景 12 张自动听说幻灯片" : "12 situations · 12 automatic listen-and-speak slides each"}</p><Link href={`/${lang}/play/everyday?language=${language.code}`}>{zh ? "选择生活场景" : "Choose a situation"} →</Link></> : null}
          {area.id === "play" ? <><p>{zh ? "智慧卡练习、每日限时挑战与课程积分" : "Smart Card practice, daily timed challenge, and course credit"}</p><nav><Link href={`/${lang}/smartcards/starter-${language.code}`}>{zh ? "练习" : "Practice"}</Link><Link href={`/${lang}/play/challenge?language=${language.code}`}>{zh ? "挑战" : "Challenge"}</Link></nav></> : null}
          {area.id === "courses" ? <div className={styles.courseList}>{languageCourses.map(course => <Link href={`/${lang}/classes/${encodeURIComponent(course.id)}`} key={course.id}><span>{course.packageTier}</span><b data-no-translate>{course.title}</b><em>→</em></Link>)}</div> : null}
          {area.id === "ai" ? <><p>{zh ? "AI 将使用您选择的目标语言提供对话、发音与写作练习。" : "AI uses the selected target language for conversation, pronunciation, and writing practice."}</p><Link href={`/${lang}/assistant?language=${language.code}`}>{zh ? "开始咨询AI" : "Ask AI"} →</Link></> : null}
        </div>
      </article>;
    })}</div>
  </section>;
}
