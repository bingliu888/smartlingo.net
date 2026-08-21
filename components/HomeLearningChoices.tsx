"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { SMARTLINGO_EVERYDAY_SCENARIOS } from "../lib/smartlingo-everyday-speaking";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { rememberTargetLanguage } from "./InterfaceLanguageMenu";
import styles from "./HomeLearningChoices.module.css";

type Area = "everyday" | "play" | "courses" | "ai";
type Choice = { id: string; titleZh: string; titleEn: string; bodyZh: string; bodyEn: string; image?: string; icon?: string };

const PLAY_CHOICES: Choice[] = [
  { id: "sprint", icon: "⚡", titleZh: "今日速成", titleEn: "Today’s Sprint", bodyZh: "选择 5–20 分钟，混合练习五项技能。", bodyEn: "Choose 5–20 minutes of mixed five-skill practice." },
  { id: "practice", icon: "◇", titleZh: "智慧卡练习", titleEn: "Smart Card Practice", bodyZh: "看词、选义、听读、开口说。", bodyEn: "See, choose, listen, and speak." },
  { id: "challenge", icon: "🏆", titleZh: "智慧卡挑战", titleEn: "Smart Card Challenge", bodyZh: "每日限时挑战、排名与课程积分。", bodyEn: "Daily timed rounds, rankings, and course credit." },
];
const COURSE_CHOICES: Choice[] = [
  { id: "basic", icon: "A1", titleZh: "初期课程", titleEn: "Beginner", bodyZh: "核心词汇、发音、听力与引导口语。", bodyEn: "Core vocabulary, pronunciation, listening, and guided speaking." },
  { id: "intermediate", icon: "A2", titleZh: "中级课程", titleEn: "Intermediate", bodyZh: "增加生活对话与实用写作。", bodyEn: "Adds everyday dialogue and practical writing." },
  { id: "advanced", icon: "B1+", titleZh: "高级课程", titleEn: "Advanced", bodyZh: "增加发音修正、演讲与深度表达。", bodyEn: "Adds pronunciation refinement, speeches, and independent expression." },
];
const AI_CHOICES: Choice[] = [
  { id: "conversation", icon: "●", titleZh: "生活对话", titleEn: "Everyday conversation", bodyZh: "围绕真实场景问答与角色练习。", bodyEn: "Questions and role-play around real situations." },
  { id: "pronunciation", icon: "◉", titleZh: "发音教练", titleEn: "Pronunciation coach", bodyZh: "询问音标、节奏与清晰表达建议。", bodyEn: "Ask about sounds, rhythm, and intelligibility." },
  { id: "writing", icon: "✎", titleZh: "写作助手", titleEn: "Writing coach", bodyZh: "练习消息、邮件与日常短文。", bodyEn: "Practice messages, emails, and practical short writing." },
];

