"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RoomState = { code: string; title: string; live: boolean };
type State = { teachingRoom: RoomState; practiceRoom: RoomState; isOwner: boolean } | null;

export function CourseClassroomTile({ classId, lang, compact = false }: { classId: string; lang: "en" | "zh"; compact?: boolean }) {
  const zh = lang === "zh";
  const [state, setState] = useState<State>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/classes/${encodeURIComponent(classId)}/classroom`, { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("classroom_unavailable")))
      .then(data => setState({
        teachingRoom: { code: data.room.code, title: data.room.title, live: Boolean(data.room.streamActive) },
        practiceRoom: { code: data.practiceRoom.code, title: data.practiceRoom.title, live: Boolean(data.practiceRoom.streamActive) },
        isOwner: Boolean(data.isOwner),
      }))
      .catch(reason => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(true); });
    return () => controller.abort();
  }, [classId]);
  const rooms = [
    { key: "teaching", icon: "▣", eyebrow: zh ? "WEBINAR · 音视频" : "WEBINAR · A/V", title: zh ? "教课室" : "Teaching room", copy: state?.teachingRoom.title || (zh ? "管理员授课与协办主持演讲" : "Administrator teaching and co-host speakers"), live: state?.teachingRoom.live, code: state?.teachingRoom.code },
    { key: "practice", icon: "◉", eyebrow: zh ? "GROUP CALL · 语音" : "GROUP CALL · AUDIO", title: zh ? "练习室" : "Practice room", copy: state?.practiceRoom.title || (zh ? "同学免费讨论与口语练习" : "Free student discussion and speaking practice"), live: state?.practiceRoom.live, code: state?.practiceRoom.code },
  ];
  return <section className={`course-room-grid${compact ? " compact" : ""}`} data-layout-fill="course-classrooms" aria-label={zh ? "课程教课室与练习室" : "Course teaching and practice rooms"}>
    {rooms.map(room => <article className="course-classroom-tile" key={room.key}>
      <span className="course-classroom-icon" aria-hidden="true">{room.icon}</span>
      <div><small>{room.eyebrow}</small><h2>{room.title}</h2><p>{room.copy}</p><b>{room.live ? (zh ? "正在进行" : "Live now") : room.key === "practice" ? (zh ? "学员免费使用" : "Free for enrolled students") : (zh ? "课程专属" : "Course access")}</b>{error && <em>{zh ? "房间暂时不可用" : "Room is temporarily unavailable"}</em>}</div>
      {room.code && <Link className="primary-button" href={`/${lang}/classrooms/${room.code}`}>{state?.isOwner ? (zh ? "管理房间" : "Manage room") : (zh ? "进入房间" : "Enter room")} →</Link>}
    </article>)}
    <style>{`.class-detail-grid .course-classroom-tile{grid-column:auto!important}`}</style>
    <style>{`.course-room-grid{grid-column:1/-1;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:16px}.course-classroom-tile{width:100%;padding:26px;display:grid!important;grid-template-columns:54px minmax(0,1fr);align-items:start;gap:18px;border:1px solid #a7d6c4!important;border-radius:18px;background:#effaf5!important;min-height:0!important}.course-classroom-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:17px;background:#12634e;color:#fff;font-size:26px}.course-classroom-tile small{color:#c84a38;font-size:11px;font-weight:900;letter-spacing:.11em}.course-classroom-tile h2{margin:4px 0 5px!important;font-size:clamp(27px,3vw,40px)!important}.course-classroom-tile p{margin:0;color:#52645d!important}.course-classroom-tile b{display:block;margin-top:7px;color:#0c7257;font-size:13px}.course-classroom-tile em{display:block;margin-top:7px;color:#a3342c;font-size:13px}.course-classroom-tile>a{grid-column:1/3;width:100%;margin:0!important;text-align:center}.course-room-grid.compact{margin:28px auto;width:min(1200px,calc(100% - 40px))}@media(max-width:760px){.course-room-grid{grid-template-columns:1fr}.course-classroom-tile{grid-template-columns:48px minmax(0,1fr);padding:20px}.course-classroom-icon{width:48px;height:48px}.course-room-grid.compact{width:calc(100% - 28px)}}`}</style>
  </section>;
}
