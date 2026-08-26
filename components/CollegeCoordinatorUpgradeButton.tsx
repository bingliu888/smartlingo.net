"use client";

import { useState } from "react";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { COLLEGE_SUPERVISOR_PLANS, type CollegeSupervisorTier } from "../lib/college-supervisor-plans";

export function CollegeCoordinatorUpgradeButton({ lang, currentTier }: { lang: InterfaceLanguage; currentTier?: CollegeSupervisorTier }) {
  const t = (english:string,chinese:string)=>interfaceText(lang,english,chinese);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function checkout(tier:CollegeSupervisorTier) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/billing/platform/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang,tier }) });
    const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && data.url) { window.location.assign(data.url); return; }
    setMessage(data.error || t("Checkout is temporarily unavailable.","暂时无法开始结账。")); setBusy(false);
  }
  const ranks={basic:0,premium:1,supreme:2};
  return <div className="college-supervisor-plans">{Object.values(COLLEGE_SUPERVISOR_PLANS).map(plan=>{const disabled=busy||Boolean(currentTier&&ranks[plan.tier]<=ranks[currentTier]);return <article key={plan.tier}><small>{plan.tier.toUpperCase()}</small><h3>{lang==="zh"?plan.nameZh:plan.nameEn}</h3><strong>${(plan.priceCents/100).toLocaleString()}</strong><span>{t("one-time","一次性")}</span><p>{t("Up to {count} departments","最多 {count} 个部门").replace("{count}",String(plan.maxDepartments))}</p><button type="button" disabled={disabled} onClick={()=>void checkout(plan.tier)}>{busy?"…":disabled?t("Current or higher plan","当前或更高方案"):currentTier?t("Upgrade for the difference","支付差价升级"):t("Buy package","购买方案")}</button></article>})}{message ? <p role="alert">{message}</p> : null}<style>{`.college-supervisor-plans{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.college-supervisor-plans article{padding:22px;border:1px solid #aed0c4;border-radius:16px;background:#fff;color:#123f35}.college-supervisor-plans article small{color:#087d62;font-weight:950}.college-supervisor-plans h3{font-size:24px}.college-supervisor-plans strong{display:block;font-size:34px}.college-supervisor-plans span{color:#65766f}.college-supervisor-plans button{width:100%;min-height:48px;border:0;border-radius:10px;background:#087d62;color:#fff;font-weight:900}.college-supervisor-plans button:disabled{opacity:.45}.college-supervisor-plans>p{grid-column:1/-1}@media(max-width:760px){.college-supervisor-plans{grid-template-columns:1fr}}`}</style></div>;
}
