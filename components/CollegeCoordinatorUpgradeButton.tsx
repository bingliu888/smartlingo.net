"use client";

import { useState } from "react";
import type { InterfaceLanguage } from "../lib/interface-locale";

export function CollegeCoordinatorUpgradeButton({ lang }: { lang: InterfaceLanguage }) {
  const zh = lang === "zh";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function checkout() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/billing/platform/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang }) });
    const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && data.url) { window.location.assign(data.url); return; }
    setMessage(data.error || (zh ? "暂时无法开始结账。" : "Checkout is temporarily unavailable.")); setBusy(false);
  }
  return <div className="college-coordinator-upgrade"><button className="primary-button" type="button" disabled={busy} onClick={checkout}>{busy ? "…" : zh ? "订阅学院协调员方案" : "Subscribe as College Coordinator"}</button>{message ? <p role="alert">{message}</p> : null}</div>;
}
