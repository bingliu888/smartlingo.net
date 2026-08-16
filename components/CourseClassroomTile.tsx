"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type State = { code: string; title: string; isOwner: boolean; live: boolean } | null;

export function CourseClassroomTile({ classId, lang, compact = false }: { classId: string; lang: "en" | "zh"; compact?: boolean }) {
  const zh = lang === "zh";
  const [state, setState] = useState<State>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/classes/${encodeURIComponent(classId)}/classroom`, { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("classroom_unavailable")))
      .then(data => setState({ code: data.room.code, title: data.room.title, isOwner: Boolean(data.isOwner), live: Boolean(data.room.streamActive) }))
      .catch(reason => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(true); });
    return () => controller.abort();
  }, [classId]);
  return <article className={`course-classroom-tile${compact ? " compact" : ""}`} data-layout-fill="course-classroom">
    <span className="course-classroom-icon" aria-hidden="true">◉</span>
    <div><small>{zh ? "课程教室" : "COURSE CLASSROOM"}</small><h2>{zh ? "教室" : "Classroom"}</h2><p>{state?.title || (zh ? "Webinar · 音视频" : "Webinar · A/V")}</p><b>{state?.live ? (zh ? "正在直播" : "Live now") : (zh ? "Webinar · 音视频" : "Webinar · A/V")}</b>{error && <em>{zh ? "教室暂时不可用" : "Classroom is temporarily unavailable"}</em>}</div>
    {state && <Link className="primary-button" href={`/${lang}/classrooms/${state.code}`}>{state.isOwner ? (zh ? "管理教室" : "Manage classroom") : (zh ? "进入教室" : "Enter classroom")} →</Link>}
    <style>{`.course-classroom-tile{grid-column:1/-1;width:100%;padding:26px;display:grid!important;grid-template-columns:54px minmax(0,1fr) auto;align-items:center;gap:18px;border:1px solid #a7d6c4!important;border-radius:18px;background:#effaf5!important;min-height:0!important}.course-classroom-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:17px;background:#12634e;color:#fff;font-size:26px}.course-classroom-tile small{color:#c84a38;font-size:11px;font-weight:900;letter-spacing:.11em}.course-classroom-tile h2{margin:4px 0 5px!important;font-size:clamp(27px,3vw,40px)!important}.course-classroom-tile p{margin:0;color:#52645d!important}.course-classroom-tile b{display:block;margin-top:7px;color:#0c7257;font-size:13px}.course-classroom-tile em{display:block;margin-top:7px;color:#a3342c;font-size:13px}.course-classroom-tile>a{width:max-content;margin:0!important;white-space:nowrap}.course-classroom-tile.compact{margin:28px auto;width:min(1200px,calc(100% - 40px))}@media(max-width:720px){.course-classroom-tile{grid-template-columns:48px minmax(0,1fr);padding:20px}.course-classroom-icon{width:48px;height:48px}.course-classroom-tile>a{grid-column:1/3;width:100%;text-align:center}.course-classroom-tile.compact{width:calc(100% - 28px)}}`}</style>
  </article>;
}
