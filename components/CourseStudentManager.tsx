"use client";

import { useCallback, useEffect, useState } from "react";

type Student = {
  userId: string;
  email: string;
  displayName: string;
  status: "trialing" | "active";
  trialEndsAt: number;
  currentPeriodEndsAt: number | null;
  providerSubscriptionId: string | null;
};

type Roster = { trial: Student[]; subscribers: Student[] };

const COPY = {
  en: {
    kicker: "COURSE ACCESS", title: "Course students", note: "Manual changes apply only to this course. Member accounts and platform roles are unchanged.",
    trial: "Trial", subscribers: "Subscribers", add: "Add subscriber", email: "Registered member email", submit: "Enable subscription",
    enabling: "Updating…", enable: "Enable Subscription", disable: "Disable Subscription", emptyTrial: "No trial students.", emptySubscribers: "No subscribers.",
    trialEnds: "Trial ends", periodEnds: "Access through", confirm: "Disable this subscription and pause access to this course? This does not delete the member account.",
    added: "Subscription enabled for this course.", disabled: "Subscription disabled for this course.", failed: "Unable to update course access.", expired: "Trial expired",
  },
  zh: {
    kicker: "课程权限", title: "课程学员", note: "人工操作只影响本课程，不会更改会员账号、全站角色或其他课程。",
    trial: "试用 Trial", subscribers: "订阅者 Subscribers", add: "添加订阅者", email: "已注册会员邮箱", submit: "启用订阅",
    enabling: "正在更新…", enable: "启用订阅", disable: "停用订阅", emptyTrial: "暂无试用学员。", emptySubscribers: "暂无订阅者。",
    trialEnds: "试用截止", periodEnds: "访问有效期至", confirm: "确认停用此订阅并暂停该学员访问本课程？会员账号不会被删除。",
    added: "已为本课程启用订阅。", disabled: "已停用本课程订阅。", failed: "无法更新课程权限。", expired: "试用已到期",
  },
} as const;

function date(value: number, lang: "en" | "zh") {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(new Date(value * 1000));
}

export function CourseStudentManager({ classId, lang }: { classId: string; lang: "en" | "zh" }) {
  const t = COPY[lang];
  const [roster, setRoster] = useState<Roster>({ trial: [], subscribers: [] });
  const [tab, setTab] = useState<keyof Roster>("trial");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/students`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || t.failed);
    setRoster(body);
  }, [classId, t.failed]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch(error => setNotice(error instanceof Error ? error.message : t.failed)), 0);
    return () => window.clearTimeout(timer);
  }, [load, t.failed]);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  async function addSubscriber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") || "");
    setBusy("add"); setNotice("");
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/students`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { form.reset(); setAdding(false); setTab("subscribers"); setNotice(t.added); await load(); }
    else setNotice(body.error || t.failed);
    setBusy("");
  }

  async function update(student: Student, action: "enable" | "disable") {
    if (action === "disable" && !window.confirm(t.confirm)) return;
    setBusy(student.userId); setNotice("");
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/students`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: student.userId, action }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setNotice(action === "enable" ? t.added : t.disabled); await load(); }
    else setNotice(body.error || t.failed);
    setBusy("");
  }

  const rows = roster[tab];
  return <article className="course-student-manager">
    <div className="course-student-heading"><div><span>{t.kicker}</span><h2>{t.title}</h2><p>{t.note}</p></div>
      <button type="button" className="course-student-add" onClick={() => setAdding(value => !value)} aria-expanded={adding}>+ {t.add}</button></div>
    {adding && <form className="course-student-add-form" onSubmit={addSubscriber}><label>{t.email}<input name="email" type="email" required autoComplete="email" placeholder="name@example.com"/></label><button disabled={busy === "add"}>{busy === "add" ? t.enabling : t.submit}</button></form>}
    <div className="course-student-tabs" role="tablist" aria-label={t.title}>
      <button type="button" role="tab" aria-selected={tab === "trial"} onClick={() => setTab("trial")}>{t.trial} <b>{roster.trial.length}</b></button>
      <button type="button" role="tab" aria-selected={tab === "subscribers"} onClick={() => setTab("subscribers")}>{t.subscribers} <b>{roster.subscribers.length}</b></button>
    </div>
    <div className="course-student-list">{rows.length ? rows.map(student => <div className="course-student-row" key={student.userId}>
      <div><strong>{student.displayName}</strong><small>{student.email}</small><small>{tab === "trial" ? `${now > 0 && student.trialEndsAt * 1000 <= now ? t.expired : t.trialEnds}: ${date(student.trialEndsAt, lang)}` : student.currentPeriodEndsAt ? `${t.periodEnds}: ${date(student.currentPeriodEndsAt, lang)}` : ""}</small></div>
      <button type="button" disabled={busy === student.userId} onClick={() => void update(student, tab === "trial" ? "enable" : "disable")}>{busy === student.userId ? t.enabling : tab === "trial" ? t.enable : t.disable}</button>
    </div>) : <p className="course-student-empty">{tab === "trial" ? t.emptyTrial : t.emptySubscribers}</p>}</div>
    {notice && <p className="course-student-notice" role="status">{notice}</p>}
    <style>{`
      .course-student-manager{grid-column:1/-1!important;background:#fffdf7!important}.course-student-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}.course-student-heading h2{margin-bottom:10px}.course-student-heading p{max-width:72ch;margin:0}.course-student-add{flex:0 0 auto;padding:12px 16px;border:0;border-radius:10px;background:#123f35;color:#fff;font-weight:850}.course-student-add-form{margin-top:22px;padding:18px;display:flex;align-items:end;gap:12px;border-radius:12px;background:#e7eee9}.course-student-add-form label{flex:1;display:grid;gap:7px;font-weight:800}.course-student-add-form input{width:100%;padding:12px;border:1px solid #8ca49b;border-radius:8px;font:inherit}.course-student-add-form button,.course-student-row button{padding:12px 16px;border:1px solid #123f35;border-radius:9px;background:#123f35;color:#fff;font-weight:850}.course-student-tabs{display:flex;gap:8px;margin-top:24px;border-bottom:1px solid #c9d7d1}.course-student-tabs button{padding:12px 14px;border:0;border-bottom:3px solid transparent;background:transparent;color:#55645f;font:800 15px inherit}.course-student-tabs button[aria-selected=true]{border-color:#cf4f3c;color:#123f35}.course-student-tabs b{margin-left:6px;padding:3px 7px;border-radius:999px;background:#dceae4}.course-student-row{padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid #dfe7e3}.course-student-row>div{display:grid;gap:4px}.course-student-row small{color:#65746e}.course-student-row button{background:#fff;color:#123f35}.course-student-row button:disabled,.course-student-add-form button:disabled{opacity:.55}.course-student-empty{padding:22px 0;margin:0}.course-student-notice{margin:16px 0 0!important;padding:12px;border-radius:8px;background:#e7eee9;color:#123f35!important;font-weight:750}@media(max-width:620px){.course-student-heading,.course-student-row,.course-student-add-form{align-items:stretch;flex-direction:column}.course-student-add,.course-student-row button{width:100%}}
    `}</style>
  </article>;
}
