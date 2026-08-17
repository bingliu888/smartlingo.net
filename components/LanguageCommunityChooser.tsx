"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SMARTLINGO_LANGUAGE_COMMUNITIES,
  type SmartLingoCommunityLanguage,
} from "../lib/smartlingo-language-communities";
import { rememberTargetLanguage } from "./InterfaceLanguageMenu";

type Lang = "en" | "zh";

type CommunityClass = {
  id: string;
  ownerUserId?: string;
  targetLanguage: string;
  title: string;
  classKind?: string;
  membershipStatus?: string | null;
  isJoined?: boolean;
  isOwner?: boolean;
  canJoin?: boolean;
  priceCents?: number;
  enrollmentCount?: number;
};

type ClassContext = {
  currentUser?: { id: string };
  classes?: CommunityClass[];
  joinedClasses?: CommunityClass[];
};

export function LanguageCommunityChooser({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
  const [context, setContext] = useState<ClassContext | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/classes", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 401) {
          return null;
        }
        if (!response.ok) throw new Error("classes_unavailable");
        return response.json() as Promise<ClassContext>;
      })
      .then(value => value && setContext(value))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice(zh ? "暂时无法读取课程状态，仍可浏览语言。" : "Course status is temporarily unavailable. You can still browse languages.");
      });
    return () => controller.abort();
  }, [zh]);

  const classes = useMemo(() => {
    const all = context?.classes ?? [];
    const joined = context?.joinedClasses ?? all.filter(item => item.isJoined || item.isOwner || item.membershipStatus === "active");
    return { all, joined };
  }, [context]);

  function classFor(code: SmartLingoCommunityLanguage, source: CommunityClass[]) {
    return source.find(item => item.targetLanguage === code && item.classKind === "official_course")
      ?? source.find(item => item.targetLanguage === code);
  }

  function openLanguage(code: SmartLingoCommunityLanguage) {
    rememberTargetLanguage(code);
    const joined = classFor(code, classes.joined);
    if (joined) {
      window.location.assign(`/${lang}/classes/${encodeURIComponent(joined.id)}`);
      return;
    }

    window.location.assign(`/${lang}/programs/${encodeURIComponent(code)}`);
  }

  return (
    <section className="lingo-community-chooser" aria-labelledby="language-community-title">
      <div className="lingo-community-heading" data-readable-copy="home-language-copy">
        <p className="section-kicker">{zh ? "选择语言" : "CHOOSE A LANGUAGE"}</p>
        <h1 id="language-community-title" data-layout-text-fit="home-language-title">{zh ? "您想学习哪种语言？" : "Which language would you like to learn?"}</h1>
        <p>{zh
          ? "选择一门新语言，或继续提高您已经会的语言。下一页会显示课程详情与学习选项。"
          : "Choose a new language or keep improving one you already speak. The next page shows course details and learning options."}</p>
      </div>
      <div className="lingo-community-grid" data-layout-fill="home-language-grid">
        {SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => {
          const joined = classFor(language.code, classes.joined);
          const classCount = classes.all.filter(item => item.targetLanguage === language.code).length;
          return (
            <button
              id={`language-community-${language.code}`}
              className={joined ? "joined" : ""}
              key={language.code}
              type="button"
              onClick={() => openLanguage(language.code)}
              data-layout-track={`home-language-${language.code}`}
            >
              <span className="lingo-community-name">
                <b>{zh ? language.nameZh : language.nameEn}</b>
                <small>{classCount > 0
                  ? (zh ? `${classCount} 个可见课程` : `${classCount} visible ${classCount === 1 ? "course" : "courses"}`)
                  : (zh ? "查看课程详情" : "View course details")}</small>
              </span>
              <span className="lingo-community-state">{joined
                    ? (zh ? "已加入 · 进入课程" : "Joined · Open course")
                    : (zh ? "查看课程" : "View course")}</span>
            </button>
          );
        })}
      </div>
      {notice && <p className="lingo-community-notice" aria-live="polite">{notice}</p>}
    </section>
  );
}
