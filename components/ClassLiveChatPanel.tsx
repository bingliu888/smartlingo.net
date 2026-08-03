"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LiveChatState = {
  threadId: string;
  memberCount: number;
  onlineCount: number;
  activeAudioCall?: { id: string; mode: string; status: string } | null;
};

export function ClassLiveChatPanel({ classId, lang, compact = false }: {
  classId: string;
  lang: "en" | "zh";
  compact?: boolean;
}) {
  const zh = lang === "zh";
  const [state, setState] = useState<LiveChatState | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/live-chat`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as (LiveChatState & { error?: string }) | null;
    if (response.ok && payload?.threadId) {
      setState(payload);
      setError("");
    } else if (response.status !== 401 && response.status !== 403) {
      setError(zh ? "暂时无法载入班级聊天。" : "Class chat is temporarily unavailable.");
    }
  }, [classId, zh]);

  useEffect(() => {
    const startup = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 15_000);
    return () => { window.clearTimeout(startup); window.clearInterval(timer); };
  }, [load]);

  return <article className={`class-live-chat-panel${compact ? " compact" : ""}`} data-layout-fill={compact ? undefined : "class-live-chat"}>
    <div className="class-live-chat-icon" aria-hidden="true">◌</div>
    <div>
      <span>{zh ? "班级交流" : "CLASS COMMUNITY"}</span>
      <h2>Live Chat</h2>
      <p>{state
        ? (zh ? `${state.onlineCount} 人在线 · 共 ${state.memberCount} 位成员` : `${state.onlineCount} online · ${state.memberCount} members`)
        : (zh ? "正在查看在线成员…" : "Checking who is online…")}</p>
      {state?.activeAudioCall && <small>{zh ? "● 语音通话正在进行" : "● Audio call in progress"}</small>}
      {error && <small className="error">{error}</small>}
    </div>
    {state && <Link className="primary-button" href={`/${lang}/messages/live/${encodeURIComponent(state.threadId)}`}>
      {state.activeAudioCall ? (zh ? "进入并加入通话" : "Enter and join call") : (zh ? "进入实时聊天" : "Enter Live Chat")} →
    </Link>}
    <style>{`
      .class-live-chat-panel{width:100%;padding:26px;display:grid!important;grid-template-columns:54px minmax(0,1fr) auto;align-items:center;gap:18px;border:1px solid #a7d6c4!important;border-radius:18px;background:#effaf5!important;min-height:0!important}.class-live-chat-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:17px;background:#12634e;color:#fff;font-size:34px}.class-live-chat-panel span{color:#c84a38;font-size:11px;font-weight:900;letter-spacing:.11em}.class-live-chat-panel h2{margin:4px 0 5px!important;font-size:clamp(27px,3vw,40px)!important}.class-live-chat-panel p{margin:0;color:#52645d!important}.class-live-chat-panel small{display:block;margin-top:7px;color:#0c7257;font-weight:800}.class-live-chat-panel small.error{color:#a3342c}.class-live-chat-panel>a{width:max-content;margin:0!important;white-space:nowrap}.class-live-chat-panel.compact{margin:28px auto;width:min(1200px,calc(100% - 40px))}@media(max-width:720px){.class-live-chat-panel{grid-template-columns:48px minmax(0,1fr);padding:20px}.class-live-chat-icon{width:48px;height:48px}.class-live-chat-panel>a{grid-column:1/3;width:100%;text-align:center}.class-live-chat-panel.compact{width:calc(100% - 28px)}}
    `}</style>
  </article>;
}
