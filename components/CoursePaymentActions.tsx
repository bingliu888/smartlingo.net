"use client";

import Link from "next/link";
import { useState } from "react";
import { interfaceText } from "../lib/interface-locale";
import { SMARTLINGO_COURSE_DURATIONS, courseSubscriptionPackage, type SmartLingoCourseDurationMonths, type SmartLingoPackageTier } from "../lib/smartlingo-course-packages";
import type { SiteLanguage } from "../lib/site-locale";

export function CoursePaymentActions({ lang, classId, targetLanguage, packageTier, initialMonths, supervisorRefId }: {
  lang: SiteLanguage; classId: string; targetLanguage: string; packageTier: SmartLingoPackageTier;
  initialMonths: SmartLingoCourseDurationMonths; supervisorRefId?: string;
}) {
  const t=(english:string,chinese:string)=>interfaceText(lang,english,chinese);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [months,setMonths]=useState<SmartLingoCourseDurationMonths>(initialMonths);
  const selectedPackage=courseSubscriptionPackage(packageTier,months)!;
  async function payCard() {
    setBusy(true); setError("");
    const response = await fetch("/api/billing/card/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, targetLanguage, months, lang, supervisorRefId }) });
    const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && data.url) { window.location.assign(data.url); return; }
    setError(data.error || t("Unable to start card checkout.","暂时无法开始信用卡付款。"));
    setBusy(false);
  }
  return <div className="course-payment-actions">
    <fieldset><legend>{t("Choose access period","选择学习期限")}</legend><div>{SMARTLINGO_COURSE_DURATIONS.map(value=>{
      const item=courseSubscriptionPackage(packageTier,value)!;
      return <button type="button" key={value} className={months===value?"selected":""} aria-pressed={months===value} onClick={()=>setMonths(value)}>
        <span>{value} {t("months","个月")}</span><strong>${item.priceCents/100}</strong>
      </button>;
    })}</div></fieldset>
    <div className="selected-package"><span>{t("Selected package","已选套餐")}</span><strong>${selectedPackage.priceCents/100} · {months} {t("months","个月")}</strong></div>
    <button className="primary-button" type="button" onClick={() => void payCard()} disabled={busy}>{busy ? t("Connecting…","正在连接…") : t("Pay once by card","使用信用卡一次支付")}</button>
    {months===3?<Link className="crypto-payment-button" href={`/${lang}/classes/${encodeURIComponent(classId)}/pay/crypto?language=${encodeURIComponent(targetLanguage)}&months=3${supervisorRefId?`&supervisor=${encodeURIComponent(supervisorRefId)}`:""}`}>{t("Pay 3 months with Polygon USDT or GLC","使用 Polygon USDT 或 GLC 支付三个月")}</Link>:null}
    <small>{t("This is fixed-term access with no automatic renewal. Crypto is available only for three-month packages.","这是固定期限学习权利，不会自动续费。加密货币仅用于三个月套餐。")}</small>
    {error && <p role="alert">{error}</p>}
    <style>{`.course-payment-actions{display:grid;gap:12px;margin-top:18px}.course-payment-actions>a,.course-payment-actions>button{width:100%;text-align:center}.course-payment-actions fieldset{margin:0;padding:0;border:0}.course-payment-actions legend{margin-bottom:9px;font-size:13px;font-weight:850}.course-payment-actions fieldset>div{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.course-payment-actions fieldset button{min-height:64px;padding:9px;display:grid;gap:2px;border:1px solid #8cb8a8;border-radius:10px;background:#fff;color:#123f35}.course-payment-actions fieldset button.selected{border:2px solid #73e6c4;background:#e6fff6;box-shadow:0 7px 18px rgba(5,34,28,.18)}.course-payment-actions fieldset button strong{font-size:20px}.selected-package{padding:12px 14px;display:flex;justify-content:space-between;gap:12px;border-radius:10px;background:#e7f5ef;color:#0a4639}.course-payment-actions .crypto-payment-button{display:flex;min-height:52px;align-items:center;justify-content:center;padding:0 20px;border:2px solid #73e6c4;border-radius:8px;background:#f7fffc;color:#0a4639;font-weight:850;box-shadow:0 8px 22px rgba(5,34,28,.22);text-decoration:none}.course-payment-actions .crypto-payment-button:hover,.course-payment-actions .crypto-payment-button:focus-visible{border-color:#ffffff;background:#73e6c4;color:#082f27;outline:3px solid rgba(115,230,196,.35);outline-offset:2px}.course-payment-actions small{color:inherit;opacity:.8;line-height:1.5}.course-payment-actions p{margin:0;padding:10px;border-radius:8px;background:#fff1ee;color:#8a2f22}@media(max-width:460px){.course-payment-actions fieldset>div{grid-template-columns:1fr}.selected-package{display:grid}}`}</style>
  </div>;
}
