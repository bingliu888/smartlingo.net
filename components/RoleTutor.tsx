"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Line = { by: "learner" | "tutor"; text: string };

export function RoleTutor({ lang, language, scene, level, role }: {
  lang: string; language: string; scene: string;
  level: "beginner" | "intermediate" | "advanced"; role: string;
}) {
  const zh = lang === "zh";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [turns, setTurns] = useState(0);
  const [message, setMessage] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    const result = await response.json() as { error?: string; sessionId?: string; expiresAt?: number; turnCount?: number; reply?: string; history?: { learner: string; tutor: string }[] };
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!sessionId || !text || busy || text.length > 400) return;
    setBusy(true); setError("");
    try {
      const result = await call({ action: "turn", sessionId, message: text, uiLanguage: zh ? "zh" : "en" });
      setLines(previous => [...previous, { by: "learner", text }, { by: "tutor", text: result.reply || "" }]);
      setMessage(""); setTurns(result.turnCount || turns + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setBusy(false); }
  }

  const ended = sessionId && (turns >= 12 || expired);
  return <section className="role-tutor-card" aria-label={zh ? "角色导师练习" : "Role tutor practice"}>
    <p className="role-tutor-disclosure">{zh ? "AI 模拟角色 · 文字对话 · 非真人或专业建议" : "Simulated AI character · text conversation · not a real person or professional advice"}</p>
    <h2>{role}</h2>
    <p>{zh ? "练习真实场景中的一问一答。每轮最多 10 分钟、12 次回复；不会自动启动 Max 试用。" : "Practice a real-life back-and-forth. Each round lasts at most 10 minutes and 12 replies; it does not start a Max trial."}</p>
    <p>{zh ? "为保持对话连贯，最近四组问答会临时保留，并在练习结束后定时清除。请勿输入敏感资料。" : "The last four exchanges are kept briefly for context and cleared after the session ends. Do not enter sensitive information."}</p>
    {!sessionId ? <button type="button" onClick={start} disabled={busy}>{busy ? (zh ? "正在准备…" : "Preparing…") : (zh ? "开始文字角色练习" : "Start text role-play")}</button> : <>
      <p className="role-tutor-progress">{zh ? `已用 ${turns}/12 次回复` : `${turns}/12 replies used`}</p>
      <ol className="role-tutor-lines" aria-live="polite">{lines.map((line, index) => <li key={index} className={line.by}>
        <strong>{line.by === "learner" ? (zh ? "你" : "You") : (zh ? "AI 角色" : "AI character")}</strong><span>{line.text}</span>
      </li>)}</ol>
      {ended ? <p role="status">{zh ? "本轮练习已结束。你可以返回场景继续免费练习。" : "This round has ended. Return to the scene to keep practicing for free."}</p> : <form onSubmit={submit}>
        <label htmlFor="role-tutor-message">{zh ? "你的回答" : "Your reply"}</label>
        <div><input id="role-tutor-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={400} autoComplete="off" placeholder={zh ? "输入一句话…" : "Type one sentence…"}/><button disabled={busy || !message.trim()}>{busy ? "…" : (zh ? "发送" : "Send")}</button></div>
      </form>}
    </>}
    {error ? <p className="role-tutor-error" role="alert">{error}</p> : null}
    <Link href={`/${lang}/play/everyday?language=${language}&scene=${scene}&level=${level}`}>{zh ? "← 返回场景" : "← Back to scene"}</Link>
  </section>;
}
