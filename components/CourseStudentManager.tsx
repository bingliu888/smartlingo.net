"use client";

import { useCallback, useEffect, useState } from "react";

type Student = { userId: string; email: string; displayName: string; joinedAt: number; maxActive: boolean; currentPeriodEndsAt: number | null };
const COPY = {
  en: { kicker: "COURSE ROSTER", title: "Course learners", note: "This is a read-only roster. Beginner is free; Intermediate and Advanced use the one-time Max trial or an active Max term.", empty: "No learners have added this course yet.", max: "Max active", inactive: "Max inactive", joined: "Joined", through: "Max through", failed: "Unable to load the course roster." },
  zh: { kicker: "课程学员", title: "课程学员名单", note: "这是只读名单。初级永久免费；中级和高级使用一次性 7 天 Max 试用或有效 Max。", empty: "还没有学员加入本课程。", max: "Max 有效", inactive: "Max 未启用", joined: "加入日期", through: "Max 有效期至", failed: "无法读取课程学员名单。" },
} as const;
function date(value: number, lang: "en" | "zh") { return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(new Date(value * 1_000)); }

export function CourseStudentManager({ classId, lang }: { classId: string; lang: "en" | "zh" }) {
  const t = COPY[lang]; const [students, setStudents] = useState<Student[]>([]); const [notice, setNotice] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/students`, { cache: "no-store" }); const body = await response.json().catch(() => ({})) as { students?: Student[]; error?: string }; if (!response.ok) throw new Error(body.error || t.failed); setStudents(body.students || []); }, [classId, t.failed]);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch(error => setNotice(error instanceof Error ? error.message : t.failed)), 0); return () => window.clearTimeout(timer); }, [load, t.failed]);
  return <article className="course-student-manager"><header><span>{t.kicker}</span><h2>{t.title}</h2><p>{t.note}</p></header>
    {students.length ? <div className="course-student-list">{students.map(student => <div className="course-student-row" key={student.userId}><div><strong>{student.displayName}</strong><small>{student.email}</small><small>{t.joined}: {date(student.joinedAt, lang)}</small></div><div><b data-active={student.maxActive}>{student.maxActive ? t.max : t.inactive}</b>{student.maxActive && student.currentPeriodEndsAt ? <small>{t.through}: {date(student.currentPeriodEndsAt, lang)}</small> : null}</div></div>)}</div> : <p className="course-student-empty">{t.empty}</p>}
    {notice && <p className="course-student-notice" role="status">{notice}</p>}
    <style>{`.course-student-manager{grid-column:1/-1!important;background:#fffdf7!important}.course-student-manager header>span{color:#087d62;font-size:11px;font-weight:950;letter-spacing:.12em}.course-student-manager header h2{margin:8px 0 10px}.course-student-manager header p{max-width:76ch;margin:0}.course-student-list{margin-top:24px;border-top:1px solid #dfe7e3}.course-student-row{padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid #dfe7e3}.course-student-row>div{display:grid;gap:4px}.course-student-row>div:last-child{text-align:right}.course-student-row small{color:#65746e}.course-student-row b{padding:7px 9px;border-radius:999px;background:#eee;color:#6e746f;font-size:12px}.course-student-row b[data-active=true]{background:#dff4e9;color:#08725e}.course-student-empty{padding:22px 0;margin:0}.course-student-notice{margin:16px 0 0!important;padding:12px;border-radius:8px;background:#fde8e2;color:#8a3325!important;font-weight:750}@media(max-width:620px){.course-student-row{align-items:stretch;flex-direction:column}.course-student-row>div:last-child{text-align:left}}`}</style>
  </article>;
}