export function HomeLearningChoices({ lang }: { lang: "zh" | "en" }) {
  const zh = lang === "zh";
  const [selected, setSelected] = useState<Partial<Record<Area, string>>>({});
  const rails = useRef<Partial<Record<Area, HTMLDivElement | null>>>({});
  const sections: { area: Area; kicker: string; titleZh: string; titleEn: string; introZh: string; introEn: string; choices: Choice[] }[] = [
    { area: "everyday", kicker: "REAL LIFE", titleZh: "生活口语", titleEn: "Everyday speaking", introZh: "先选生活场景，再选想练习的语言。", introEn: "Choose a situation first, then the language to practice.", choices: SMARTLINGO_EVERYDAY_SCENARIOS.map(item => ({ id: item.id, titleZh: item.nameZh, titleEn: item.nameEn, bodyZh: item.goalZh, bodyEn: item.goalEn, image: item.image, icon: item.icon })) },
    { area: "play", kicker: "PLAY", titleZh: "边玩边学", titleEn: "Learn through play", introZh: "先选玩法，再选语言并立即开始。", introEn: "Choose a game, then a language and start immediately.", choices: PLAY_CHOICES },
    { area: "courses", kicker: "COURSES", titleZh: "选择课程", titleEn: "Choose a course", introZh: "先选课程等级，再选语言查看并加入。", introEn: "Choose a course level, then a language to view and join.", choices: COURSE_CHOICES },
    { area: "ai", kicker: "AI", titleZh: "咨询AI", titleEn: "Ask AI", introZh: "先选练习目标，再告诉 AI 您想使用的语言。", introEn: "Choose a practice goal, then the language for your AI session.", choices: AI_CHOICES },
  ];

  function href(area: Area, choice: string, language: string) {
    if (area === "everyday") return `/${lang}/play/everyday?language=${language}&scene=${choice}`;
    if (area === "play") return choice === "sprint" ? `/${lang}/play?language=${language}` : choice === "challenge" ? `/${lang}/play/challenge?language=${language}` : `/${lang}/smartcards/starter-${language}`;
    if (area === "courses") return `/${lang}/classes/course_${language}_${choice}`;
    return `/${lang}/assistant?language=${language}&mode=${choice}`;
  }

  function scroll(area: Area, direction: -1 | 1) {
    rails.current[area]?.scrollBy({ left: direction * Math.min(520, window.innerWidth * .72), behavior: "smooth" });
  }

  return <section className={styles.hub} aria-label={zh ? "SmartLingo 学习入口" : "SmartLingo learning choices"}>
    <header className={styles.hubHeading}><p>CHOOSE · SPEAK · GROW</p><h2>{zh ? "先选择想做什么，再选择语言。" : "Choose what to do, then choose a language."}</h2><span>{zh ? "四个入口使用同一套十二种语言；每一步都清楚、可返回，也不会自动订阅课程。" : "All four paths use the same twelve languages. Every choice is clear, reversible, and never starts a subscription automatically."}</span></header>
    {sections.map(section => {
      const active = selected[section.area];
      return <article className={styles.section} key={section.area} id={`home-${section.area}`}>
        <header><div><p>{section.kicker}</p><h2>{zh ? section.titleZh : section.titleEn}</h2><span>{zh ? section.introZh : section.introEn}</span></div><nav aria-label={zh ? `${section.titleZh}滑动控制` : `${section.titleEn} slider controls`}><button type="button" onClick={() => scroll(section.area, -1)} aria-label={zh ? "向前滑动" : "Scroll back"}>‹</button><button type="button" onClick={() => scroll(section.area, 1)} aria-label={zh ? "向后滑动" : "Scroll forward"}>›</button></nav></header>
        <div className={styles.rail} ref={node => { rails.current[section.area] = node; }}>
          {section.choices.map((choice, index) => <button type="button" aria-pressed={active === choice.id} className={active === choice.id ? styles.active : ""} onClick={() => setSelected(current => ({ ...current, [section.area]: choice.id }))} key={choice.id}>
            {choice.image ? <img src={choice.image} alt=""/> : <span className={styles.icon}>{choice.icon || String(index + 1).padStart(2, "0")}</span>}
            <small>{String(index + 1).padStart(2, "0")}</small><strong>{zh ? choice.titleZh : choice.titleEn}</strong><em>{zh ? choice.bodyZh : choice.bodyEn}</em><b>{active === choice.id ? (zh ? "已选择" : "Selected") : (zh ? "选择" : "Choose")}</b>
          </button>)}
        </div>
        {active ? <div className={styles.languages}><div><strong>{zh ? "下一步：选择语言" : "Next: choose a language"}</strong><button type="button" onClick={() => setSelected(current => ({ ...current, [section.area]: undefined }))}>{zh ? "更改上一步" : "Change first choice"}</button></div><nav>{SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => <Link onClick={() => rememberTargetLanguage(language.code)} href={href(section.area, active, language.code)} key={language.code}><small>{language.code.toUpperCase()}</small><strong>{zh ? language.nameZh : language.nameEn}</strong><span>{language.nativeName}</span></Link>)}</nav></div> : <p className={styles.prompt}>{zh ? "选择上方一个项目后，这里会显示十二种语言。" : "Choose an item above to reveal all twelve languages here."}</p>}
      </article>;
    })}
  </section>;
}
