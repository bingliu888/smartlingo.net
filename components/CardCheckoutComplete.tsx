"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { interfaceText } from "../lib/interface-locale";
import type { SiteLanguage } from "../lib/site-locale";

export function CardCheckoutComplete({ lang, classId, sessionId }: { lang: SiteLanguage; classId: string; sessionId: string }) {
  const t=useCallback((english:string,chinese:string)=>interfaceText(lang,english,chinese),[lang]);
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState(t("Confirming your course package…","正在确认课程套餐…"));
  useEffect(() => {
    let active = true;
    fetch("/api/billing/card/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, sessionId }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) as { error?: string } }))
      .then(({ ok, data }) => { if (!active) return; setState(ok ? "done" : "error"); setMessage(ok ? t("Package confirmed. Five-skill learning and the course room are ready.","套餐已确认，课程五项技能和教室已开放。") : (data.error || t("Unable to confirm payment.","无法确认付款。"))); })
      .catch(() => { if (active) { setState("error"); setMessage(t("Unable to confirm payment.","无法确认付款。")); } });
    return () => { active = false; };
  }, [classId, sessionId, t]);
  return <section className="card-checkout-complete"><p className="section-kicker">{t("CARD PACKAGE PAYMENT","信用卡套餐付款")}</p><h1>{state === "done" ? t("Course ready","课程已开放") : state === "error" ? t("Confirmation needed","需要重新确认") : t("Completing checkout","正在完成付款")}</h1><p role="status">{message}</p><div>{state === "done" && <Link className="primary-button" href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>{t("Start five-skill learning","开始五项技能学习")} →</Link>}<Link className="secondary-button" href={`/${lang}/classes/${encodeURIComponent(classId)}`}>{t("Back to course","返回课程详情")}</Link></div><style>{`.card-checkout-complete{width:min(760px,calc(100% - 32px));min-height:62vh;margin:auto;padding:100px 0;display:flex;flex-direction:column;justify-content:center}.card-checkout-complete h1{font-size:clamp(42px,6vw,72px)}.card-checkout-complete>p{font-size:18px;color:var(--muted)}.card-checkout-complete>div{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}`}</style></section>;
}
