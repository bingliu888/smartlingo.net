"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { speakLearningText, SMARTLINGO_NORMAL_SPEECH_RATE, SMARTLINGO_SLOW_SPEECH_RATE } from "../lib/smartlingo-speech";
import type { OpenTutorProfile } from "../lib/smartlingo-open-tutor";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { interfaceLanguages } from "../lib/interface-locale";
import { translateTutorLines } from "../lib/smartlingo-tutor-translation-client";
import { MaxLiveTutorCall } from "./MaxLiveTutorCall";

type Line = { by: "learner" | "tutor"; text: string; supportText?: string };
type SavedTutorPlan = { targetLanguage: string; useCase: string; dailyMinutes: number; selfReportedLevel: string };

export function RoleTutor({ lang, language, scene, level, role, sceneVisual, speechLocale, initialMax, trialAvailable, mode = "scene" }: {
  lang: string; language: string; scene?: string;
  level?: "beginner" | "intermediate" | "advanced"; role: string; sceneVisual?: string; speechLocale: string;
  initialMax: boolean; trialAvailable: boolean; mode?: "scene" | "open";
}) {
  const zh = lang === "zh" || lang === "zh-tw";
  const supportName = interfaceLanguages.find(item => item.code === lang)?.nativeName || lang;
  const learningName = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === language)?.nameEn || language;
  const supportLanguageName = interfaceLanguages.find(item => item.code === lang)?.nameEn || "English";
  const [max, setMax] = useState(initialMax);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [turns, setTurns] = useState(0);
  const [maxTurns, setMaxTurns] = useState(12);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [dailyLimitSeconds, setDailyLimitSeconds] = useState<number | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [profile, setProfile] = useState<OpenTutorProfile | null>(null);
  const [planLevel, setPlanLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [planMinutes, setPlanMinutes] = useState(10);
  const [planUseCase, setPlanUseCase] = useState("daily_life");
  const [planSaved, setPlanSaved] = useState(false);
  const savedPlanRef = useRef<SavedTutorPlan | null>(null);
  const planEditedRef = useRef(false);
  const [message, setMessage] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [slowSpeed, setSlowSpeed] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [shortAnswer, setShortAnswer] = useState(true);
  const translationAttemptedRef = useRef<Set<number>>(new Set());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const speechCleanupRef = useRef<() => void>(() => undefined);

  useEffect(() => () => {
    speechCleanupRef.current();
    if (recordTimerRef.current) window.clearTimeout(recordTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, expiresAt * 1_000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (!showSupport || !sessionId || language === lang) return;
    const batch = lines.map((line, index) => ({ line, index }))
      .filter(({ line, index }) => !line.supportText && line.text && !translationAttemptedRef.current.has(index))
      .slice(0, 8);
    if (!batch.length) return;
    batch.forEach(({ index }) => translationAttemptedRef.current.add(index));
    void translateTutorLines(batch.map(({ line }) => line.text.slice(0, 600)), language, lang)
      .then(translations => setLines(current => current.map((line, index) => {
        const position = batch.findIndex(item => item.index === index && item.line.text === line.text);
        return position < 0 ? line : { ...line, supportText: translations[position] };
      })))
      .catch(() => setError(zh ? "当前语言译文暂时不可用；关闭并重新开启可重试。" : "Translation is unavailable. Turn Show off and on to retry."));
  }, [showSupport, sessionId, language, lang, lines, zh]);

  useEffect(() => {
    if (mode !== "open" || !sessionId || expired || liveBusy) return;
    let pending = false;
    const heartbeat = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/assistant/open-tutor", {
          method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "heartbeat", sessionId, uiLanguage: lang }),
        });
        const result = await response.json() as { remainingSeconds?: number };
        if (!response.ok) { setExpired(true); return; }
        if (typeof result.remainingSeconds === "number") {
          setRemainingSeconds(result.remainingSeconds);
          if (result.remainingSeconds <= 0) setExpired(true);
        }
      } catch { /* A failed heartbeat does not grant time or bypass server checks. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(() => void heartbeat(), 15_000);
    window.addEventListener("visibilitychange", heartbeat);
    return () => { window.clearInterval(timer); window.removeEventListener("visibilitychange", heartbeat); };
  }, [mode, sessionId, expired, lang, liveBusy]);

  async function call(body: Record<string, unknown>) {
    const endpoint = body.action === "start-trial" || mode === "scene"
      ? "/api/assistant/role-tutor" : "/api/assistant/open-tutor";
    const response = await fetch(endpoint, {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string; active?: boolean; sessionId?: string; expiresAt?: number; turnCount?: number; maxTurns?: number; remainingSeconds?: number; dailyLimitSeconds?: number; profile?: OpenTutorProfile; reply?: string; opening?: string; history?: { learner: string; tutor: string }[] };
    if (!response.ok) throw new Error(result.error || (zh ? "导师暂时不可用。" : "The tutor is unavailable."));
    return result;
  }

  async function start() {
    setBusy(true); setError("");
    try {
      const result = await call({ action: "start", ...(mode === "scene" ? { scene, level, role } : {}), language, uiLanguage: lang });
      setSessionId(result.sessionId || null);
      setExpiresAt(result.expiresAt || 0);
      setExpired(false);
      setTurns(result.turnCount || 0);
      setMaxTurns(result.maxTurns || 12);
      if (mode === "open") {
        setRemainingSeconds(result.remainingSeconds ?? 0);
        setDailyLimitSeconds(result.dailyLimitSeconds ?? 0);
        if (result.profile) updateProfile(result.profile);
        try {
          const response = await fetch("/api/learning-plan", { credentials: "same-origin" });
          if (response.ok) {
            const data = await response.json() as { plans?: SavedTutorPlan[] };
            const saved = data.plans?.find(plan => plan.targetLanguage === language);
            if (saved) applySavedPlan(saved);
          }
        } catch { /* An unavailable plan read must not block the tutor conversation. */ }
      }
      translationAttemptedRef.current.clear();
      setLines([{ by: "tutor" as const, text: result.opening || "" }, ...(result.history || []).flatMap(exchange => [
        { by: "learner" as const, text: exchange.learner },
        { by: "tutor" as const, text: exchange.tutor },
      ])].filter(line => line.text));
      if (result.opening && !result.history?.length) speechCleanupRef.current = speakLearningText(result.opening, speechLocale,
        slowSpeed ? SMARTLINGO_SLOW_SPEECH_RATE : SMARTLINGO_NORMAL_SPEECH_RATE);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setBusy(false); }
  }

  async function startTrial() {
    setBusy(true); setError("");
    try {
      const result = await call({ action: "start-trial", uiLanguage: lang });
      if (result.active) setMax(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setBusy(false); }
  }

  function stopRecording() {
    if (recordTimerRef.current) window.clearTimeout(recordTimerRef.current);
    recordTimerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  async function startRecording() {
    if (!sessionId || busy || recording || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(zh ? "此浏览器无法录音，请输入回答。" : "Recording is unavailable here. Please type your reply.");
      return;
    }
    setError("");
    speechCleanupRef.current();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 256 || blob.size > 750_000) {
          setError(zh ? "录音太短或太长，请重试。" : "Recording is too short or too long. Try again.");
          return;
        }
        const form = new FormData();
        form.set("sessionId", sessionId);
        form.set("audio", new File([blob], "role-tutor-audio", { type: blob.type }));
        setBusy(true);
        try {
          const response = await fetch(mode === "open" ? "/api/assistant/open-tutor/speech" : "/api/assistant/role-tutor/speech", { method: "POST", body: form, credentials: "same-origin" });
          const result = await response.json() as { transcript?: string; error?: string };
          if (!response.ok || !result.transcript) throw new Error(result.error || "Speech unavailable.");
          setMessage(result.transcript);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        } finally { setBusy(false); }
      };
      recorder.start();
      setRecording(true);
      recordTimerRef.current = window.setTimeout(stopRecording, 12_000);
    } catch {
      setError(zh ? "麦克风未获允许。请在网站设置中开启，或直接打字。" : "Microphone access is blocked. Allow it in site settings or type your reply.");
    }
  }

  async function sendMessage(text: string, preserveDraft = false) {
    if (!sessionId || !text || busy || text.length > (mode === "open" ? 800 : 400)) return;
    speechCleanupRef.current();
    setBusy(true); setError("");
    try {
      const result = await call({ action: "turn", sessionId, message: text, uiLanguage: lang, shortAnswer });
      setLines(previous => [...previous, { by: "learner", text }, { by: "tutor", text: result.reply || "" }]);
      if (!preserveDraft) setMessage("");
      setTurns(result.turnCount || turns + 1);
      if (mode === "open") {
        if (result.profile) updateProfile(result.profile);
        if (typeof result.remainingSeconds === "number") setRemainingSeconds(result.remainingSeconds);
      }
      if (result.reply) speechCleanupRef.current = speakLearningText(result.reply, speechLocale,
        slowSpeed ? SMARTLINGO_SLOW_SPEECH_RATE : SMARTLINGO_NORMAL_SPEECH_RATE);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(message.trim());
  }

  function updateProfile(value: OpenTutorProfile) {
    setProfile(value);
    if (!savedPlanRef.current && !planEditedRef.current) {
      if (value.level !== "unknown") setPlanLevel(value.level);
      setPlanMinutes(value.dailyMinutes);
      setPlanUseCase(value.useCase);
    }
  }

  function applySavedPlan(plan: SavedTutorPlan) {
    savedPlanRef.current = plan;
    planEditedRef.current = false;
    setPlanUseCase(plan.useCase);
    setPlanMinutes(plan.dailyMinutes);
    if (plan.selfReportedLevel === "beginner" || plan.selfReportedLevel === "intermediate" || plan.selfReportedLevel === "advanced") {
      setPlanLevel(plan.selfReportedLevel);
    }
    setPlanSaved(true);
  }

  async function savePlan() {
    if (!profile || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/learning-plan", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetLanguage: language, useCase: planUseCase,
          dailyMinutes: planMinutes, selfReportedLevel: planLevel, entryMode: "adaptive" }),
      });
      if (!response.ok) throw new Error(zh ? "学习计划未保存，请重试。" : "The learning plan could not be saved. Try again.");
      const result = await response.json() as { plan?: SavedTutorPlan };
      if (result.plan) applySavedPlan(result.plan);
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setBusy(false); }
  }

  const ended = sessionId && (turns >= maxTurns || expired || (mode === "open" && !liveBusy && remainingSeconds !== null && remainingSeconds <= 0));
  return <section className="role-tutor-card" aria-label={zh ? "人工智能导师练习" : "AI tutor practice"}>
    <p className="role-tutor-disclosure">{zh ? "AI 模拟导师 · 可打字或按键说话 · 非真人或专业建议" : "Simulated AI tutor · type or push to talk · not a real person or professional advice"}</p>
    <div className={sceneVisual ? "role-tutor-intro" : undefined}><div><h2>{role}</h2>
    <p>{mode === "open"
      ? (zh ? "从你感兴趣的话题开始，导师会调整难度并与你一起拟定计划。文字练习每日试用 10 分钟、付费 30 分钟；实时语音另有每日 5 / 15 分钟。" : "Start with your interests. The tutor adapts and helps shape a plan. Text practice: 10 trial or 30 paid minutes/day; live voice separately allows 5 or 15 minutes/day.")
      : (zh ? "与场景角色一对一练习。每轮最多 10 分钟、12 次回复；不会自动启动旗舰版试用。" : "Practice one-to-one with a scene character. Each round lasts at most 10 minutes and 12 replies; it does not start a Max trial.")}</p></div>
    {sceneVisual ? <Image src={sceneVisual} alt={zh ? "模拟生活场景画面，并非实时视频" : "Illustrated role-play scene, not live video"} width={320} height={180} unoptimized/> : null}</div>
    <p>{mode === "open"
      ? (zh ? "聊天可自由换题；最近八组问答仅为今天的对话上下文，过期后清除。程度判断仅供练习参考，学习计划经你确认才保存。请勿输入敏感资料。" : "Change topics freely. The latest eight exchanges are short-lived conversation context and are cleared after today. Level estimates are practice guidance, and a plan is saved only with your confirmation. Do not enter sensitive information.")
      : (zh ? "为保持对话连贯，最近四组问答会临时保留，并在练习结束后定时清除。请勿输入敏感资料。" : "The last four exchanges are kept briefly for context and cleared after the session ends. Do not enter sensitive information.")}</p>
    {!max ? <div className="role-tutor-upgrade"><p>{trialAvailable ? (zh ? "需要有效旗舰版方案。试用不会自动开启；首次使用可主动开启一次七天试用。" : "An active Max plan is required. The trial never starts automatically; you can explicitly start one seven-day trial.") : (zh ? "七天试用已结束。订阅旗舰版后可以继续练习。" : "Your seven-day trial has ended. Subscribe to Max to continue.")}</p>{trialAvailable ? <button type="button" onClick={startTrial} disabled={busy}>{zh ? "开启七天旗舰版试用" : "Start seven-day Max trial"}</button> : null} <Link href={`/${lang}/pricing`}>{zh ? "查看旗舰版" : "Explore Max"}</Link></div> : !sessionId ? <button type="button" onClick={start} disabled={busy} data-layout-start-tutor={mode === "open" ? "true" : undefined}>{busy ? (zh ? "正在准备…" : "Preparing…") : mode === "open" ? (zh ? "开始自由对话" : "Start open conversation") : (zh ? "开始一对一角色练习" : "Start 1:1 role-play")}</button> : <>
      <p className="role-tutor-progress">{mode === "open"
        ? (zh ? `今日导师时间剩余 ${Math.floor((remainingSeconds || 0) / 60)}:${String((remainingSeconds || 0) % 60).padStart(2, "0")} ／ ${Math.floor((dailyLimitSeconds || 0) / 60)} 分钟` : `Tutor time left today ${Math.floor((remainingSeconds || 0) / 60)}:${String((remainingSeconds || 0) % 60).padStart(2, "0")} / ${Math.floor((dailyLimitSeconds || 0) / 60)} minutes`)
        : (zh ? `已用 ${turns}/${maxTurns} 次回复` : `${turns}/${maxTurns} replies used`)}
        {mode === "scene" ? <> · {turns < 3 ? (zh ? "第一步：引导练习" : "Step 1: guided practice") : turns < 8 ? (zh ? "第二步：应对变化" : "Step 2: adapt to a change") : (zh ? "第三步：独立完成" : "Step 3: independent try")}</> : null} · <button type="button" onClick={() => speechCleanupRef.current()}>{zh ? "■ 停止朗读" : "■ Stop voice"}</button></p>
      {mode === "open" ? <div className="role-tutor-preferences" aria-label={zh ? "导师对话设置" : "Tutor conversation settings"}>
        <label><input type="checkbox" checked={slowSpeed} onChange={event => setSlowSpeed(event.target.checked)}/>{zh ? "慢速" : "Slow speed"}</label>
        {language !== lang ? <label><input type="checkbox" checked={showSupport} onChange={event => {
          if (event.target.checked) translationAttemptedRef.current.clear();
          setShowSupport(event.target.checked);
        }}/>{zh ? `显示 ${supportName}` : `Show ${supportName}`}</label> : null}
        <label><input type="checkbox" checked={shortAnswer} onChange={event => setShortAnswer(event.target.checked)}/>{zh ? "简短回答" : "Short answers"}</label>
      </div> : null}
      {mode === "open" ? <MaxLiveTutorCall sessionId={sessionId} language={language} lang={lang}
        learningName={learningName} supportLanguageName={supportLanguageName} profile={profile}
        slowSpeed={slowSpeed} shortAnswer={shortAnswer} showSupport={showSupport}
        onCallActive={setLiveBusy}/> : null}
      <ol className="role-tutor-lines" aria-live="polite">{lines.map((line, index) => <li key={index} className={line.by}>
        <strong>{line.by === "learner" ? (zh ? "你" : "You") : (zh ? "AI 教师 · " : "AI teacher · ") + (line.by === "tutor" ? role : "")}</strong><span dir="auto">{line.text}</span>
        {showSupport && line.supportText ? <small className="role-tutor-translation" lang={lang} dir="auto">{line.supportText}</small> : null}
        {line.by === "tutor" ? <span className="role-tutor-voice"><button type="button" onClick={() => { speechCleanupRef.current = speakLearningText(line.text, speechLocale, slowSpeed ? SMARTLINGO_SLOW_SPEECH_RATE : SMARTLINGO_NORMAL_SPEECH_RATE); }}>{zh ? "▶ 重听" : "▶ Replay"}</button>{mode === "scene" ? <button type="button" onClick={() => { speechCleanupRef.current = speakLearningText(line.text, speechLocale, SMARTLINGO_SLOW_SPEECH_RATE); }}>{zh ? "🐢 慢速" : "🐢 Slow"}</button> : null}</span> : null}
      </li>)}</ol>
      {ended ? <p role="status">{mode === "open" ? (zh ? "今日导师时间或回复次数已用完。明天可继续；你仍可使用快捷版练习。" : "Today's tutor time or replies are used up. Continue tomorrow or practice in Flash.") : (zh ? "本轮练习已结束。你可以返回场景继续免费练习。" : "This round has ended. Return to the scene to keep practicing for free.")}</p> : liveBusy ? <p role="status">{zh ? "实时对话进行中；结束通话后可继续文字聊天。" : "Live conversation in progress. End the call to continue by text."}</p> : <form onSubmit={submit}>
        <label htmlFor="role-tutor-message">{zh ? "你的回答" : "Your reply"}</label>
        <button className="role-tutor-hint" type="button" onClick={() => sendMessage(mode === "open" ? (zh ? "我们一起制定学习计划吧。请根据我的兴趣和目前程度提议每天可以做什么。" : "Let's make a learning plan together. Based on my interests and current ability, what should I do each day?") : (zh ? "我需要一点提示。请给一个简短示范，再让我自己回答。" : "I need a hint. Please give one short example, then let me answer myself."), true)} disabled={busy || recording}>{mode === "open" ? (zh ? "与导师讨论学习计划" : "Discuss a study plan") : (zh ? "需要提示？问 AI 教师（使用 1 次回复）" : "Need a hint? Ask the AI teacher (uses 1 reply)")}</button>
        <div><input id="role-tutor-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={mode === "open" ? 800 : 400} autoComplete="off" placeholder={mode === "open" ? (zh ? "聊你的兴趣、目标，或任何想练习的话题…" : "Talk about an interest, goal, or any topic you want to practice…") : (zh ? "输入或录一句话…" : "Type or record one sentence…")}/><button type="button" onClick={recording ? stopRecording : startRecording} disabled={busy} aria-label={recording ? (zh ? "结束录音" : "Stop recording") : (zh ? "按键说话" : "Push to talk")}>{recording ? (zh ? "■ 结束" : "■ Stop") : (zh ? "🎙 说话" : "🎙 Speak")}</button><button disabled={busy || recording || !message.trim()}>{busy ? "…" : (zh ? "发送" : "Send")}</button></div>
        <small>{zh ? "录音最多 12 秒，识别结果请先检查，再发送；录音不保存。" : "Record up to 12 seconds. Review the transcript before sending; audio is not saved."}</small>
      </form>}
      {mode === "open" && profile && turns >= 2 ? <div className="role-tutor-plan">
        <h3>{zh ? "一起确认学习计划" : "Agree on your learning plan"}</h3>
        <p>{profile.level === "unknown" ? (zh ? "导师还在了解你的程度。" : "The tutor is still learning your level.") : (zh ? `练习程度参考：${profile.level}。${profile.levelReason}` : `Practice-level estimate: ${profile.level}. ${profile.levelReason}`)}</p>
        {profile.interests ? <p>{zh ? "感兴趣的话题：" : "Interests: "}{profile.interests}</p> : null}
        {profile.planFocus ? <p>{zh ? "建议重点：" : "Suggested focus: "}{profile.planFocus}</p> : null}
        <div className="role-tutor-plan-fields"><label>{zh ? "学习重点" : "Learning focus"}<select value={planUseCase} onChange={event => { planEditedRef.current = true; setPlanSaved(false); setPlanUseCase(event.target.value); }}><option value="daily_life">{zh ? "日常生活" : "Daily life"}</option><option value="travel">{zh ? "旅行" : "Travel"}</option><option value="work">{zh ? "工作" : "Work"}</option><option value="study">{zh ? "学习" : "Study"}</option><option value="community">{zh ? "社交" : "Community"}</option></select></label>
          <label>{zh ? "每天学习" : "Study per day"}<select value={planMinutes} onChange={event => { planEditedRef.current = true; setPlanSaved(false); setPlanMinutes(Number(event.target.value)); }}>{[5, 10, 15, 20].map(minutes => <option key={minutes} value={minutes}>{minutes} {zh ? "分钟" : "minutes"}</option>)}</select></label>
          <label>{zh ? "你的自选起点" : "Your starting level"}<select value={planLevel} onChange={event => { planEditedRef.current = true; setPlanSaved(false); setPlanLevel(event.target.value as typeof planLevel); }}><option value="beginner">{zh ? "初级" : "Beginner"}</option><option value="intermediate">{zh ? "中级" : "Intermediate"}</option><option value="advanced">{zh ? "高级" : "Advanced"}</option></select></label></div>
        <button type="button" onClick={savePlan} disabled={busy}>{zh ? "确认并保存学习计划" : "Confirm and save plan"}</button>
        {planSaved ? <p role="status">{zh ? "已保存。你仍可继续和导师讨论并修改。" : "Saved. You can keep discussing and revise it later."}</p> : null}
      </div> : null}
    </>}
    {error ? <p className="role-tutor-error" role="alert">{error}</p> : null}
    <Link href={mode === "open" ? `/${lang}/programs/${language}?path=max` : `/${lang}/play/everyday?language=${language}&scene=${scene}&level=${level}`}>{mode === "open" ? (zh ? "← 返回语言主页" : "← Back to language") : (zh ? "← 返回场景" : "← Back to scene")}</Link>
  </section>;
}
