"use client";

import Link from "next/link";
import { useState } from "react";
export function CoursePaymentActions({ lang, classId, priceCents, firstMonthFree }: { lang: "en" | "zh"; classId: string; priceCents: number; firstMonthFree: boolean }) {
  const zh = lang === "zh";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function payCard() {
    setBusy(true); setError("");
    const response = await fetch("/api/billing/card/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, lang }) });
    const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && data.url) { window.location.assign(data.url); return; }
    setError(data.error || (zh ? "暂时无法开始信用卡付款。" : "Unable to start card checkout."));
    setBusy(false);
  }
  return <div className="course-payment-actions">
    <button className="primary-button" type="button" onClick={() => void payCard()} disabled={busy}>{busy ? (zh ? "正在连接…" : "Connecting…") : (zh ? "使用信用卡付款" : "Pay by credit card")}</button>
    <Link className="crypto-payment-button" href={`/${lang}/classes/${encodeURIComponent(classId)}/pay/crypto`}>{zh ? "连接钱包支付加密货币" : "Connect wallet to pay crypto"}</Link>
    <small>{firstMonthFree ? (zh ? "首次信用卡订阅首月免费；之后按固定月费续订。加密货币付款立即购买一个月。" : "The first card subscription includes a free first month, then renews monthly. Crypto pays for one month immediately.") : (zh ? `固定月费 $${priceCents / 100}。` : `Fixed monthly price: $${priceCents / 100}.`)}</small>
    {error && <p role="alert">{error}</p>}
    <style>{`.course-payment-actions{display:grid;gap:10px;margin-top:18px}.course-payment-actions>a,.course-payment-actions>button{width:100%;text-align:center}.course-payment-actions .crypto-payment-button{display:flex;min-height:52px;align-items:center;justify-content:center;padding:0 20px;border:2px solid #73e6c4;border-radius:8px;background:#f7fffc;color:#0a4639;font-weight:850;box-shadow:0 8px 22px rgba(5,34,28,.22);text-decoration:none}.course-payment-actions .crypto-payment-button:hover,.course-payment-actions .crypto-payment-button:focus-visible{border-color:#ffffff;background:#73e6c4;color:#082f27;outline:3px solid rgba(115,230,196,.35);outline-offset:2px}.course-payment-actions small{color:inherit;opacity:.8;line-height:1.5}.course-payment-actions p{margin:0;padding:10px;border-radius:8px;background:#fff1ee;color:#8a2f22}`}</style>
  </div>;
}
