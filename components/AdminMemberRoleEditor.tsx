"use client";

import { useState } from "react";

export function AdminMemberRoleEditor({ memberId, initialAdmin, initialSubscriber, initialExpiresAt, canRevokeSubscriber, hasPaidPayments, lang, adminLocked }: {
  memberId: string;
  initialAdmin: boolean;
  initialSubscriber: boolean;
  initialExpiresAt: number | null;
  canRevokeSubscriber: boolean;
  hasPaidPayments: boolean;
  lang: "en" | "zh";
  adminLocked: boolean;
}) {
  const zh = lang === "zh";
  const [admin, setAdmin] = useState(initialAdmin);
  const [subscriber, setSubscriber] = useState(initialSubscriber);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [revokeAllowed, setRevokeAllowed] = useState(canRevokeSubscriber);
  const [months, setMonths] = useState<6 | 12>(6);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function change(action: "grant-admin" | "revoke-admin" | "grant-subscriber" | "revoke-subscriber") {
    if (action.startsWith("revoke") && !confirm(zh
      ? (action === "revoke-admin" ? "删除管理员角色？会员账户会保留。" : "取消管理员赠送的 Max？会员账户会保留。")
      : (action === "revoke-admin" ? "Remove the administrator role? The member account remains." : "Revoke admin-granted Max? The member account remains."))) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(action.endsWith("subscriber") ? { requestId: crypto.randomUUID(), months } : {}) }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; expiresAt?: number | null };
      if (!response.ok) {
        setStatus(payload.error || (zh ? "更新失败。" : "Update failed."));
      } else if (action.endsWith("admin")) {
        setAdmin(action === "grant-admin");
        setStatus(zh ? "管理员角色已更新。" : "Administrator role updated.");
      } else {
        setSubscriber(action === "grant-subscriber");
        setExpiresAt(payload.expiresAt ?? null);
        setRevokeAllowed(action === "grant-subscriber" && !hasPaidPayments);
        setStatus(zh ? "Max 订阅已更新。" : "Max subscription updated.");
      }
    } finally {
      setBusy(false);
    }
  }

  const expiryLabel = expiresAt && subscriber
    ? (zh ? `有效期至 ${new Date(expiresAt * 1000).toLocaleDateString("zh-CN", { timeZone: "UTC" })}`
      : `Active through ${new Date(expiresAt * 1000).toLocaleDateString("en-US", { timeZone: "UTC" })}`)
    : (zh ? "当前没有有效 Max 订阅" : "No active Max subscription");
  return <div className="admin-role-editor">
    <section><strong>{zh ? "管理员角色" : "Administrator role"}</strong><p>{admin ? (zh ? "已添加" : "Added") : (zh ? "未添加" : "Not added")}</p><button type="button" onClick={() => void change(admin ? "revoke-admin" : "grant-admin")} disabled={busy || (admin && adminLocked)}>{busy ? (zh ? "处理中…" : "Working…") : admin ? (zh ? "删除管理员" : "Remove administrator") : (zh ? "添加管理员" : "Add administrator")}</button></section>
    <section><strong>{zh ? "Max 订阅" : "Max subscription"}</strong><p>{expiryLabel}</p><label htmlFor="admin-max-months">{zh ? "赠送或延长期限" : "Grant or extend duration"}</label><select id="admin-max-months" value={months} onChange={event => setMonths(Number(event.target.value) as 6 | 12)}><option value={6}>{zh ? "6 个月" : "6 months"}</option><option value={12}>{zh ? "12 个月" : "12 months"}</option></select><button type="button" onClick={() => void change("grant-subscriber")} disabled={busy}>{busy ? (zh ? "处理中…" : "Working…") : subscriber ? (zh ? "延长 Max" : "Extend Max") : (zh ? "赠送 Max" : "Grant Max")}</button>{subscriber && revokeAllowed && <button type="button" onClick={() => void change("revoke-subscriber")} disabled={busy}>{zh ? "取消管理员赠送" : "Revoke admin grant"}</button>}</section>
    {adminLocked && admin && <p>{zh ? "默认管理员或当前管理员不能删除自己的管理员角色。" : "The bootstrap or current administrator cannot remove their own administrator role."}</p>}
    {status && <p role="status">{status}</p>}
  </div>;
}
