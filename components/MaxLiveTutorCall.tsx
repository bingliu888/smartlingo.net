"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { maxLiveTutorInstructions } from "../lib/smartlingo-live-tutor-instructions";
import { SMARTLINGO_TUTOR_PORTRAITS,
  preferredTutorVoice, tutorVoiceOptions, validTutorPortrait, validTutorVoice, type SmartLingoTutorPortrait,
  type SmartLingoTutorVoice } from "../lib/smartlingo-live-tutor-personas";
import { translateTutorLines } from "../lib/smartlingo-tutor-translation-client";

type CallState = "idle" | "connecting" | "live" | "ending";
type VoiceEvent = { type?: string; delta?: string; start_ms?: number; end_ms?: number; error?: { message?: string; code?: string } };
type CaptionLine = { id: string; text: string; complete: boolean; supportText?: string };

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function secondsUntil(deadline: number) {
  return Math.max(0, deadline - Math.floor(Date.now() / 1_000));
}

export function MaxLiveTutorCall({ sessionId, language, lang, learningName, supportLanguageName,
  slowSpeed, shortAnswer, showSupport, onCallActive, prepareSession }: {
  sessionId: string | null; prepareSession: () => Promise<string | null>; language: string; lang: string;
  learningName: string; supportLanguageName: string;
  slowSpeed: boolean; shortAnswer: boolean; showSupport: boolean;
  onCallActive: (active: boolean) => void;
}) {
  const zh = lang === "zh" || lang === "zh-tw";
  const [state, setState] = useState<CallState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [voiceRemaining, setVoiceRemaining] = useState(0);
  const [voiceLimit, setVoiceLimit] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState("");
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [portrait, setPortrait] = useState<SmartLingoTutorPortrait>("mei");
  const [voice, setVoice] = useState<SmartLingoTutorVoice>("gleam");
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [loadedSessionId, setLoadedSessionId] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef("");
  const deadlineRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const endingRef = useRef(false);
  const activeTutorItemRef = useRef("");
  const sessionReadyRef = useRef(false);
  const lastTranscriptEndRef = useRef(0);
  const captionTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const transcriptAtBottomRef = useRef(true);
  const swipeStartXRef = useRef<number | null>(null);
  const translationAttemptedRef = useRef<Set<string>>(new Set());
  const learningNativeName = SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === language)?.nativeName || learningName;
  const selectedPortrait = SMARTLINGO_TUTOR_PORTRAITS.find(item => item.id === portrait) || SMARTLINGO_TUTOR_PORTRAITS[0];
  const availableVoices = tutorVoiceOptions(selectedPortrait.id);
  const portraitIndex = SMARTLINGO_TUTOR_PORTRAITS.findIndex(item => item.id === selectedPortrait.id);
  const previousPortrait = SMARTLINGO_TUTOR_PORTRAITS[(portraitIndex - 1 + SMARTLINGO_TUTOR_PORTRAITS.length) % SMARTLINGO_TUTOR_PORTRAITS.length];
  const nextPortrait = SMARTLINGO_TUTOR_PORTRAITS[(portraitIndex + 1) % SMARTLINGO_TUTOR_PORTRAITS.length];
  const preferenceLoaded = loadedSessionId === (sessionId || "preview");

  const sendPreferences = useCallback((channel: RTCDataChannel, welcomeName?: string) => {
    if (channel.readyState !== "open") return;
    const instructions = maxLiveTutorInstructions({ learningLanguage: learningName, learningNativeName,
      supportLanguage: supportLanguageName, slowSpeed, shortAnswer });
    const welcome = welcomeName
      ? ` The learner just pressed Start. Speak now in ${learningName}: briefly say hello, introduce yourself as ${welcomeName}, warmly welcome the learner, and ask one simple question. Use one or two short sentences, then stop and listen. This opening happens once per call.`
      : "";
    channel.send(JSON.stringify({ type: "session.instructions.append", delegation_id: null,
      content: instructions + welcome,
    }));
  }, [learningName, learningNativeName, supportLanguageName, slowSpeed, shortAnswer]);

  useEffect(() => {
    let active = true;
    void fetch("/api/assistant/live/usage", { credentials: "same-origin", cache: "no-store" })
      .then(response => response.json())
      .then((usage: { remainingSeconds?: number; dailyLimitSeconds?: number }) => {
        if (active) { setVoiceRemaining(Math.max(0, usage.remainingSeconds || 0)); setVoiceLimit(usage.dailyLimitSeconds || 0); }
      }).catch(() => { if (active) setError(zh ? "语音额度暂时无法读取。" : "Voice allowance is temporarily unavailable."); });
    return () => { active = false; };
  }, [sessionId, zh]);

  useEffect(() => {
    if (state !== "idle") return;
    let active = true;
    void fetch(`/api/assistant/live/preferences${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`, {
      credentials: "same-origin", cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("Unable to read tutor choices.");
      return response.json() as Promise<{ portrait?: unknown; voice?: unknown }>;
    }).then(value => {
      if (!active) return;
      if (validTutorPortrait(value.portrait)) setPortrait(value.portrait);
      if (validTutorVoice(value.voice)) setVoice(value.voice);
      setLoadedSessionId(sessionId || "preview");
    }).catch(() => {
      if (active) setError(zh ? "暂时无法读取导师形象与声音，请稍后重试。" : "Tutor portrait and voice are temporarily unavailable. Try again later.");
    });
    return () => { active = false; };
  }, [sessionId, state, zh]);

  async function saveTutorChoice(nextPortrait: SmartLingoTutorPortrait, nextVoice: SmartLingoTutorVoice) {
    if (state !== "idle" || preferenceBusy || !preferenceLoaded) return;
    if (!sessionId) { setPortrait(nextPortrait); setVoice(nextVoice); return; }
    setPreferenceBusy(true); setError("");
    try {
      const response = await fetch("/api/assistant/live/preferences", {
        method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, portrait: nextPortrait, voice: nextVoice }),
      });
      const result = await response.json() as { portrait?: unknown; voice?: unknown; error?: string };
      if (!response.ok || !validTutorPortrait(result.portrait) || !validTutorVoice(result.voice))
        throw new Error(result.error || "Tutor choice could not be saved.");
      setPortrait(result.portrait); setVoice(result.voice);
    } catch {
      setError(zh ? "导师选择未保存，请重试。" : "Tutor choice was not saved. Try again.");
    } finally { setPreferenceBusy(false); }
  }

  function stepPortrait(direction: -1 | 1) {
    if (state !== "idle" || preferenceBusy || !preferenceLoaded) return;
    const nextIndex = (portraitIndex + direction + SMARTLINGO_TUTOR_PORTRAITS.length) % SMARTLINGO_TUTOR_PORTRAITS.length;
    const nextPortrait = SMARTLINGO_TUTOR_PORTRAITS[nextIndex].id;
    void saveTutorChoice(nextPortrait, preferredTutorVoice(nextPortrait, voice));
  }

  useEffect(() => {
    if (state === "live" && sessionReadyRef.current && channelRef.current) sendPreferences(channelRef.current);
  }, [state, sendPreferences]);

  useEffect(() => {
    const container = transcriptRef.current;
    if (container && transcriptAtBottomRef.current) container.scrollTop = container.scrollHeight;
  }, [captions, showTranscript]);

  useEffect(() => {
    if (!showSupport) { translationAttemptedRef.current.clear(); return; }
    if (language === lang) return;
    const batch = captions.filter(line => line.complete && line.text && !line.supportText
      && !translationAttemptedRef.current.has(line.id)).slice(0, 8);
    if (!batch.length) return;
    batch.forEach(line => translationAttemptedRef.current.add(line.id));
    void translateTutorLines(batch.map(line => line.text.slice(0, 600)), language, lang)
      .then(translations => setCaptions(current => current.map(line => {
        const index = batch.findIndex(item => item.id === line.id && item.text === line.text);
        return index < 0 ? line : { ...line, supportText: translations[index] };
      })))
      .catch(() => setError(zh ? "当前语言译文暂时不可用。" : "Translation is temporarily unavailable."));
  }, [captions, showSupport, language, lang, zh]);

  function cleanupMedia() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    sessionReadyRef.current = false;
    if (captionTimerRef.current !== null) window.clearTimeout(captionTimerRef.current);
    captionTimerRef.current = null;
    channelRef.current?.close(); channelRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    micRef.current?.getTracks().forEach(track => track.stop()); micRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
  }

  async function endCall(reason?: string) {
    if (endingRef.current) return;
    endingRef.current = true;
    setState("ending");
    const id = callIdRef.current;
    callIdRef.current = "";
    setSpeaking(false);
    if (id) {
      try {
        if (channelRef.current?.readyState === "open")
          channelRef.current.send(JSON.stringify({ type: "session.close" }));
        const response = await fetch("/api/assistant/live", { method: "DELETE", credentials: "same-origin",
          headers: { "x-live-call-id": id }, keepalive: true });
        const result = await response.json() as { remainingSeconds?: number; error?: string };
        if (!response.ok) throw new Error(result.error || "Call close failed.");
        if (typeof result.remainingSeconds === "number") setVoiceRemaining(result.remainingSeconds);
      } catch {
        setError(zh ? "通话已在本机停止；服务器会自动挂断并核对时长。" : "The call stopped locally. The server will hang up and reconcile its time.");
      }
    }
    cleanupMedia();
    if (reason) setError(reason);
    setState("idle"); onCallActive(false); endingRef.current = false;
  }

  async function startCall() {
    if (state !== "idle" || voiceRemaining <= 0 || !preferenceLoaded || preferenceBusy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setError(zh ? "此浏览器不支持实时语音，请换用支持麦克风的浏览器。" : "Live voice is unavailable here. Try a browser with microphone support.");
      return;
    }
    setError(""); setCaptions([]); setMuted(false); setSpeaking(false); setSoundBlocked(false);
    activeTutorItemRef.current = ""; transcriptAtBottomRef.current = true;
    translationAttemptedRef.current.clear();
    setState("connecting"); onCallActive(true); endingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micRef.current = stream;
      const activeSessionId = sessionId || await prepareSession();
      if (!activeSessionId) throw new Error(zh ? "无法准备导师会话，请重试。" : "Could not prepare the tutor session. Try again.");
      if (!sessionId) {
        const choice = await fetch("/api/assistant/live/preferences", {
          method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId, portrait, voice: preferredTutorVoice(portrait, voice) }),
        });
        if (!choice.ok) throw new Error(zh ? "导师选择未保存，请重试。" : "Tutor choice could not be saved. Try again.");
        setLoadedSessionId(activeSessionId);
      }
      const peer = new RTCPeerConnection(); peerRef.current = peer;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events"); channelRef.current = channel;
      channel.addEventListener("message", event => {
        let item: VoiceEvent;
        try { item = JSON.parse(String(event.data)) as VoiceEvent; } catch { return; }
        if (item.type === "session.started") {
          sessionReadyRef.current = true;
          sendPreferences(channel, selectedPortrait.nameEn);
        } else if (item.type === "session.output_transcript.delta" && typeof item.delta === "string") {
          const gap = typeof item.start_ms === "number" ? item.start_ms - lastTranscriptEndRef.current : 0;
          if (!activeTutorItemRef.current || gap > 1_200) activeTutorItemRef.current = crypto.randomUUID();
          const id = activeTutorItemRef.current;
          if (typeof item.end_ms === "number") lastTranscriptEndRef.current = item.end_ms;
          activeTutorItemRef.current = id;
          setCaptions(previous => {
            const index = previous.findIndex(line => line.id === id);
            if (index < 0) return [...previous, { id, text: item.delta!.slice(0, 1_200), complete: false }].slice(-30);
            return previous.map((line, at) => at === index ? { ...line, text: (line.text + item.delta).slice(0, 1_200) } : line);
          });
          setSpeaking(true);
          if (captionTimerRef.current !== null) window.clearTimeout(captionTimerRef.current);
          captionTimerRef.current = window.setTimeout(() => {
            setCaptions(previous => previous.map(line => line.id === id ? { ...line, complete: true } : line));
            activeTutorItemRef.current = "";
            setSpeaking(false);
          }, 1_500);
        } else if (item.type === "session.closed") {
          void endCall();
        } else if (item.type === "error") {
          const code = typeof item.error?.code === "string" && /^[a-z0-9_.-]{1,60}$/i.test(item.error.code)
            ? ` (${item.error.code})` : "";
          setError((zh ? "实时导师遇到问题，请结束通话后重试。" : "The live tutor encountered an error. End the call and retry.") + code);
        }
      });
      peer.addEventListener("track", event => {
        const remote = event.streams[0] || new MediaStream([event.track]);
        if (audioRef.current) {
          audioRef.current.srcObject = remote;
          void audioRef.current.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
        }
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
        headers: { "content-type": "application/sdp", "x-tutor-session-id": activeSessionId, "x-learning-language": language,
          "x-tutor-slow-speed": slowSpeed ? "1" : "0", "x-tutor-short-answer": shortAnswer ? "1" : "0" },
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
      setSeconds(secondsUntil(deadline));
      setState("live");
      timerRef.current = window.setInterval(async () => {
        const left = secondsUntil(deadlineRef.current);
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
    <div className="max-live-tutor-heading"><div><small>MAX · LIVE</small><h1>{zh ? "和虚拟人导师实时对话" : "Talk live with your virtual tutor"}</h1></div>
      <span className="max-live-tutor-clock" role="status">{state === "live" ? formatTime(seconds) : formatTime(voiceRemaining)}</span></div>
    <div className={`max-live-tutor-stage${speaking ? " speaking" : ""}`}>
      <div className="max-live-tutor-filmstrip">
        <button type="button" className="max-live-tutor-preview previous" onClick={() => stepPortrait(-1)}
          disabled={state !== "idle" || preferenceBusy || !preferenceLoaded}
          aria-label={zh ? `选择${previousPortrait.nameZh}导师` : `Choose tutor ${previousPortrait.nameEn}`}>
          <Image src={previousPortrait.image} width={previousPortrait.width} height={previousPortrait.height} unoptimized alt=""/>
        </button>
        <Image className="max-live-tutor-photo" src={selectedPortrait.image}
          width={selectedPortrait.width} height={selectedPortrait.height} unoptimized
          alt={zh ? `AI 生成的${selectedPortrait.nameZh}导师肖像` : `AI-generated portrait of tutor ${selectedPortrait.nameEn}`}
          onTouchStart={event => { swipeStartXRef.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={event => {
            const start = swipeStartXRef.current;
            swipeStartXRef.current = null;
            const end = event.changedTouches[0]?.clientX;
            if (start === null || end === undefined || Math.abs(end - start) < 50) return;
            stepPortrait(end < start ? 1 : -1);
          }} onTouchCancel={() => { swipeStartXRef.current = null; }}/>
        <button type="button" className="max-live-tutor-preview next" onClick={() => stepPortrait(1)}
          disabled={state !== "idle" || preferenceBusy || !preferenceLoaded}
          aria-label={zh ? `选择${nextPortrait.nameZh}导师` : `Choose tutor ${nextPortrait.nameEn}`}>
          <Image src={nextPortrait.image} width={nextPortrait.width} height={nextPortrait.height} unoptimized alt=""/>
        </button>
      </div>
      <button type="button" className="max-live-tutor-portrait-step previous" onClick={() => stepPortrait(-1)}
        disabled={state !== "idle" || preferenceBusy || !preferenceLoaded}
        aria-label={zh ? "上一位导师" : "Previous tutor"}>‹</button>
      <button type="button" className="max-live-tutor-portrait-step next" onClick={() => stepPortrait(1)}
        disabled={state !== "idle" || preferenceBusy || !preferenceLoaded}
        aria-label={zh ? "下一位导师" : "Next tutor"}>›</button>
      <p className="max-live-tutor-caption" aria-live="polite" dir="auto">{state === "live"
        ? (showTranscript ? (zh ? "直接说话；下方可滚动查看导师文字。" : "Speak naturally; scroll tutor text below.") : (zh ? "直接说话，导师会听你说并回应。" : "Speak naturally. Your tutor listens and responds."))
        : (zh ? "点击开始，导师会先打招呼，再听你说话。" : "Press Start. Your tutor will greet you, then listen.")}</p>
      <audio ref={audioRef} autoPlay playsInline aria-label={zh ? "虚拟导师语音" : "Virtual tutor audio"}/></div>
    <div className="max-live-tutor-actions">
      <button type="button" className="max-live-tutor-chat-toggle" onClick={() => setShowTranscript(value => !value)}
        aria-label={zh ? (showTranscript ? "隐藏导师字幕" : "显示导师字幕") : (showTranscript ? "Hide tutor captions" : "Show tutor captions")}
        aria-controls="max-live-tutor-transcript" aria-expanded={showTranscript} aria-pressed={showTranscript}
        title={zh ? (showTranscript ? "隐藏导师字幕" : "显示导师字幕") : (showTranscript ? "Hide tutor captions" : "Show tutor captions")}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M10 10a2 2 0 1 0 0 4M17 10a2 2 0 1 0 0 4"/></svg>
      </button>
      <div className="max-live-tutor-call-controls">
      {state === "idle" ? <button type="button" onClick={startCall} disabled={voiceRemaining <= 0 || !preferenceLoaded || preferenceBusy}>{zh ? "开启实时语音" : "Start live voice"}</button>
        : state === "connecting" ? <button type="button" disabled>{zh ? "正在连接…" : "Connecting…"}</button>
        : <><button type="button" onClick={() => { micRef.current?.getAudioTracks().forEach(track => { track.enabled = muted; }); setMuted(!muted); }}
          aria-pressed={muted}>{muted ? (zh ? "打开麦克风" : "Unmute") : (zh ? "静音" : "Mute")}</button>
          <button type="button" className="max-live-tutor-end" onClick={() => void endCall()} disabled={state === "ending"}>{zh ? "结束通话" : "End call"}</button></>}
      </div>
      <label className="max-live-tutor-voice-choice" htmlFor="max-tutor-voice">
        <span className="max-live-tutor-sr-only">{zh ? "导师音色" : "Tutor voice"}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9v6M7 5v14M11 10v4M15 3v18M19 8v8M23 11v2"/></svg>
        <select id="max-tutor-voice" value={preferredTutorVoice(portrait, voice)}
          aria-label={zh ? "选择导师音色" : "Choose tutor voice"}
          title={zh ? "选择导师音色" : "Choose tutor voice"}
          disabled={state !== "idle" || preferenceBusy || !preferenceLoaded} onChange={event => {
          if (validTutorVoice(event.target.value)) void saveTutorChoice(portrait, event.target.value);
        }}>{availableVoices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
    </div>
    {soundBlocked ? <button type="button" className="max-live-tutor-unblock" onClick={() => void audioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => undefined)}>{zh ? "点此播放声音" : "Tap to hear audio"}</button> : null}
    <div id="max-live-tutor-transcript" ref={transcriptRef} className="max-live-tutor-transcript" role="region" tabIndex={showTranscript ? 0 : -1} hidden={!showTranscript} aria-live="off"
      aria-label={zh ? "实时对话文字" : "Live conversation transcript"} onScroll={event => {
        const element = event.currentTarget;
        transcriptAtBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
      }}>
      {captions.length ? captions.map(line => <p key={line.id} className="tutor">
        <strong>{zh ? "AI 导师" : "AI tutor"}</strong>
        <span dir="auto">{line.text}</span>
        {showSupport && line.supportText ? <small lang={lang} dir="auto">{line.supportText}</small> : null}
      </p>) : <p className="max-live-tutor-transcript-empty">{zh ? "开始对话后，导师说的话会显示在这里。" : "Your tutor's words will appear here when the conversation starts."}</p>}
    </div>
    <p className="max-live-tutor-note">{zh ? `这是 AI 生成的人像照片，不是真人视频或口型同步。仅传送麦克风声音；不录制或保存原始音频。今日语音剩余 ${formatTime(voiceRemaining)} / ${formatTime(voiceLimit)}。` : `This is an AI-generated still portrait, not human video or lip-sync. Only microphone audio is sent; raw audio is not recorded or stored. Voice left today: ${formatTime(voiceRemaining)} / ${formatTime(voiceLimit)}.`}</p>
    {error ? <p className="role-tutor-error" role="alert">{error}</p> : null}
  </section>;
}
