"use client";

import { useEffect, useState } from "react";
import { useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import { RtkMeeting, RtkUiProvider } from "@cloudflare/realtimekit-react-ui";

export type RealtimeCallSession = {
  callId: string;
  mode: "audio" | "video";
  authToken: string;
  expiresAt: number;
  startedBy?: string;
};

export function RealtimeCallStage({ session, lang, currentUserId, onClose }: {
  session: RealtimeCallSession;
  lang: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const zh = lang === "zh";
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void initMeeting({
      authToken: session.authToken,
      defaults: { audio: true, video: session.mode === "video" },
    }).catch(() => { if (active) setError(zh ? "无法连接通话，请稍后重试。" : "Could not connect the call. Try again shortly."); });
    return () => { active = false; };
  }, [initMeeting, session.authToken, session.mode, zh]);

  useEffect(() => {
    if (!meeting) return;
    const handleLeft = () => onClose();
    meeting.self.on("roomLeft", handleLeft);
    return () => { meeting.self.removeListener("roomLeft", handleLeft); };
  }, [meeting, onClose]);

  async function leave(endForEveryone = false) {
    if (endForEveryone) {
      await fetch("/api/messages/calls", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "end", callId: session.callId }),
      }).catch(() => undefined);
    } else {
      await fetch("/api/messages/calls", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "leave", callId: session.callId }),
      }).catch(() => undefined);
    }
    await meeting?.leave().catch(() => undefined);
    onClose();
  }

  return <div className="realtime-call-stage" role="dialog" aria-modal="true" aria-label={session.mode === "video" ? (zh ? "视频通话" : "Video call") : (zh ? "音频通话" : "Audio call")}>
    <header>
      <div><b>{session.mode === "video" ? (zh ? "视频通话" : "Video call") : (zh ? "音频通话" : "Audio call")}</b><small>{session.mode === "audio" ? (zh ? "仅传输音频；摄像头保持关闭" : "Audio only; camera remains off") : (zh ? "可在通话中开关摄像头" : "Camera can be toggled during the call")}</small></div>
      <div><button type="button" onClick={() => void leave(false)}>{zh ? "离开" : "Leave"}</button>{session.startedBy === currentUserId && <button type="button" className="danger" onClick={() => void leave(true)}>{zh ? "结束通话" : "End call"}</button>}</div>
    </header>
    {error ? <div className="realtime-call-error">{error}</div> : meeting ? <RtkUiProvider meeting={meeting}><RtkMeeting meeting={meeting}/></RtkUiProvider> : <div className="realtime-call-loading">{zh ? "正在安全连接…" : "Connecting securely…"}</div>}
  </div>;
}
