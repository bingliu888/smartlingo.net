"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import type { RealtimeCallSession } from "./RealtimeCallStage";

type PersistentSession = RealtimeCallSession & {
  threadId: string;
  threadTitle: string;
  currentUserId: string;
  participantCount?: number;
  soloSecondsRemaining?: number | null;
  silenceSecondsRemaining?: number | null;
  cameraCount?: number;
};

type ParticipantMedia = {
  id: string;
  name: string;
  audioEnabled: boolean;
  audioTrack?: MediaStreamTrack;
  videoEnabled: boolean;
  videoTrack?: MediaStreamTrack;
};

type PersistentCallContextValue = {
  session: PersistentSession | null;
  openCall: (session: RealtimeCallSession & Partial<PersistentSession>, details: Pick<PersistentSession, "threadId" | "threadTitle" | "currentUserId">) => void;
};

const PersistentCallContext = createContext<PersistentCallContextValue | null>(null);

export function usePersistentCall() {
  const value = useContext(PersistentCallContext);
  if (!value) throw new Error("usePersistentCall must be used inside PersistentCallProvider");
  return value;
}

function RemoteMedia({ participant }: { participant: ParticipantMedia }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = participant.audioEnabled && participant.audioTrack ? new MediaStream([participant.audioTrack]) : null;
  }, [participant.audioEnabled, participant.audioTrack]);
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = participant.videoEnabled && participant.videoTrack ? new MediaStream([participant.videoTrack]) : null;
  }, [participant.videoEnabled, participant.videoTrack]);
  return <article><video ref={videoRef} autoPlay playsInline/><audio ref={audioRef} autoPlay/><span>{participant.name}</span>{!participant.audioEnabled && <i aria-label="Microphone off">⌁</i>}</article>;
}

