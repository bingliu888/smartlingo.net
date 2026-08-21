"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import type { RealtimeCallSession } from "./RealtimeCallStage";

type ClassCallSession = RealtimeCallSession & {
  threadKind?: string;
  participantCount?: number;
  soloSecondsRemaining?: number | null;
};

export function ClassAudioCallDock({ session, lang, onClose }: {
  session: ClassCallSession;
  lang: string;
  onClose: () => void;
}) {
  const zh = lang === "zh";
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState(session.participantCount || 1);
  const [remaining, setRemaining] = useState<number | null>(session.soloSecondsRemaining ?? 60);
  const [error, setError] = useState("");

  const heartbeat = useCallback(async () => {
    const response = await fetch("/api/messages/calls", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "heartbeat", callId: session.callId }),
    });
    const payload = await response.json().catch(() => null) as { ended?: boolean; participantCount?: number; soloSecondsRemaining?: number | null } | null;
    if (payload?.participantCount !== undefined) setParticipants(payload.participantCount);
    setRemaining(payload?.soloSecondsRemaining ?? null);
    if (payload?.ended) { await meeting?.leave().catch(() => undefined); onClose(); }
  }, [meeting, onClose, session.callId]);

  useEffect(() => {
    let active = true;
    void initMeeting({ authToken: session.authToken, defaults: { audio: true, video: false } })
      .catch(() => { if (active) setError(zh ? "无法连接语音通话。" : "Could not connect the audio call."); });
    return () => { active = false; };
  }, [initMeeting, session.authToken, zh]);

  useEffect(() => {
    if (!meeting) return;
    const updateParticipants = () => setParticipants(meeting.participants.joined.size + 1);
    const handleJoined = () => { setJoined(true); updateParticipants(); void heartbeat(); };
    const handleLeft = () => onClose();
    const handleAudio = ({ audioEnabled }: { audioEnabled: boolean }) => setMuted(!audioEnabled);
    meeting.self.on("roomJoined", handleJoined);
    meeting.self.on("roomLeft", handleLeft);
    meeting.self.on("audioUpdate", handleAudio);
    meeting.participants.joined.on("participantJoined", updateParticipants);
    meeting.participants.joined.on("participantLeft", updateParticipants);
    void meeting.join().catch(() => setError(zh ? "加入通话失败，请重试。" : "Could not join the call. Please retry."));
    return () => {
      meeting.self.removeListener("roomJoined", handleJoined);
      meeting.self.removeListener("roomLeft", handleLeft);
      meeting.self.removeListener("audioUpdate", handleAudio);
      meeting.participants.joined.removeListener("participantJoined", updateParticipants);
      meeting.participants.joined.removeListener("participantLeft", updateParticipants);
    };
  }, [heartbeat, meeting, onClose, zh]);

  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(() => void heartbeat(), 10_000);
    return () => window.clearInterval(timer);
  }, [heartbeat, joined]);

  async function toggleMute() {
    if (!meeting) return;
    if (meeting.self.audioEnabled) await meeting.self.disableAudio();
    else await meeting.self.enableAudio();
  }

  async function leave() {
    await fetch("/api/messages/calls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "leave", callId: session.callId }) }).catch(() => undefined);
    await meeting?.leave().catch(() => undefined);
    onClose();
  }

  return <aside className="class-audio-dock" role="status" aria-live="polite">
    <div className={`audio-pulse${joined ? " live" : ""}`} aria-hidden="true">◖</div>
    <div className="class-audio-copy"><b>{zh ? "课程语音通话" : "Course audio call"}</b><small>{error || (joined ? (participants >= 2 ? (zh ? `${participants} 人正在通话 · 可继续发送文字消息` : `${participants} people in call · text chat stays available`) : (zh ? `等待其他同学加入${remaining !== null ? ` · ${remaining} 秒后自动结束` : ""}` : `Waiting for classmates${remaining !== null ? ` · ends in ${remaining}s` : ""}`)) : (zh ? "正在安全连接…" : "Connecting securely…"))}</small></div>
    <button type="button" onClick={() => void toggleMute()} disabled={!meeting || !joined}>{muted ? (zh ? "打开麦克风" : "Unmute") : (zh ? "静音" : "Mute")}</button>
    <button type="button" className="leave" onClick={() => void leave()}>{zh ? "离开" : "Leave"}</button>
    <style>{`.class-audio-dock{position:fixed;z-index:980;left:50%;top:calc(var(--site-notification-height,0px) + 92px);transform:translateX(-50%);width:min(760px,calc(100vw - 28px));padding:11px 13px;display:grid;grid-template-columns:42px minmax(0,1fr) auto auto;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.22);border-radius:18px;background:rgba(13,55,46,.96);color:#fff;box-shadow:0 14px 34px rgba(0,0,0,.25);backdrop-filter:blur(14px)}.audio-pulse{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:#345c52}.audio-pulse.live{background:#0ea477;box-shadow:0 0 0 6px rgba(14,164,119,.16)}.class-audio-copy b,.class-audio-copy small{display:block}.class-audio-copy small{margin-top:2px;color:#c7ddd6;overflow-wrap:anywhere}.class-audio-dock button{min-height:40px;padding:0 14px;border:1px solid rgba(255,255,255,.24);border-radius:999px;background:#fff;color:#173f34;font-weight:850}.class-audio-dock button.leave{background:#c94a3b;color:#fff;border-color:#c94a3b}@media(max-width:620px){.class-audio-dock{top:auto;bottom:calc(92px + env(safe-area-inset-bottom));grid-template-columns:38px minmax(0,1fr) auto}.audio-pulse{width:38px;height:38px}.class-audio-dock button{padding:0 10px}.class-audio-dock button.leave{grid-column:3}.class-audio-dock button:not(.leave){grid-column:2;grid-row:2;width:max-content}.class-audio-copy small{font-size:11px}}`}</style>
  </aside>;
}
