"use client";

import { useState } from "react";

type RoleKind = "admin" | "subscriber";

export function AdminMemberRoleEditor({ memberId, initialAdmin, initialSubscriber, lang, adminLocked }: { memberId: string; initialAdmin: boolean; initialSubscriber: boolean; lang: "en" | "zh"; adminLocked: boolean }) {
  const zh = lang === "zh";
  const [roles, setRoles] = useState({ admin: initialAdmin, subscriber: initialSubscriber });
  const [busy, setBusy] = useState<RoleKind | null>(null);
  const [status, setStatus] = useState("");

  async function change(kind: RoleKind) {
    const enabled = roles[kind];
    const name = kind === "admin" ? (zh ? "管理员" : "administrator") : (zh ? "订阅者" : "subscriber");
    if (enabled && !confirm(zh ? `删除${name}角色？会员账户和其他角色会保留。` : `Delete the ${name} role? The member account and other roles will remain.`)) return;
    setBusy(kind);
    setStatus("");
    const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: `${enabled ? "revoke" : "grant"}-${kind}` }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) {
      setRoles((current) => ({ ...current, [kind]: !enabled }));
      setStatus(zh ? `${name}角色已${enabled ? "删除" : "添加"}。` : `${name[0].toUpperCase()}${name.slice(1)} role ${enabled ? "deleted" : "added"}.`);
    } else {
      setStatus(payload.error || (zh ? "角色更新失败。" : "Role update failed."));
    }
    setBusy(null);
  }

  return <div className="admin-role-editor">
    <section><strong>{zh ? "管理员角色" : "Administrator role"}</strong><p>{roles.admin ? (zh ? "已添加" : "Added") : (zh ? "未添加" : "Not added")}</p><button type="button" onClick={() => void change("admin")} disabled={busy !== null || (roles.admin && adminLocked)}>{busy === "admin" ? (zh ? "处理中…" : "Working…") : roles.admin ? (zh ? "删除管理员" : "Delete Administrator") : (zh ? "添加管理员" : "Add Administrator")}</button></section>
    <section><strong>{zh ? "订阅者角色" : "Subscriber role"}</strong><p>{roles.subscriber ? (zh ? "已添加" : "Added") : (zh ? "未添加" : "Not added")}</p><button type="button" onClick={() => void change("subscriber")} disabled={busy !== null}>{busy === "subscriber" ? (zh ? "处理中…" : "Working…") : roles.subscriber ? (zh ? "删除订阅者" : "Delete Subscriber") : (zh ? "添加订阅者" : "Add Subscriber")}</button></section>
    {adminLocked && roles.admin && <p>{zh ? "默认管理员或当前管理员不能删除自己的管理员角色。" : "The bootstrap or current administrator cannot delete their own administrator role."}</p>}
    {status && <p role="status">{status}</p>}
  </div>;
}
