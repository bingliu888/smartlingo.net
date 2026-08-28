"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InterfaceLanguage } from "../lib/interface-locale";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { courseSupervisorCopy } from "../lib/course-supervisor-locale";

type Row = {
  id: string;
  status: string;
  currentPeriodEndsAt: number | null;
  trialEndsAt: number;
  classId: string;
  courseName: string;
  targetLanguage: string;
  packageTier: string;
  subscriberName: string;
  subscriberEmail: string;
  supervisorRefId: string;
  rewardEvents: number;
};

export function MyStudents({ lang }: { lang: InterfaceLanguage }) {
  const c = courseSupervisorCopy(lang);
  const [language, setLanguage] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [refId, setRefId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/my-students?language=${encodeURIComponent(language)}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as { rows?: Row[]; supervisorRefId?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "LOAD_FAILED");
        if (active) {
          setRows(data.rows || []);
          setRefId(data.supervisorRefId || "");
          setMessage("");
        }
      })
      .catch(() => active && setMessage(c.loadError));
    return () => { active = false; };
  }, [language, c.loadError]);

  return <section className="my-students">
    <header><p>VIP · SUPERVISOR</p><h1>{c.title}</h1><span>{c.intro}</span><strong>{refId}</strong></header>
    <div className="student-filter">
      <label>{c.language}<select value={language} onChange={event => setLanguage(event.target.value)}>
        <option value="">{c.allLanguages}</option>
        {SMARTLINGO_LANGUAGE_COMMUNITIES.map(item => <option key={item.code} value={item.code}>{item.nativeName} · {item.nameEn}</option>)}
      </select></label>
      <b>{rows.length} {c.subscriptions}</b>
    </div>
    {message ? <p role="alert">{message}</p> : rows.length ? <div className="student-table" role="table">
      <div role="row" className="student-head"><span>{c.student}</span><span>{c.course}</span><span>{c.languageLevel}</span><span>{c.expires}</span><span>{c.reward}</span></div>
      {rows.map(row => <article role="row" key={row.id}>
        <span><strong>{row.subscriberName}</strong><small>{row.subscriberEmail}</small></span>
        <span><Link href={`/${lang}/classes/${encodeURIComponent(row.classId)}`}>{row.courseName}</Link><small>{row.status}</small></span>
        <span>{row.targetLanguage.toUpperCase()} · {row.packageTier}</span>
        <time>{new Date(Number(row.currentPeriodEndsAt || row.trialEndsAt) * 1000).toLocaleDateString(lang)}</time>
        <span>{Number(row.rewardEvents) > 0 ? c.eligible : "—"}</span>
      </article>)}
    </div> : <div className="student-empty">{c.empty}</div>}
    <style>{`.my-students{width:min(1180px,calc(100% - 34px));margin:auto;padding:80px 0 110px;color:#17342c}.my-students header{max-width:900px}.my-students header>p{color:#087d62;font-size:12px;font-weight:950;letter-spacing:.14em}.my-students h1{margin:10px 0;font:600 clamp(48px,8vw,88px)/.98 "Iowan Old Style","Noto Serif SC",serif}.my-students header>span{display:block;color:#60736b;font-size:17px}.my-students header>strong{display:inline-block;margin-top:16px;padding:9px 13px;border-radius:10px;background:#123f35;color:#fff;letter-spacing:.14em}.student-filter{margin-top:40px;padding:18px;display:flex;justify-content:space-between;align-items:end;gap:18px;border:1px solid #bad1c8;border-radius:18px;background:#fff}.student-filter label{display:grid;gap:7px;font-weight:850}.student-filter select{min-width:min(340px,70vw);min-height:46px;padding:9px;border:1px solid #9fb9b0;border-radius:10px;background:#fff;font-size:16px}.student-table{margin-top:16px;border:1px solid #bad1c8;border-radius:18px;background:#fff;overflow:hidden}.student-head,.student-table article{display:grid;grid-template-columns:1.2fr 1.7fr 1fr 1fr .8fr;gap:12px;padding:15px 18px;align-items:center}.student-head{background:#123f35;color:#fff;font-size:12px;font-weight:900}.student-table article{border-top:1px solid #dce7e2}.student-table article span{min-width:0}.student-table article strong,.student-table article small{display:block}.student-table article small{margin-top:4px;color:#667b72;font-size:11px;overflow-wrap:anywhere}.student-table a{color:#087d62;font-weight:850}.student-empty{margin-top:18px;padding:42px;border:1px dashed #a8beb5;border-radius:18px;text-align:center}@media(max-width:800px){.student-head{display:none}.student-table article{grid-template-columns:1fr 1fr}.student-table article>span:nth-child(2){grid-column:2}.student-filter{align-items:stretch;flex-direction:column}.student-filter select{min-width:0;width:100%}}@media(max-width:520px){.student-table article{grid-template-columns:1fr}.student-table article>span:nth-child(2){grid-column:auto}}`}</style>
  </section>;
}
