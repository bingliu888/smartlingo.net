"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function CardCheckoutComplete({ lang, classId, sessionId }: { lang: "en" | "zh"; classId: string; sessionId: string }) {
  const zh = lang === "zh";
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState(zh ? "正在确认信用卡订阅…" : "Confirming your card subscription…");
  useEffect(() => {
    let active = true;
    fetch("/api/billing/card/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, sessionId }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) as { error?: string } }))
      .then(({ ok, data }) => { if (!active) return; setState(ok ? "done" : "error"); setMessage(ok ? (zh ? "订阅已确认，课程五项技能和教室已开放。" : "Subscription confirmed. Five-skill learning and the classroom are ready.") : (data.error || (zh ? "无法确认付款。" : "Unable to confirm payment."))); })
      .catch(() => { if (active) { setState("error"); setMessage(zh ? "无法确认付款。" : "Unable to confirm payment."); } });
    return () => { active = false; };
  }, [classId, sessionId, zh]);
  return <section className="card-checkout-complete"><p className="section-kicker">{zh ? "信用卡订阅" : "CARD SUBSCRIPTION"}</p><h1>{state === "done" ? (zh ? "课程已开放" : "Course ready") : state === "error" ? (zh ? "需要重新确认" : "Confirmation needed") : (zh ? "正在完成付款" : "Completing checkout")}</h1><p role="status">{message}</p><div>{state === "done" && <Link className="primary-button" href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>{zh ? "开始五项技能学习" : "Start five-skill learning"} →</Link>}<Link className="secondary-button" href={`/${lang}/classes/${encodeURIComponent(classId)}`}>{zh ? "返回课程详情" : "Back to course"}</Link></div><style>{`.card-checkout-complete{width:min(760px,calc(100% - 32px));min-height:62vh;margin:auto;padding:100px 0;display:flex;flex-direction:column;justify-content:center}.card-checkout-complete h1{font-size:clamp(42px,6vw,72px)}.card-checkout-complete>p{font-size:18px;color:var(--muted)}.card-checkout-complete>div{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}`}</style></section>;
}
