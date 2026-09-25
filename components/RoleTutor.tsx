"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { speakLearningText, SMARTLINGO_NORMAL_SPEECH_RATE, SMARTLINGO_SLOW_SPEECH_RATE } from "../lib/smartlingo-speech";

type Line = { by: "learner" | "tutor"; text: string };

export function RoleTutor({ lang, language, scene, level, role, speechLocale, initialMax, trialAvailable }: {
  lang: string; language: string; scene: string;
  level: "beginner" | "intermediate" | "advanced"; role: string; speechLocale: string; initialMax: boolean; trialAvailable: boolean;
}) {
  const zh = lang === "zh";
  const [max, setMax] = useState(initialMax);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [turns, setTurns] = useState(0);
  const [message, setMessage] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
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

  async function call(body: Record<string, unknown>) {
    const response = await fetch("/api/assistant/role-tutor", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string; active?: boolean; sessionId?: string; expiresAt?: number; turnCount?: number; reply?: string; history?: { learner: string; tutor: string }[] };
    if (!response.ok) throw new Error(result.error || (zh ? "导师暂时不可用。" : "The tutor is unavailable."));
    return result;
  }

  async function start() {
    setBusy(true); setError("");
    try {
      const result = await call({ action: "start", scene, language, level, role, uiLanguage: zh ? "zh" : "en" });
      setSessionId(result.sessionId || null);
      setExpiresAt(result.expiresAt || 0);
      setExpired(false);
      setTurns(result.turnCount || 0);
      setLines((result.history || []).flatMap(exchange => [
        { by: "learner" as const, text: exchange.learner },
        { by: "tutor" as const, text: exchange.tutor },
      ]));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setBusy(false); }
  }

  async function startTrial() {
    setBusy(true); setError("");
    try {
      const result = await call({ action: "start-trial", uiLanguage: zh ? "zh" : "en" });
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
          const response = await fetch("/api/assistant/role-tutor/speech", { method: "POST", body: form, credentials: "same-origin" });
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!sessionId || !text || busy || text.length > 400) return;
    speechCleanupRef.current();
    setBusy(true); setError("");
    try {
      const result = await call({ action: "turn", sessionId, message: text, uiLanguage: zh ? "zh" : "en" });
      setLines(previous => [...previous, { by: "learner", text }, { by: "tutor", text: result.reply || "" }]);
      setMessage(""); setTurns(result.turnCount || turns + 1);
      if (result.reply) speechCleanupRef.current = speakLearningText(result.reply, speechLocale);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setBusy(false); }
  }

  const ended = sessionId && (turns >= 12 || expired);
  return <section className="role-tutor-card" aria-label={zh ? "角色导师练习" : "Role tutor practice"}>
    <p className="role-tutor-disclosure">{zh ? "AI 模拟角色 · 可打字或按键说话 · 非真人或专业建议" : "Simulated AI character · type or push to talk · not a real person or professional advice"}</p>
    <h2>{role}</h2>
    <p>{zh ? "与场景角色一对一练习。每轮最多 10 分钟、12 次回复；不会自动启动旗舰版试用。" : "Practice one-to-one with a scene character. Each round lasts at most 10 minutes and 12 replies; it does not start a Max trial."}</p>
    <p>{zh ? "为保持对话连贯，最近四组问答会临时保留，并在练习结束后定时清除。请勿输入敏感资料。" : "The last four exchanges are kept briefly for context and cleared after the session ends. Do not enter sensitive information."}</p>
    {!max ? <div className="role-tutor-upgrade"><p>{trialAvailable ? (zh ? "需要有效旗舰版方案。试用不会自动开启；首次使用可主动开启一次七天试用。" : "An active Max plan is required. The trial never starts automatically; you can explicitly start one seven-day trial.") : (zh ? "七天试用已结束。订阅旗舰版后可以继续练习。" : "Your seven-day trial has ended. Subscribe to Max to continue.")}</p>{trialAvailable ? <button type="button" onClick={startTrial} disabled={busy}>{zh ? "开启七天旗舰版试用" : "Start seven-day Max trial"}</button> : null} <Link href={`/${lang}/pricing`}>{zh ? "查看旗舰版" : "Explore Max"}</Link></div> : !sessionId ? <button type="button" onClick={start} disabled={busy}>{busy ? (zh ? "正在准备…" : "Preparing…") : (zh ? "开始一对一角色练习" : "Start 1:1 role-play")}</button> : <>
      <p className="role-tutor-progress">{zh ? `已用 ${turns}/12 次回复` : `${turns}/12 replies used`} · <button type="button" onClick={() => speechCleanupRef.current()}>{zh ? "■ 停止朗读" : "■ Stop voice"}</button></p>
      <ol className="role-tutor-lines" aria-live="polite">{lines.map((line, index) => <li key={index} className={line.by}>
        <strong>{line.by === "learner" ? (zh ? "你" : "You") : (zh ? "AI 教师 · " : "AI teacher · ") + (line.by === "tutor" ? role : "")}</strong><span dir="auto">{line.text}</span>
        {line.by === "tutor" ? <span className="role-tutor-voice"><button type="button" onClick={() => { speechCleanupRef.current = speakLearningText(line.text, speechLocale, SMARTLINGO_NORMAL_SPEECH_RATE); }}>{zh ? "▶ 重听" : "▶ Replay"}</button><button type="button" onClick={() => { speechCleanupRef.current = speakLearningText(line.text, speechLocale, SMARTLINGO_SLOW_SPEECH_RATE); }}>{zh ? "🐢 慢速" : "🐢 Slow"}</button></span> : null}
      </li>)}</ol>
      {ended ? <p role="status">{zh ? "本轮练习已结束。你可以返回场景继续免费练习。" : "This round has ended. Return to the scene to keep practicing for free."}</p> : <form onSubmit={submit}>
        <label htmlFor="role-tutor-message">{zh ? "你的回答" : "Your reply"}</label>
        <div><input id="role-tutor-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={400} autoComplete="off" placeholder={zh ? "输入或录一句话…" : "Type or record one sentence…"}/><button type="button" onClick={recording ? stopRecording : startRecording} disabled={busy} aria-label={recording ? (zh ? "结束录音" : "Stop recording") : (zh ? "按键说话" : "Push to talk")}>{recording ? (zh ? "■ 结束" : "■ Stop") : (zh ? "🎙 说话" : "🎙 Speak")}</button><button disabled={busy || recording || !message.trim()}>{busy ? "…" : (zh ? "发送" : "Send")}</button></div>
        <small>{zh ? "录音最多 12 秒，识别结果请先检查，再发送；录音不保存。" : "Record up to 12 seconds. Review the transcript before sending; audio is not saved."}</small>
      </form>}
    </>}
    {error ? <p className="role-tutor-error" role="alert">{error}</p> : null}
    <Link href={`/${lang}/play/everyday?language=${language}&scene=${scene}&level=${level}`}>{zh ? "← 返回场景" : "← Back to scene"}</Link>
  </section>;
}
