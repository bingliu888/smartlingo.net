"use client";

import { useState } from "react";

type RoleTab = "members" | "admins" | "subscribers";
type RoleKind = "admin" | "subscriber";

const roleName = (kind: RoleKind, zh: boolean) => kind === "admin"
  ? (zh ? "管理员" : "Administrator")
  : (zh ? "订阅者" : "Subscriber");

export function AdminMemberActions({ lang, tab }: { lang: "en" | "zh"; tab: RoleTab }) {
  const zh = lang === "zh";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const kind = tab === "admins" ? "admin" : tab === "subscribers" ? "subscriber" : null;
  if (!kind) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: `grant-${kind}`, email: String(form.get("email") ?? "") }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || (zh ? "操作失败。" : "Action failed."));
      setBusy(false);
      return;
    }
    window.location.reload();
  }
  const name = roleName(kind, zh);
  return <section className="admin-add-card">
    <h2>{zh ? `添加${name}` : `Add ${name}`}</h2>
    <p>{zh ? `输入现有会员邮箱，只添加${name}角色；会员账户不会被替换。` : `Enter an existing member email. Only the ${name.toLowerCase()} role is added; the member account is unchanged.`}</p>
    <form onSubmit={submit}>
      <label>{zh ? "会员邮箱" : "Member email"}<input name="email" type="email" required autoComplete="off"/></label>
      <button type="submit" disabled={busy}>{busy ? (zh ? "处理中…" : "Working…") : (zh ? `添加${name}` : `Add ${name}`)}</button>
      {message && <p className="admin-form-message" role="alert">{message}</p>}
    </form>
  </section>;
}

export function AdminRoleRemoveButton({ memberId, lang, kind, locked = false }: { memberId: string; lang: "en" | "zh"; kind: RoleKind; locked?: boolean }) {
  const zh = lang === "zh";
  const [busy, setBusy] = useState(false);
  const name = roleName(kind, zh);
  async function remove() {
    if (locked || !confirm(zh ? `删除此会员的${name}角色？会员账户和其他角色会保留。` : `Remove this member's ${name.toLowerCase()} role? Their member account and other roles will remain.`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: `revoke-${kind}` }),
    });
    if (response.ok) {
      window.location.reload();
      return;
    }
    const data = await response.json().catch(() => ({})) as { error?: string };
    alert(data.error || (zh ? "角色删除失败。" : "Could not remove role."));
    setBusy(false);
  }
  return <button type="button" className="admin-delete" onClick={remove} disabled={locked || busy}>
    {busy ? (zh ? "处理中…" : "Working…") : (zh ? `删除${name}` : `Delete ${name}`)}
  </button>;
}
