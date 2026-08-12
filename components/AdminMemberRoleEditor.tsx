"use client";

import { useState } from "react";

export function AdminMemberRoleEditor({ memberId, initialRole, lang, locked }: { memberId: string; initialRole: "member" | "admin"; lang: "en" | "zh"; locked: boolean }) {
  const [role, setRole] = useState(initialRole);
  const [savedRole, setSavedRole] = useState(initialRole);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const zh = lang === "zh";
  async function save() {
    setBusy(true); setStatus("");
    const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) setSavedRole(role);
    setStatus(response.ok ? (zh ? "角色已更新" : "Role updated") : (payload.error || (zh ? "更新失败" : "Update failed")));
    setBusy(false);
  }
  return <div className="admin-role-editor"><label htmlFor="member-role">{zh ? "平台角色" : "Platform role"}</label><select id="member-role" value={role} disabled={locked || busy} onChange={(event) => setRole(event.target.value as "member" | "admin")}><option value="member">{zh ? "会员" : "Member"}</option><option value="admin">{zh ? "主持人" : "Host"}</option></select><button type="button" onClick={save} disabled={locked || busy || role === savedRole}>{busy ? (zh ? "保存中…" : "Saving…") : (zh ? "保存角色" : "Save role")}</button>{locked && <p>{zh ? "默认主持人角色受保护，不能降级。" : "The bootstrap host role is protected."}</p>}{status && <p role="status">{status}</p>}</div>;
}
