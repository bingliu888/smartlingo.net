"use client";

import Link from "next/link";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { interfaceLanguages, interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import styles from "./DashboardLearningHub.module.css";

export type DashboardJoinedCourse = { id: string; title: string; targetLanguage: string; packageTier: string };
type Feature = "smartcards" | "challenge" | "everyday" | "courses";

const featureCopy: Record<Feature, { icon: string; domainEn: string; domainZh: string; en: string; zh: string; bodyEn: string; bodyZh: string }> = {
  smartcards: { icon: "◇", domainEn: "Practice", domainZh: "练习", en: "Smart Card Practice", zh: "智慧卡练习", bodyEn: "Review vocabulary by difficulty and frequency.", bodyZh: "按难度和常用度复习词汇。" },
  challenge: { icon: "⚡", domainEn: "Practice", domainZh: "练习", en: "Smart Card Challenge", zh: "智慧卡挑战", bodyEn: "Play the daily timed challenge and compare scores.", bodyZh: "参加每日限时挑战并比较成绩。" },
  everyday: { icon: "☀", domainEn: "Speak", domainZh: "开口", en: "Everyday speaking", zh: "生活口语", bodyEn: "Practice twelve useful real-life situations.", bodyZh: "练习十二个实用生活场景。" },
  courses: { icon: "▤", domainEn: "Learn", domainZh: "学习", en: "Courses", zh: "课程", bodyEn: "Continue courses you joined or subscribed to.", bodyZh: "继续已经加入或订阅的课程。" },
};

function featureHref(feature: Feature, lang: InterfaceLanguage, language: string) {
  if (feature === "smartcards") return `/${lang}/smartcards/starter-${language}`;
  if (feature === "challenge") return `/${lang}/play/challenge?language=${language}`;
  if (feature === "everyday") return `/${lang}/play/everyday?language=${language}`;
  return `/${lang}/classes?mine=1&language=${language}`;
}

function addHref(feature: Feature, lang: InterfaceLanguage) {
  if (feature === "smartcards") return `/${lang}/smartcards`;
  if (feature === "challenge") return `/${lang}/play/challenge`;
  if (feature === "everyday") return `/${lang}/play/everyday`;
  return `/${lang}/programs`;
}

export function DashboardLearningHub({ lang, courses }: { lang: InterfaceLanguage; courses: DashboardJoinedCourse[] }) {
  const zh = lang === "zh";
  const text = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const sourceName = interfaceLanguages.find(item => item.code === lang)?.nativeName ?? "English";
  const languages = SMARTLINGO_LANGUAGE_COMMUNITIES.filter(language => courses.some(course => course.targetLanguage === language.code));
  const features: Feature[] = ["smartcards", "challenge", "everyday", "courses"];

  return <section className={styles.hub} aria-label={text("My learning", "我的学习")}>
    <header><p>MY LEARNING</p><h2>{text("Continue each learning feature", "按学习功能继续")}</h2><span>{text("Each section keeps its own language choices. Add a language or course from the relevant feature page.", "每个区域分别管理自己的学习语言；请从对应功能页面添加语言或课程。")}</span></header>
    <div className={styles.grid}>{features.map(feature => {
      const copy = featureCopy[feature];
      return <article key={feature}>
        <div className={styles.title}><span>{copy.icon}</span><div><small>{text(copy.domainEn, copy.domainZh)}</small><h3>{text(copy.en, copy.zh)}</h3><p>{text(copy.bodyEn, copy.bodyZh)}</p></div></div>
        <div className={styles.languageList}>{languages.map(language => {
          const languageCourses = courses.filter(course => course.targetLanguage === language.code);
          return <Link href={featureHref(feature, lang, language.code)} key={language.code}>
            <span>{language.code.toUpperCase()}</span><div><strong data-no-translate>{language.nativeName}</strong><small>{zh ? `用${sourceName}学${language.nameZh}` : `Learn ${language.nameEn} through ${sourceName}`}</small>{feature === "courses" ? <em>{languageCourses.length} {text(languageCourses.length === 1 ? "course" : "courses", "门课程")}</em> : null}</div><b>→</b>
          </Link>;
        })}{!languages.length ? <p className={styles.noLanguages}>{feature === "courses" ? text("No subscribed courses yet.", "尚未订阅课程。") : text("No language selected yet.", "尚未选择语言。")}</p> : null}</div>
        <Link className={styles.addAction} href={addHref(feature, lang)}>＋ {feature === "courses" ? text("Add course", "添加课程") : text("Add language", "添加语言")}</Link>
      </article>;
    })}</div>
  </section>;
}
