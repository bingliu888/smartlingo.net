"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
export function CoursePaymentActions({ lang, classId, priceCents, firstMonthFree, trialDays = firstMonthFree ? 30 : 0, departmentId }: { lang: "en" | "zh"; classId: string; priceCents: number; firstMonthFree: boolean; trialDays?: number; departmentId?: string }) {
  const zh = lang === "zh";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credit, setCredit] = useState<{ balancePoints: number; requiredPoints: number; eligibleForFullMonth: boolean } | null>(null);
  useEffect(() => { let active = true;if(priceCents<=0)return()=>{active=false}; void fetch(`/api/billing/credits/redeem?classId=${encodeURIComponent(classId)}`, { cache: "no-store" }).then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) })).then(result => { if (active && result.ok) setCredit(result.data); }).catch(() => undefined); return () => { active = false; }; }, [classId,priceCents]);
  async function startFreeMonth() {
    setBusy(true); setError("");
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/enroll`, { method: "POST",headers:{"content-type":"application/json"},body:JSON.stringify({departmentId}) });
    const data = await response.json().catch(() => ({})) as { enrolled?: boolean; error?: string };
    if (response.ok && data.enrolled) { window.location.assign(`/${lang}/classes/${encodeURIComponent(classId)}`); return; }
    setError(data.error || (zh ? "暂时无法开始免费首月，请稍后重试。" : "Unable to start the free first month. Please try again."));
    setBusy(false);
  }
  async function payCard() {
    setBusy(true); setError("");
    const response = await fetch("/api/billing/card/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, lang, departmentId }) });
    const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && data.url) { window.location.assign(data.url); return; }
    setError(data.error || (zh ? "暂时无法开始信用卡付款。" : "Unable to start card checkout."));
    setBusy(false);
  }
  async function redeemMonth() {
    setBusy(true); setError("");
    const response = await fetch("/api/billing/credits/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId }) });
    const data = await response.json().catch(() => ({})) as { redeemed?: boolean; error?: string };
    if (response.ok && data.redeemed) { window.location.assign(`/${lang}/classes/${encodeURIComponent(classId)}/learn`); return; }
    setError(data.error || (zh ? "暂时无法使用课程积分。" : "Unable to use course points.")); setBusy(false);
  }
  return <div className="course-payment-actions">
    {credit ? <section className="course-credit-option"><div><strong>{credit.balancePoints} / {credit.requiredPoints}</strong><span>{zh ? "课程积分" : "course points"}</span></div>{credit.eligibleForFullMonth ? <button type="button" disabled={busy} onClick={() => void redeemMonth()}>{zh ? `使用 ${credit.requiredPoints} 点兑换一个月` : `Use ${credit.requiredPoints} points for one month`}</button> : <Link href={`/${lang}/smartcards`}>{zh ? `还需 ${credit.requiredPoints - credit.balancePoints} 点 · 去挑战` : `${credit.requiredPoints - credit.balancePoints} more · Earn with SmartCards`} →</Link>}<small>{zh ? "积分兑换只开放本课程 30 天，不会自动续订，也不会启动信用卡免费月。" : "Credit opens this course for 30 days only. It does not auto-renew or start the card free month."}</small></section> : null}
    {priceCents===0||firstMonthFree||trialDays>0 ? <button className="free-month-button" type="button" onClick={() => void startFreeMonth()} disabled={busy}>{busy ? (zh ? "正在开通…" : "Starting…") : priceCents===0?(zh?"加入公开课程":"Join Open course"):firstMonthFree?(zh?"开始免费首月":"Start free first month"):(zh?`开始 ${trialDays} 天推荐体验`:`Start ${trialDays}-day referred access`)}</button> : null}
    {priceCents>0 ? <><button className="primary-button" type="button" onClick={() => void payCard()} disabled={busy}>{busy ? (zh ? "正在连接…" : "Connecting…") : (zh ? "使用信用卡付款" : "Pay by credit card")}</button>
    {!departmentId?<Link className="crypto-payment-button" href={`/${lang}/classes/${encodeURIComponent(classId)}/pay/crypto`}>{zh ? "连接钱包支付加密货币" : "Connect wallet to pay crypto"}</Link>:null}
    <small>{firstMonthFree ? (zh ? "首次信用卡订阅首月免费；之后按固定月费续订。加密货币付款立即购买一个月。" : "The first card subscription includes a free first month, then renews monthly. Crypto pays for one month immediately.") : (zh ? `固定月费 $${priceCents / 100}。` : `Fixed monthly price: $${priceCents / 100}.`)}</small></> : null}
    {error && <p role="alert">{error}</p>}
    <style>{`.course-payment-actions{display:grid;gap:10px;margin-top:18px}.course-payment-actions>a,.course-payment-actions>button{width:100%;text-align:center}.course-payment-actions .free-month-button{min-height:54px;padding:0 20px;border:2px solid #73e6c4;border-radius:8px;background:#73e6c4;color:#082f27;font-weight:950;box-shadow:0 10px 26px rgba(5,34,28,.24)}.course-payment-actions .free-month-button:hover,.course-payment-actions .free-month-button:focus-visible{border-color:#fff;background:#a0f3da;outline:3px solid rgba(115,230,196,.35);outline-offset:2px}.course-payment-actions .crypto-payment-button{display:flex;min-height:52px;align-items:center;justify-content:center;padding:0 20px;border:2px solid #73e6c4;border-radius:8px;background:#f7fffc;color:#0a4639;font-weight:850;box-shadow:0 8px 22px rgba(5,34,28,.22);text-decoration:none}.course-payment-actions .crypto-payment-button:hover,.course-payment-actions .crypto-payment-button:focus-visible{border-color:#ffffff;background:#73e6c4;color:#082f27;outline:3px solid rgba(115,230,196,.35);outline-offset:2px}.course-payment-actions small{color:inherit;opacity:.8;line-height:1.5}.course-payment-actions p{margin:0;padding:10px;border-radius:8px;background:#fff1ee;color:#8a2f22}.course-credit-option{padding:15px;display:grid;gap:9px;border:1px solid #73e6c4;border-radius:13px;background:#e8fff7;color:#0a4639}.course-credit-option>div{display:flex;align-items:baseline;gap:8px}.course-credit-option strong{font-size:24px}.course-credit-option button,.course-credit-option a{min-height:46px;padding:10px;display:flex;align-items:center;justify-content:center;border:0;border-radius:9px;background:#087d62;color:#fff;font-weight:850;text-decoration:none}.course-credit-option small{color:#365f54}`}</style>
  </div>;
}
