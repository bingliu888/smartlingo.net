"use client";

import Link from "next/link";
import { useState } from "react";
import { interfaceLanguages } from "../lib/interface-locale";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { MaxLiveTutorCall } from "./MaxLiveTutorCall";

export function MaxVoiceTutor({ lang, language, initialMax, trialAvailable }: {
  lang: string; language: string; initialMax: boolean; trialAvailable: boolean;
}) {
  const zh = lang === "zh" || lang === "zh-tw";
  const learningName = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === language)?.nameEn || language;
  const supportLanguageName = interfaceLanguages.find(item => item.code === lang)?.nameEn || "English";
  const supportName = interfaceLanguages.find(item => item.code === lang)?.nativeName || lang;
  const [max, setMax] = useState(initialMax);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [slowSpeed, setSlowSpeed] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [shortAnswer, setShortAnswer] = useState(true);
  const [error, setError] = useState("");

  async function call(action: "start" | "start-trial") {
    const response = await fetch(action === "start" ? "/api/assistant/open-tutor" : "/api/assistant/role-tutor", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "start" ? { action, language, uiLanguage: lang } : { action, uiLanguage: lang }),
    });
    const result = await response.json() as { sessionId?: string; active?: boolean; error?: string };
    if (!response.ok) throw new Error(result.error || (zh ? "实时导师暂时不可用。" : "The live tutor is unavailable."));
    return result;
  }

  async function prepareSession() {
    if (sessionId) return sessionId;
    setBusy(true); setError("");
    try {
      const result = await call("start");
      if (!result.sessionId) throw new Error(zh ? "无法准备导师会话。" : "Could not prepare the tutor session.");
      setSessionId(result.sessionId);
      return result.sessionId;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      return null;
    } finally { setBusy(false); }
  }

  async function startTrial() {
    setBusy(true); setError("");
    try {
      const result = await call("start-trial");
      if (result.active) setMax(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setBusy(false); }
  }

  return <section className="role-tutor-card" aria-label={zh ? "一对一实时 AI 导师" : "One-to-one live AI tutor"}>
    {!max ? <div className="role-tutor-upgrade">
      <p>{trialAvailable ? (zh ? "首次使用可开启一次七天旗舰版试用。" : "Start your one-time seven-day Max trial.")
        : (zh ? "旗舰版已到期。续订后可继续与导师通话。" : "Max has expired. Extend it to keep talking with your tutor.")}</p>
      {trialAvailable ? <button type="button" onClick={startTrial} disabled={busy}>{zh ? "开启七天试用" : "Start seven-day trial"}</button> : null}
      <Link href={`/${lang}/pricing`}>{zh ? "查看旗舰版" : "Explore Max"}</Link>
    </div> : <>
      <MaxLiveTutorCall sessionId={sessionId} prepareSession={prepareSession} language={language} lang={lang}
        learningName={learningName} supportLanguageName={supportLanguageName}
        slowSpeed={slowSpeed} shortAnswer={shortAnswer} showSupport={showSupport} onCallActive={setLiveBusy}/>
      <div className="role-tutor-preferences" aria-label={zh ? "实时导师设置" : "Live tutor settings"}>
        <label><input type="checkbox" checked={slowSpeed} onChange={event => setSlowSpeed(event.target.checked)}/>{zh ? "慢速" : "Slow speed"}</label>
        {language !== lang ? <label><input type="checkbox" checked={showSupport} onChange={event => setShowSupport(event.target.checked)}/>{zh ? `显示 ${supportName}` : `Show ${supportName}`}</label> : null}
        <label><input type="checkbox" checked={shortAnswer} onChange={event => setShortAnswer(event.target.checked)}/>{zh ? "简短回答" : "Short answers"}</label>
      </div>
      {liveBusy ? <p className="max-live-tutor-disclosure" role="status">{zh ? "实时通话中。请自然说话。" : "Live call in progress. Speak naturally."}</p> : null}
    </>}
    {error ? <p className="role-tutor-error" role="alert">{error}</p> : null}
    <Link href={`/${lang}/programs/${language}?path=max`}>{zh ? "← 返回语言主页" : "← Back to language"}</Link>
  </section>;
}
