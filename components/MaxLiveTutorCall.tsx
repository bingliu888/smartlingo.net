"use client";

import { useEffect, useRef, useState } from "react";

type CallState = "idle" | "connecting" | "live" | "ending";
type VoiceEvent = { type?: string; delta?: string; transcript?: string; error?: { message?: string } };

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function drawVirtualTutor(canvas: HTMLCanvasElement, level: number, speaking: boolean, time: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.width, height = canvas.height;
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#113f3b"); background.addColorStop(1, "#087e69");
  context.fillStyle = background; context.fillRect(0, 0, width, height);
  context.strokeStyle = "#7fe4bd55"; context.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    context.beginPath(); context.arc(width / 2, height * .6, 130 + i * 60 + Math.sin(time / 1600 + i) * 7, 0, Math.PI * 2); context.stroke();
  }
  context.fillStyle = "#d8f5e7"; context.beginPath(); context.ellipse(width / 2, height * .99, 167, 132, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#132b30"; context.beginPath(); context.ellipse(width / 2, height * .42, 107, 134, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#e8b995"; context.beginPath(); context.ellipse(width / 2, height * .43, 83, 109, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#132b30";
  context.beginPath(); context.ellipse(width / 2 - 28, height * .4, 6, 7, 0, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.ellipse(width / 2 + 28, height * .4, 6, 7, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "#934d4b"; context.lineWidth = 4;
  context.beginPath(); context.moveTo(width / 2, height * .44); context.lineTo(width / 2 - 3, height * .52); context.stroke();
  const mouth = speaking ? Math.max(4, Math.min(23, 5 + level * 80)) : 3;
  context.fillStyle = "#813c43"; context.beginPath(); context.ellipse(width / 2, height * .61, 24, mouth, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#b8f3d8"; context.beginPath(); context.arc(width - 36, 36, 8, 0, Math.PI * 2); context.fill();
}

export function MaxLiveTutorCall({ sessionId, language, lang, remainingSeconds, onRemaining, onCallActive }: {
  sessionId: string; language: string; lang: string; remainingSeconds: number | null;
  onRemaining: (seconds: number) => void; onCallActive: (active: boolean) => void;
}) {
  const zh = lang === "zh" || lang === "zh-tw";
  const [state, setState] = useState<CallState>("idle");
  const [seconds, setSeconds] = useState(Math.max(0, remainingSeconds || 0));
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [soundBlocked, setSoundBlocked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef("");
  const deadlineRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const endingRef = useRef(false);

  function cleanupMedia() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    micRef.current?.getTracks().forEach(track => track.stop()); micRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => undefined);
    audioContextRef.current = null; analyserRef.current = null;
  }

  async function endCall(reason?: string) {
    if (endingRef.current) return;
    endingRef.current = true;
    setState("ending");
    const id = callIdRef.current;
    callIdRef.current = "";
    cleanupMedia();
    setSpeaking(false);
    if (id) {
      try {
        const response = await fetch("/api/assistant/live", { method: "DELETE", credentials: "same-origin",
          headers: { "x-live-call-id": id }, keepalive: true });
        const result = await response.json() as { remainingSeconds?: number; error?: string };
        if (!response.ok) throw new Error(result.error || "Call close failed.");
        if (typeof result.remainingSeconds === "number") onRemaining(result.remainingSeconds);
      } catch {
        setError(zh ? "通话已在本机停止；服务器会自动挂断并核对时长。" : "The call stopped locally. The server will hang up and reconcile its time.");
      }
    }
    if (reason) setError(reason);
    setState("idle"); onCallActive(false); endingRef.current = false;
  }

  function animate() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const analyser = analyserRef.current;
    let level = 0;
    if (analyser) {
      const values = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(values);
      for (const value of values) level += Math.abs(value - 128);
      level /= values.length * 128;
    }
    drawVirtualTutor(canvas, level, speaking || level > .03, performance.now());
    frameRef.current = window.requestAnimationFrame(animate);
  }

  async function startCall() {
    if (state !== "idle" || !sessionId || !remainingSeconds || remainingSeconds <= 0) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setError(zh ? "此浏览器不支持实时语音，请继续使用文字导师。" : "Live voice is unavailable in this browser. Continue with the text tutor.");
      return;
    }
    setError(""); setCaption(""); setState("connecting"); onCallActive(true); endingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micRef.current = stream;
      const peer = new RTCPeerConnection(); peerRef.current = peer;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events");
      channel.addEventListener("message", event => {
        let item: VoiceEvent;
        try { item = JSON.parse(String(event.data)) as VoiceEvent; } catch { return; }
        if (item.type === "response.output_audio_transcript.delta" && typeof item.delta === "string") {
          setCaption(previous => (previous + item.delta).slice(-700)); setSpeaking(true);
        } else if (item.type === "response.output_audio_transcript.done") {
          setSpeaking(false);
        } else if (item.type === "conversation.item.input_audio_transcription.completed" && typeof item.transcript === "string") {
          setCaption(item.transcript.slice(-700));
        } else if (item.type === "input_audio_buffer.speech_started") {
          setSpeaking(false);
        } else if (item.type === "error") {
          setError(zh ? "实时导师遇到问题，请结束通话后重试。" : "The live tutor encountered an error. End the call and retry.");
        }
      });
      peer.addEventListener("track", event => {
        const remote = event.streams[0] || new MediaStream([event.track]);
        if (audioRef.current) {
          audioRef.current.srcObject = remote;
          void audioRef.current.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
        }
        try {
          const context = new AudioContext(); audioContextRef.current = context;
          const source = context.createMediaStreamSource(remote);
          const analyser = context.createAnalyser(); analyser.fftSize = 256;
          const silent = context.createGain(); silent.gain.value = 0;
          source.connect(analyser); analyser.connect(silent); silent.connect(context.destination);
          analyserRef.current = analyser; void context.resume().catch(() => undefined);
        } catch { /* Captions and audio still work without visual amplitude. */ }
      });
      peer.addEventListener("connectionstatechange", () => {
        if ((peer.connectionState === "failed" || peer.connectionState === "disconnected") && callIdRef.current)
          void endCall(zh ? "实时连接已中断，请重试。" : "The live connection was interrupted. Try again.");
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (peer.iceGatheringState !== "complete") await new Promise<void>(resolve => {
        const finish = () => { window.clearTimeout(timeout); peer.removeEventListener("icegatheringstatechange", check); resolve(); };
        const check = () => { if (peer.iceGatheringState === "complete") finish(); };
        const timeout = window.setTimeout(finish, 7_000);
        peer.addEventListener("icegatheringstatechange", check);
      });
      const response = await fetch("/api/assistant/live", { method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/sdp", "x-tutor-session-id": sessionId, "x-learning-language": language },
        body: peer.localDescription?.sdp || offer.sdp });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || (zh ? "无法建立实时通话。" : "Could not start the live call."));
      }
      const callId = response.headers.get("x-live-call-id") || "";
      const deadline = Number(response.headers.get("x-live-deadline"));
      if (!callId || !Number.isFinite(deadline)) throw new Error("Incomplete live call response.");
      callIdRef.current = callId; deadlineRef.current = deadline;
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
      setSeconds(Math.max(0, deadline - Math.floor(Date.now() / 1_000)));
      setState("live"); animate();
      timerRef.current = window.setInterval(async () => {
        const left = Math.max(0, deadlineRef.current - Math.floor(Date.now() / 1_000));
        setSeconds(left);
        if (!left) { void endCall(); return; }
        const currentId = callIdRef.current;
        if (!currentId) return;
        try {
          const heartbeat = await fetch("/api/assistant/live", { method: "PATCH", credentials: "same-origin",
            headers: { "x-live-call-id": currentId } });
          if (!heartbeat.ok) void endCall(zh ? "会员权限或通话时间已结束。" : "Max access or call time has ended.");
        } catch { /* The server's minute cleanup closes abandoned calls. */ }
      }, 10_000);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      if (callIdRef.current) await endCall(message);
      else { cleanupMedia(); setState("idle"); onCallActive(false); setError(message); }
    }
  }

  useEffect(() => {
    if (canvasRef.current) drawVirtualTutor(canvasRef.current, 0, false, 0);
    const onHide = () => {
      if (callIdRef.current) void fetch("/api/assistant/live", { method: "DELETE", credentials: "same-origin",
        headers: { "x-live-call-id": callIdRef.current }, keepalive: true }).catch(() => undefined);
      cleanupMedia();
      onCallActive(false);
    };
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); onHide(); };
  }, [onCallActive]);

  return <section className="max-live-tutor" aria-label={zh ? "实时虚拟人导师" : "Live virtual tutor"}>
    <div className="max-live-tutor-heading"><div><small>MAX · LIVE</small><h3>{zh ? "和虚拟人导师实时对话" : "Talk live with your virtual tutor"}</h3></div>
      <span className="max-live-tutor-clock" role="status">{state === "live" ? formatTime(seconds) : formatTime(Math.max(0, remainingSeconds || 0))}</span></div>
    <div className="max-live-tutor-stage"><canvas ref={canvasRef} width={640} height={360} role="img"
      aria-label={zh ? "随导师语音同步变化的虚拟人物画面" : "Animated virtual tutor reacting to speech"}/>
      <p className="max-live-tutor-caption" aria-live="polite" dir="auto">{caption || (zh ? "开始后直接说话，导师会听你说并回应。" : "Start, then speak naturally. Your tutor listens and responds.")}</p>
      <audio ref={audioRef} autoPlay playsInline aria-label={zh ? "虚拟导师语音" : "Virtual tutor audio"}/></div>
    <div className="max-live-tutor-actions">
      {state === "idle" ? <button type="button" onClick={startCall} disabled={!remainingSeconds || remainingSeconds <= 0}>{zh ? "开启实时语音与虚拟人物" : "Start live voice and avatar"}</button>
        : state === "connecting" ? <button type="button" disabled>{zh ? "正在连接…" : "Connecting…"}</button>
        : <><button type="button" onClick={() => { micRef.current?.getAudioTracks().forEach(track => { track.enabled = muted; }); setMuted(!muted); }}
          aria-pressed={muted}>{muted ? (zh ? "打开麦克风" : "Unmute") : (zh ? "静音" : "Mute")}</button>
          <button type="button" className="max-live-tutor-end" onClick={() => void endCall()} disabled={state === "ending"}>{zh ? "结束通话" : "End call"}</button></>}
      {soundBlocked ? <button type="button" onClick={() => void audioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => undefined)}>{zh ? "点此播放声音" : "Tap to hear audio"}</button> : null}
    </div>
    <p className="max-live-tutor-note">{zh ? "这是 AI 虚拟人物动画，不是真人摄像视频。仅传送麦克风声音；不录制或保存原始音频。试用每日 10 分钟，付费旗舰版每日 30 分钟；文字导师仍可使用。" : "This is an animated AI character, not a human camera feed. Only microphone audio is sent; raw audio is not recorded or stored. Trial: 10 minutes/day; paid Max: 30 minutes/day. The text tutor remains available."}</p>
    {error ? <p className="role-tutor-error" role="alert">{error}</p> : null}
  </section>;
}
