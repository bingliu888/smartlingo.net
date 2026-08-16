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
  availableClasses?: CommunityClass[];
};

export function LanguageCommunityChooser({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
  const [context, setContext] = useState<ClassContext | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SmartLingoCommunityLanguage | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/classes", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 401) {
          setSignedOut(true);
          return null;
        }
        if (!response.ok) throw new Error("classes_unavailable");
        return response.json() as Promise<ClassContext>;
      })
      .then(value => value && setContext(value))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice(zh ? "暂时无法读取班级状态，仍可浏览语言社区。" : "Class status is temporarily unavailable. You can still browse each language community.");
      });
    return () => controller.abort();
  }, [zh]);

  const classes = useMemo(() => {
    const all = context?.classes ?? [];
    const joined = context?.joinedClasses ?? all.filter(item => item.isJoined || item.isOwner || item.membershipStatus === "active");
    const available = context?.availableClasses ?? all.filter(item => !joined.some(joinedClass => joinedClass.id === item.id));
    return { all, joined, available };
  }, [context]);

  function classFor(code: SmartLingoCommunityLanguage, source: CommunityClass[]) {
    return source.find(item => item.targetLanguage === code && item.classKind === "official_language")
      ?? source.find(item => item.targetLanguage === code);
  }

  async function openTraining(code: SmartLingoCommunityLanguage, training: "vocabulary" | "dialogue") {
    rememberTargetLanguage(code);
    const joined = classFor(code, classes.joined);
    if (joined) {
      window.location.assign(`/${lang}/classes/${encodeURIComponent(joined.id)}/learn/session?training=${training}`);
      return;
    }

    const available = classFor(code, classes.available);
    if (signedOut || !context) {
      const returnTo = `/${lang}/classes?target=${encodeURIComponent(code)}`;
      window.location.assign(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (available?.canJoin && (available.priceCents ?? 0) === 0) {
      setJoining(code);
      setNotice("");
      try {
        const response = await fetch(`/api/classes/${encodeURIComponent(available.id)}/enroll`, { method: "POST" });
        if (!response.ok) throw new Error("join_failed");
        window.location.assign(`/${lang}/classes/${encodeURIComponent(available.id)}/placement`);
      } catch {
        setNotice(zh ? "暂时无法加入此社区，请进入班级目录后重试。" : "This community could not be joined yet. Please retry from the class directory.");
        setJoining(null);
      }
      return;
    }

    window.location.assign(`/${lang}/classes?target=${encodeURIComponent(code)}`);
  }

  return (
    <section className="lingo-community-chooser" aria-labelledby="language-community-title">
      <div className="lingo-community-heading" data-readable-copy="home-language-copy">
        <p className="section-kicker">{zh ? "选择目标语言社区" : "CHOOSE A TARGET LANGUAGE COMMUNITY"}</p>
        <h1 id="language-community-title" data-layout-text-fit="home-language-title">{zh ? "您想加入哪个语言学习社区？" : "Which language community would you like to join?"}</h1>
        <p>{zh
          ? "可以学习新语言，也可以选择自己已经会的语言继续提高。每种语言都有官方社区班，并可包含老师新建的不同主题班级。"
          : "Learn a new language or keep developing one you already speak. Every language has an official community class and can include additional teacher-created classes."}</p>
      </div>
      <div className="lingo-community-grid" data-layout-fill="home-language-grid">
        {SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => {
          const joined = classFor(language.code, classes.joined);
          const classCount = classes.all.filter(item => item.targetLanguage === language.code).length;
          const isBusy = joining === language.code;
          return (
            <button
              id={`language-community-${language.code}`}
              className={`${joined ? "joined" : ""}${selectedLanguage === language.code ? " selected" : ""}`.trim()}
              key={language.code}
              type="button"
              onClick={() => { rememberTargetLanguage(language.code); setSelectedLanguage(language.code); setNotice(""); }}
              aria-busy={isBusy}
              data-layout-track={`home-language-${language.code}`}
            >
              <span className="lingo-community-name">
                <b>{zh ? language.nameZh : language.nameEn}</b>
                <small>{classCount > 0
                  ? (zh ? `${classCount} 个可见班级` : `${classCount} visible ${classCount === 1 ? "class" : "classes"}`)
                  : (zh ? "官方语言学习社区" : "Official language community")}</small>
              </span>
              <span className="lingo-community-state">{isBusy
                ? (zh ? "正在加入…" : "Joining…")
                : selectedLanguage === language.code
                  ? (zh ? "已选择 · 请选择训练" : "Selected · Choose training")
                  : joined
                    ? (zh ? "已加入 · 选择训练" : "Joined · Choose training")
                    : (zh ? "选择语言" : "Select language")}</span>
            </button>
          );
        })}
      </div>
      {selectedLanguage ? (() => {
        const language = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === selectedLanguage)!;
        return <section className="lingo-training-menu" aria-labelledby="lingo-training-title" data-layout-fill="home-training-menu">
          <header>
            <p className="section-kicker">{zh ? "选择训练方式" : "CHOOSE YOUR TRAINING"}</p>
            <h2 id="lingo-training-title">{language.nativeName} · {zh ? language.nameZh : language.nameEn}</h2>
            <p>{zh ? "先建立可用词汇，再把它带进真实对话；两种训练共享同一条语言学习路径。" : "Build usable vocabulary, then carry it into real conversation. Both modes belong to the same language path."}</p>
          </header>
          <div>
            <button type="button" onClick={() => openTraining(selectedLanguage, "vocabulary")}>
              <span aria-hidden="true">Aa</span><strong>Vocab</strong>
              <small>{zh ? "词卡 · 主动回忆 · 连续掌握" : "Flashcards · active recall · mastery streaks"}</small>
              <b>{zh ? "开始词汇训练" : "Start vocab"} →</b>
            </button>
            <button type="button" onClick={() => openTraining(selectedLanguage, "dialogue")}>
              <span aria-hidden="true">◉</span><strong>Speaking</strong>
              <small>{zh ? "人工智能导师 · 情景对话 · 即时反馈" : "AI tutor · role-play · instant feedback"}</small>
              <b>{zh ? "开始口语训练" : "Start speaking"} →</b>
            </button>
          </div>
        </section>;
      })() : null}
      {notice && <p className="lingo-community-notice" aria-live="polite">{notice}</p>}
    </section>
  );
}
