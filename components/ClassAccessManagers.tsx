"use client";

import { useCallback, useEffect, useState } from "react";

type Member = { id: string; email: string; displayName: string };

export function ClassAccessManagers({ code, showSubscribers = false, zh = false }: { code: string; showSubscribers?: boolean; zh?: boolean }) {
  const [panel, setPanel] = useState<"cohosts" | "subscribers" | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async (kind: "cohosts" | "subscribers") => {
    const response = await fetch(`/api/classrooms/${code}/${kind}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { members?: Member[]; error?: string };
    if (response.ok) setMembers(data.members || []); else setMessage(data.error || "Unable to load members");
  }, [code]);
  useEffect(() => {
    if (!panel) return;
    const timer = window.setTimeout(() => void load(panel), 0);
    return () => window.clearTimeout(timer);
  }, [load, panel]);
  async function add() {
    if (!panel) return;
    setMessage("");
    const response = await fetch(`/api/classrooms/${code}/${panel}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) { setEmail(""); await load(panel); } else setMessage(data.error || "Unable to add member");
  }
  async function remove(id: string) {
    if (!panel || !window.confirm(zh ? "确认删除该成员？" : "Remove this member?")) return;
    if ((await fetch(`/api/classrooms/${code}/${panel}?userId=${encodeURIComponent(id)}`, { method: "DELETE" })).ok) await load(panel);
  }
  return <>
    <button onClick={() => setPanel("cohosts")}>{zh ? "协办主持／演讲嘉宾" : "Co-hosts / speakers"}</button>
    {showSubscribers && <button onClick={() => setPanel("subscribers")}>{zh ? "订阅成员" : "Subscribers"}</button>}
    {panel && <div className="class-manager-overlay" onClick={() => setPanel(null)}><section className="class-manager-dialog" onClick={event => event.stopPropagation()}>
      <header><div><small>{panel === "cohosts" ? (zh ? "课程管理" : "COURSE MANAGEMENT") : (zh ? "订阅访问" : "SUBSCRIPTION ACCESS")}</small><h2>{panel === "cohosts" ? (zh ? "协办主持／演讲嘉宾" : "Co-hosts / speakers") : (zh ? "订阅成员" : "Subscribers")}</h2></div><button aria-label="Close" onClick={() => setPanel(null)}>×</button></header>
      <p>{panel === "cohosts" ? (zh ? "协办主持可作为演讲嘉宾，并可编辑课程及管理课程内容。" : "Co-hosts can present as speakers, edit the course, and manage course room content.") : (zh ? "拥有有效固定期限课程学习权利的学员可以进入课程教室。" : "Learners with active fixed-term course access can enter the course room.")}</p>
      <div className="class-manager-add"><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={zh ? "会员邮箱" : "Member email"}/><button onClick={() => void add()}>{zh ? "添加" : "Add"}</button></div>
      {message && <p role="alert">{message}</p>}
      <div className="class-manager-list">{members.map(member => <article key={member.id}><div><strong>{member.displayName || member.email}</strong><small>{member.email}</small></div><button onClick={() => void remove(member.id)} aria-label={zh ? `删除 ${member.displayName || member.email}` : `Remove ${member.displayName || member.email}`}>×</button></article>)}{!members.length && <p>{zh ? "尚未添加成员。" : "No members added yet."}</p>}</div>
    </section></div>}
  </>;
}
