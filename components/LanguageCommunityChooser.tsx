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

  async function openCommunity(code: SmartLingoCommunityLanguage) {
    rememberTargetLanguage(code);
    const joined = classFor(code, classes.joined);
    if (joined) {
      window.location.assign(`/${lang}/classes/${encodeURIComponent(joined.id)}`);
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
        window.location.assign(`/${lang}/classes/${encodeURIComponent(available.id)}`);
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
      <div className="lingo-community-heading">
        <p className="section-kicker">{zh ? "选择目标语言社区" : "CHOOSE A TARGET LANGUAGE COMMUNITY"}</p>
        <h1 id="language-community-title">{zh ? "您想加入哪个语言学习社区？" : "Which language community would you like to join?"}</h1>
        <p>{zh
          ? "可以学习新语言，也可以选择自己已经会的语言继续提高。每种语言都有官方社区班，并可包含老师新建的不同主题班级。"
          : "Learn a new language or keep developing one you already speak. Every language has an official community class and can include additional teacher-created classes."}</p>
      </div>
      <div className="lingo-community-grid">
        {SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => {
          const joined = classFor(language.code, classes.joined);
          const available = classFor(language.code, classes.available);
          const classCount = classes.all.filter(item => item.targetLanguage === language.code).length;
          const isBusy = joining === language.code;
          return (
            <button
              id={`language-community-${language.code}`}
              className={joined ? "joined" : ""}
              key={language.code}
              type="button"
              onClick={() => openCommunity(language.code)}
              aria-busy={isBusy}
            >
              <span className="lingo-community-name">
                <b>{zh ? language.nameZh : language.nameEn}</b>
                <small>{classCount > 0
                  ? (zh ? `${classCount} 个可见班级` : `${classCount} visible ${classCount === 1 ? "class" : "classes"}`)
                  : (zh ? "官方语言学习社区" : "Official language community")}</small>
              </span>
              <span className="lingo-community-state">{isBusy
                ? (zh ? "正在加入…" : "Joining…")
                : joined
                  ? (zh ? "已加入 · 进入" : "Joined · Enter")
                  : available?.canJoin
                    ? (zh ? "加入社区" : "Join community")
                    : (zh ? "查看班级" : "View classes")}</span>
            </button>
          );
        })}
      </div>
      {notice && <p className="lingo-community-notice" aria-live="polite">{notice}</p>}
    </section>
  );
}
