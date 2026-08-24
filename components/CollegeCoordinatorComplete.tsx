"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InterfaceLanguage } from "../lib/interface-locale";

export function CollegeCoordinatorComplete({ lang, sessionId }: { lang: InterfaceLanguage; sessionId: string }) {
  const zh = lang === "zh";
  const [state, setState] = useState<"loading"|"done"|"error">("loading");
  useEffect(() => { fetch("/api/billing/platform/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) }).then(response => response.ok ? setState("done") : setState("error")).catch(() => setState("error")); }, [sessionId]);
  return <section className="college-complete"><p>COLLEGE COORDINATOR</p><h1>{state === "loading" ? (zh ? "正在确认订阅…" : "Confirming subscription…") : state === "done" ? (zh ? "学院协调员资格已启用" : "College Coordinator is active") : (zh ? "暂时无法确认订阅" : "Subscription could not be confirmed")}</h1><p>{state === "done" ? (zh ? "现在可以创建并管理自己的学院。" : "You can now create and manage your own college.") : state === "error" ? (zh ? "请返回“我的学院”重试；不会重复收费。" : "Return to My colleges and retry. You will not be charged twice.") : (zh ? "请不要关闭页面。" : "Please keep this page open.")}</p><Link className="primary-button" href={`/${lang}/colleges/mine`}>{zh ? "返回我的学院" : "Back to My colleges"} →</Link></section>;
}