export function PersistentCallProvider({ children, lang }: { children: React.ReactNode; lang: "zh" | "en" }) {
  const zh = lang === "zh";
  const pathname = usePathname();
  const [session, setSession] = useState<PersistentSession | null>(null);
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraCount, setCameraCount] = useState(0);
  const [participants, setParticipants] = useState(1);
  const [remaining, setRemaining] = useState<number | null>(60);
  const [silenceRemaining, setSilenceRemaining] = useState<number | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<ParticipantMedia[]>([]);
  const [videoOpen, setVideoOpen] = useState(false);
  const [error, setError] = useState("");
  const audioActivity = useRef(false);

  const openCall = useCallback((next: RealtimeCallSession & Partial<PersistentSession>, details: Pick<PersistentSession, "threadId" | "threadTitle" | "currentUserId">) => {
    setError("");
    setSession({ ...next, ...details } as PersistentSession);
  }, []);

  const clearCall = useCallback(async () => {
    await meeting?.leave().catch(() => undefined);
    setSession(null); setJoined(false); setMuted(false); setCameraOn(false); setCameraCount(0); setVideoOpen(false); setRemoteMedia([]);
  }, [meeting]);

  const heartbeat = useCallback(async () => {
    if (!session) return;
    const response = await fetch("/api/messages/calls", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "heartbeat", callId: session.callId, microphoneOn: !muted, audioActivity: audioActivity.current }),
    });
    audioActivity.current = false;
    const payload = await response.json().catch(() => null) as { ended?: boolean; participantCount?: number; soloSecondsRemaining?: number | null; silenceSecondsRemaining?: number | null; cameraCount?: number } | null;
    if (payload?.participantCount !== undefined) setParticipants(payload.participantCount);
    if (payload?.cameraCount !== undefined) setCameraCount(payload.cameraCount);
    setRemaining(payload?.soloSecondsRemaining ?? null);
    setSilenceRemaining(payload?.silenceSecondsRemaining ?? null);
    if (!response.ok || payload?.ended) await clearCall();
  }, [clearCall, muted, session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void initMeeting({ authToken: session.authToken, defaults: { audio: true, video: false } })
      .catch(() => { if (active) setError(zh ? "无法连接实时通话。" : "Could not connect the live call."); });
    return () => { active = false; };
  }, [initMeeting, session, zh]);

  useEffect(() => {
    if (!meeting || !session) return;
    const updateParticipants = () => {
      const list = meeting.participants.joined.toArray() as ParticipantMedia[];
      setParticipants(list.length + 1);
      setRemoteMedia(list);
    };
    const handleJoined = () => { setJoined(true); setMuted(!meeting.self.audioEnabled); updateParticipants(); void heartbeat(); };
    const handleLeft = () => { setSession(null); setJoined(false); setRemoteMedia([]); };
    const handleAudio = ({ audioEnabled }: { audioEnabled: boolean }) => setMuted(!audioEnabled);
    const handleVideo = ({ videoEnabled }: { videoEnabled: boolean }) => setCameraOn(videoEnabled);
    const handleSpeaker = ({ volume }: { peerId: string; volume: number }) => { if (Number.isFinite(volume) && volume > 0) audioActivity.current = true; };
    meeting.self.on("roomJoined", handleJoined);
    meeting.self.on("roomLeft", handleLeft);
    meeting.self.on("audioUpdate", handleAudio);
    meeting.self.on("videoUpdate", handleVideo);
    meeting.participants.on("activeSpeaker", handleSpeaker);
    meeting.participants.joined.on("participantJoined", updateParticipants);
    meeting.participants.joined.on("participantLeft", updateParticipants);
    meeting.participants.joined.on("audioUpdate", updateParticipants);
    meeting.participants.joined.on("videoUpdate", updateParticipants);
    void meeting.join().catch(() => setError(zh ? "加入通话失败，请重试。" : "Could not join the call. Please retry."));
    return () => {
      meeting.self.removeListener("roomJoined", handleJoined);
      meeting.self.removeListener("roomLeft", handleLeft);
      meeting.self.removeListener("audioUpdate", handleAudio);
      meeting.self.removeListener("videoUpdate", handleVideo);
      meeting.participants.removeListener("activeSpeaker", handleSpeaker);
      meeting.participants.joined.removeListener("participantJoined", updateParticipants);
      meeting.participants.joined.removeListener("participantLeft", updateParticipants);
      meeting.participants.joined.removeListener("audioUpdate", updateParticipants);
      meeting.participants.joined.removeListener("videoUpdate", updateParticipants);
    };
  }, [heartbeat, meeting, session, zh]);

  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(() => void heartbeat(), 10_000);
    return () => window.clearInterval(timer);
  }, [heartbeat, joined]);

  useEffect(() => {
    const track = meeting?.self.rawAudioTrack || meeting?.self.audioTrack;
    if (!joined || muted || !track) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const source = context.createMediaStreamSource(new MediaStream([track]));
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) { const centered = (sample - 128) / 128; energy += centered * centered; }
      if (Math.sqrt(energy / samples.length) > 0.025) audioActivity.current = true;
    }, 250);
    return () => { window.clearInterval(timer); source.disconnect(); void context.close(); };
  }, [joined, meeting, muted]);

  async function toggleMute() {
    if (!meeting || !joined) return;
    if (meeting.self.audioEnabled) await meeting.self.disableAudio(); else await meeting.self.enableAudio();
  }

  async function toggleCamera() {
    if (!meeting || !session || !joined) return;
    if (meeting.self.videoEnabled) {
      await meeting.self.disableVideo();
      await fetch("/api/messages/calls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "camera_off", callId: session.callId }) });
      setCameraOn(false); setCameraCount(value => Math.max(0, value - 1));
      return;
    }
    const response = await fetch("/api/messages/calls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "camera_on", callId: session.callId }) });
    const payload = await response.json().catch(() => null) as { allowed?: boolean; cameraCount?: number } | null;
    if (!response.ok || !payload?.allowed) { setError(zh ? "已有 4 位成员开启摄像头，请稍后再试。" : "Four members already have cameras on. Try again later."); return; }
    try { await meeting.self.enableVideo(); setCameraOn(true); setCameraCount(payload.cameraCount || 1); setVideoOpen(true); }
    catch { await fetch("/api/messages/calls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "camera_off", callId: session.callId }) }); setError(zh ? "无法开启摄像头，请检查权限。" : "Camera unavailable. Check browser permission."); }
  }

  async function leave() {
    if (session) await fetch("/api/messages/calls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "leave", callId: session.callId }) }).catch(() => undefined);
    await clearCall();
  }

  const inCallRoom = useMemo(() => {
    if (!session) return false;
    try { return decodeURIComponent(pathname).endsWith(`/messages/live/${session.threadId}`); } catch { return false; }
  }, [pathname, session]);
  const value = useMemo(() => ({ session, openCall }), [openCall, session]);

  return <PersistentCallContext.Provider value={value}>{children}{session && <>
    {inCallRoom ? <aside className="persistent-call-bar" role="status" aria-live="polite">
      <span className={`call-live-dot${joined ? " joined" : ""}`}>◖</span><div><b>{session.threadTitle}</b><small>{error || (participants < 2 ? (zh ? `等待其他成员${remaining !== null ? ` · ${remaining} 秒后结束` : ""}` : `Waiting for others${remaining !== null ? ` · ends in ${remaining}s` : ""}`) : (zh ? `${participants} 人通话 · ${silenceRemaining ?? 60} 秒无发言将结束` : `${participants} in call · ends after ${silenceRemaining ?? 60}s of silence`))}</small></div>
      <span className={`mic-state${muted ? " muted" : ""}`}>{muted ? "⌁" : "●"} {muted ? (zh ? "麦克风已关" : "Mic off") : (zh ? "麦克风开启" : "Mic on")}</span>
      <button type="button" onClick={() => void toggleMute()}>{muted ? (zh ? "打开麦克风" : "Unmute") : (zh ? "静音" : "Mute")}</button>
      <button type="button" onClick={() => void toggleCamera()}>{cameraOn ? (zh ? "关闭摄像头" : "Camera off") : (zh ? `开启摄像头 ${cameraCount}/4` : `Camera on ${cameraCount}/4`)}</button>
      {(cameraOn || cameraCount > 0) && <button type="button" onClick={() => setVideoOpen(value => !value)}>{videoOpen ? (zh ? "收起视频" : "Hide video") : (zh ? "查看视频" : "Show video")}</button>}
      <button className="call-leave" type="button" onClick={() => void leave()}>{zh ? "离开" : "Leave"}</button>
    </aside> : <Link className="floating-active-call" href={`/${lang}/messages/live/${encodeURIComponent(session.threadId)}`}><span>◖</span><b>{participants}</b><small>{zh ? "返回通话" : "Return to call"}</small></Link>}
    {inCallRoom && videoOpen && <section className="call-video-grid" aria-label={zh ? "视频通话画面" : "Video call views"}>
      {cameraOn && <article className="self-video"><video ref={node => { if (node && meeting?.self.videoTrack) node.srcObject = new MediaStream([meeting.self.videoTrack]); }} autoPlay muted playsInline/><span>{zh ? "我" : "You"}</span></article>}
      {remoteMedia.filter(person => person.videoEnabled).slice(0, 4).map(person => <RemoteMedia key={person.id} participant={person}/>)}
    </section>}
  </>}
  <style>{`.persistent-call-bar{position:fixed;z-index:990;left:50%;top:calc(var(--site-notification-height,0px) + 88px);transform:translateX(-50%);width:min(1080px,calc(100vw - 24px));padding:10px 12px;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.22);border-radius:18px;background:rgba(13,55,46,.97);color:#fff;box-shadow:0 14px 34px rgba(0,0,0,.25);backdrop-filter:blur(14px)}.persistent-call-bar>div{flex:1;min-width:0}.persistent-call-bar b,.persistent-call-bar small{display:block;overflow-wrap:anywhere}.persistent-call-bar small{color:#c7ddd6}.persistent-call-bar button,.mic-state{min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.24);border-radius:999px;background:#fff;color:#173f34;font-weight:800;white-space:nowrap}.mic-state{display:flex;align-items:center;background:#194f42;color:#d9f4e9}.mic-state.muted{color:#ffd8d2}.persistent-call-bar .call-leave{background:#c94a3b;color:#fff}.call-live-dot{width:40px;height:40px;display:grid;place-items:center;border-radius:50%;background:#345c52}.call-live-dot.joined{background:#0ea477;box-shadow:0 0 0 5px rgba(14,164,119,.16)}.floating-active-call{position:fixed;z-index:970;left:max(16px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));min-height:58px;padding:8px 14px 8px 9px;display:grid;grid-template-columns:38px auto;grid-template-rows:auto auto;align-items:center;gap:0 9px;border-radius:999px;background:#124f41;color:#fff;text-decoration:none;box-shadow:0 15px 35px rgba(0,0,0,.26)}.floating-active-call>span{grid-row:1/3;width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#12a478}.floating-active-call>b{font-size:16px}.floating-active-call>small{font-size:11px;color:#d0e8e1}.call-video-grid{position:fixed;z-index:985;inset:160px 20px auto;max-height:calc(100vh - 190px);padding:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;border-radius:20px;background:#092720;box-shadow:0 20px 60px rgba(0,0,0,.36);overflow:auto}.call-video-grid article{position:relative;min-width:0;aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:#173d34}.call-video-grid video{width:100%;height:100%;object-fit:cover}.call-video-grid span{position:absolute;left:10px;bottom:8px;padding:4px 8px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff}.call-video-grid i{position:absolute;right:10px;bottom:8px;color:#ffd7d0}@media(max-width:760px){.persistent-call-bar{top:auto;bottom:max(12px,env(safe-area-inset-bottom));display:grid;grid-template-columns:38px minmax(0,1fr) auto}.persistent-call-bar .mic-state{grid-column:2}.persistent-call-bar button{padding:0 9px}.persistent-call-bar .call-leave{grid-column:3}.call-video-grid{inset:90px 10px 150px;max-height:none;grid-template-columns:1fr}.floating-active-call{bottom:max(90px,calc(env(safe-area-inset-bottom) + 76px))}}`}</style>
  </PersistentCallContext.Provider>;
}
