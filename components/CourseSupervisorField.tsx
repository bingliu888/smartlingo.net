"use client";

import { useState } from "react";
import type { InterfaceLanguage } from "../lib/interface-locale";
import { courseSupervisorCopy } from "../lib/course-supervisor-locale";

export function CourseSupervisorField({ lang, subscriptionId, initialRefId }: { lang: InterfaceLanguage; subscriptionId: string; initialRefId?: string | null }) {
  const c=courseSupervisorCopy(lang);
  const [refId,setRefId]=useState(initialRefId||"");
  const [saved,setSaved]=useState(Boolean(initialRefId));
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function save(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage("");const response=await fetch(`/api/course-subscriptions/${encodeURIComponent(subscriptionId)}/supervisor`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({supervisorRefId:refId})});const data=await response.json().catch(()=>({})) as {supervisorRefId?:string;error?:string};if(response.ok&&data.supervisorRefId){setRefId(data.supervisorRefId);setSaved(true);setMessage(c.saved);}else setMessage(c.invalid);setBusy(false);}
  return <div className="course-supervisor-field"><span>{c.supervisor}</span>{saved?<strong>{refId}</strong>:<form onSubmit={save}><label><span className="sr-only">{c.supervisor} RefID</span><input value={refId} onChange={event=>setRefId(event.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" placeholder={c.enter} required pattern="[A-HJ-NP-Z2-9]{6}"/></label><button disabled={busy}>{busy?c.checking:c.save}</button></form>}<small>{saved?c.fixed:c.optional}</small>{message&&<p role="status">{message}</p>}<style>{`.course-supervisor-field{margin-top:15px;padding:13px;border:1px solid #b8d3c9;border-radius:12px;background:#fff}.course-supervisor-field>span{display:block;color:#667a72;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.course-supervisor-field>strong{display:block;margin:5px 0;font-size:20px;letter-spacing:.12em}.course-supervisor-field form{display:grid;grid-template-columns:1fr auto;gap:8px;margin:8px 0}.course-supervisor-field input{width:100%;min-height:44px;padding:9px 11px;border:1px solid #8faea3;border-radius:9px;font:800 16px/1 monospace;letter-spacing:.12em}.course-supervisor-field button{padding:0 15px;border:0;border-radius:9px;background:#0b7058;color:#fff;font-weight:850}.course-supervisor-field small{color:#65776f;line-height:1.45}.course-supervisor-field p{margin:8px 0 0;color:#8a2f22;font-size:13px}@media(max-width:460px){.course-supervisor-field form{grid-template-columns:1fr}}`}</style></div>;
}
