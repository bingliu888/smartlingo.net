"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Learner = { identity: string; displayName: string; isMember: number };

export type ClassDetailRoom = {
  code: string;
  title: string;
  description: string;
  subject: string;
  hostName: string;
  classType: "public" | "trial" | "private";
  streamingMode: "audio" | "video";
  realtimeMode: "group_call" | "webinar" | "livestream";
  startsAt: number;
  durationMinutes: number;
  tuitionCents: number;
  streamActive: number;
};

function activeChinese(locale: "zh" | "en" | "auto") {
  if (locale !== "auto") return locale === "zh";
  return typeof document !== "undefined" && (document.documentElement.dataset.language === "zh" || document.documentElement.lang.toLowerCase().startsWith("zh"));
}

export function ClassDetailExperience({ room, roomHref, initialDisplayName = "", locale = "auto", mediaBase = "/api/classes" }: { room: ClassDetailRoom; roomHref: string; initialDisplayName?: string; locale?: "zh" | "en" | "auto"; mediaBase?: string }) {
  const [zh, setZh] = useState(locale === "zh");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [learners, setLearners] = useState<Learner[]>([]);
  const ended = room.startsAt + room.durationMinutes * 60 < Math.floor(Date.now() / 1000);
  const destination = useMemo(() => `${roomHref}${roomHref.includes("?") ? "&" : "?"}name=${encodeURIComponent(displayName.trim())}`, [displayName, roomHref]);

  useEffect(() => {
    const update = () => setZh(activeChinese(locale));
    update();
    if (locale !== "auto") return;
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "data-language"] });
    window.addEventListener("storage", update);
    return () => { observer.disconnect(); window.removeEventListener("storage", update); };
  }, [locale]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const response = await fetch(`${mediaBase}/${room.code}/media`, { cache: "no-store" }).catch(() => null);
      if (!alive || !response?.ok) return;
      const data = await response.json().catch(() => ({})) as { users?: Learner[] };
      setLearners(Array.isArray(data.users) ? data.users : []);
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [mediaBase, room.code]);

  const share = useCallback(async () => {
    const data = { title: room.title, text: `${room.title} · ${room.code}`, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard.writeText(window.location.href);
  }, [room.code, room.title]);

  const createShareImage = useCallback(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) return;
    const gradient = context.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#042b38"); gradient.addColorStop(1, "#08795c");
    context.fillStyle = gradient; context.fillRect(0, 0, 1200, 630);
    context.fillStyle = "#2de3aa"; context.beginPath(); context.arc(104, 104, 30, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#ffffff"; context.font = "800 30px system-ui"; context.fillText(`CLASS · ${room.code}`, 75, 190);
    context.font = "800 66px system-ui";
    const title = room.title.length > 30 ? `${room.title.slice(0, 30)}…` : room.title;
    context.fillText(title, 75, 300, 1050);
    context.fillStyle = "#bfeee0"; context.font = "500 30px system-ui";
    context.fillText(`${room.hostName} · ${new Date(room.startsAt * 1000).toLocaleString()}`, 75, 380, 1050);
    context.fillStyle = "#ffffff"; context.font = "700 28px system-ui"; context.fillText(window.location.href, 75, 535, 1050);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `class-${room.code}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: room.title, url: window.location.href, files: [file] }).catch(() => undefined);
    else { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  }, [room.code, room.hostName, room.startsAt, room.title]);

  const statusTitle = room.classType === "private" ? (zh ? "私课" : "Private class") : ended ? (zh ? "本次课程已结束" : "Class session ended") : room.streamActive ? (zh ? "课堂直播中" : "Class is live") : (zh ? "准备进入课堂？" : "Ready to enter class?");
  const statusCopy = ended ? (zh ? "本次课程已结束；课堂、录音、附件与消息会永久保留，直至教师或管理员主动删除。" : "This class session ended. The classroom, recordings, attachments, and messages remain available until the teacher or administrator deletes it.") : (zh ? "进入课堂不会请求设备权限；已有直播时会自动以观众身份加入。" : "Entering does not request device access. If streaming is live, you join automatically as a viewer.");

  return <main className="class-entry-page">
    <div className="class-entry-layout">
      <section className="class-entry-main">
        <header className="class-entry-heading">
          <p>CLASS · {room.code}</p><h1>{room.title}</h1>
          <span>{room.description || (zh ? "教师尚未添加课程介绍。" : "The teacher has not added a class description.")}</span>
          <div className="class-entry-meta"><b>{room.subject || (zh ? "实时课堂" : "Live class")}</b><b>{new Date(room.startsAt * 1000).toLocaleString(zh ? "zh-CN" : "en-US")}</b><b>{room.durationMinutes} {zh ? "分钟" : "min"}</b><b>{zh ? "教师" : "Teacher"}: {room.hostName}</b><b>{room.tuitionCents > 0 ? `$${(room.tuitionCents / 100).toFixed(2)}` : (zh ? "免费" : "Free")}</b></div>
          <nav><button onClick={() => void share()}>↗ {zh ? "分享" : "Share"}</button><button onClick={() => void createShareImage()}>✦ {zh ? "生成课程分享图" : "Create class image"}</button></nav>
        </header>
        <section className="class-entry-stage">
          <div className="class-entry-orbit"><strong>{ended ? "✓" : room.streamActive ? "●" : "◎"}</strong><i/><i/><i/></div>
          <div className="class-entry-form"><h2>{statusTitle}</h2><p>{statusCopy}</p><label><span>{zh ? "显示名称" : "Display name"}</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={zh ? "您的名称" : "Your name"} maxLength={80}/></label><Link className={displayName.trim().length < 2 ? "disabled" : ""} href={destination} onClick={event => { if (displayName.trim().length < 2) event.preventDefault(); }}>{zh ? "进入课堂" : "Enter class"} →</Link></div>
        </section>
      </section>
      <aside className="class-entry-attendees"><header><div><i/><h2>{zh ? "在线学员" : "Online learners"}</h2></div><small>{learners.length}</small></header><div>{learners.length ? learners.map(learner => <article key={learner.identity}><span>{learner.displayName.slice(0, 1).toUpperCase()}</span><p><strong>{learner.displayName}</strong><small>{learner.isMember ? (zh ? "会员学员" : "Member learner") : (zh ? "访客学员" : "Guest learner")}</small></p></article>) : <section><b>◎</b><p>{zh ? "进入课堂后会显示在线学员。" : "Online learners appear after entering the class."}</p></section>}</div></aside>
    </div>
  </main>;
}
