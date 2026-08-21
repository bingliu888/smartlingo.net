"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { scoreSmartCardPronunciation } from "../lib/smartlingo-smartcards";
import { useRepeatAfterMePreference } from "./useRepeatAfterMePreference";

type Slide = {
  id: string;
  form: string;
  pronunciation: string;
  meaningZh: string;
  meaningEn: string;
  stageZh: string;
  stageEn: string;
};

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type MicState = "idle" | "requesting" | "listening" | "analyzing" | "denied" | "error" | "unsupported";

export function EverydaySpeakingPlayer({ lang, language, languageName, speechLocale, direction, scene, slides }: {
  lang: "zh" | "en";
  language: string;
  languageName: string;
  speechLocale: string;
  direction: "ltr" | "rtl";
  scene: { id: string; nameZh: string; nameEn: string; goalZh: string; goalEn: string; image: string };
  slides: readonly Slide[];
}) {
  const zh = lang === "zh";
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [complete, setComplete] = useState(false);
  const [listening, setListening] = useState(false);
  const [micState, setMicState] = useState<MicState>("idle");
  const [message, setMessage] = useState("");
  const [bestScore, setBestScore] = useState(0);
  const [demoNonce, setDemoNonce] = useState(0);
  const [repeatAfterMe, setRepeatAfterMe] = useRepeatAfterMePreference();
  const timerRef = useRef<number | null>(null);
  const speechCleanupRef = useRef<() => void>(() => undefined);
  const attemptsRef = useRef(0);
  const microphoneApproved = useRef(false);
  const listenRef = useRef<() => void>(() => undefined);
  const slide = slides[index];

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const move = useCallback((next: number) => {
    clearTimer();
    window.speechSynthesis?.cancel();
    speechCleanupRef.current();
    setListening(false);
    setMicState("idle");
    attemptsRef.current = 0;
    setMessage("");
    if (next >= slides.length) { setComplete(true); return; }
    setComplete(false);
    setIndex(Math.max(0, next));
  }, [clearTimer, slides.length]);

  useEffect(() => {
    if (!started || paused || complete || !slide) return;
    clearTimer();
    const speech = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (!speech) {
      timerRef.current = window.setTimeout(() => repeatAfterMe ? listenRef.current() : move(index + 1), repeatAfterMe ? 300 : 8000);
      return clearTimer;
    }
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(slide.form);
    utterance.lang = speechLocale;
    utterance.rate = .76;
    const schedule = () => {
      setMessage(repeatAfterMe
        ? (zh ? "轮到您：请跟我说，AI 会自动评分。" : "Your turn: repeat after me for an automatic score.")
        : (zh ? "“跟我读”已关闭；本页会继续自动播放。" : "Repeat after me is off; autoplay will continue."));
      timerRef.current = window.setTimeout(() => repeatAfterMe ? listenRef.current() : move(index + 1), repeatAfterMe ? 450 : 8000);
    };
    utterance.onend = schedule;
    utterance.onerror = schedule;
    speech.speak(utterance);
    return () => { clearTimer(); speech.cancel(); };
  }, [clearTimer, complete, demoNonce, index, move, paused, repeatAfterMe, slide, speechLocale, started, zh]);

  useEffect(() => () => {
    clearTimer();
    speechCleanupRef.current();
    window.speechSynthesis?.cancel();
  }, [clearTimer]);

  function begin() {
    setStarted(true);
    setPaused(false);
    setComplete(false);
    setMessage("");
  }

  function togglePause() {
    clearTimer();
    window.speechSynthesis?.cancel();
    speechCleanupRef.current();
    setListening(false);
    setMicState("idle");
    setPaused(value => !value);
  }

  async function listen() {
    if (listening || !slide) return;
    clearTimer();
    window.speechSynthesis?.cancel();
    speechCleanupRef.current();
    setMicState("requesting");
    setMessage(zh ? "正在准备麦克风……" : "Preparing the microphone…");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState("unsupported");
      setMessage(zh ? "此浏览器暂不支持麦克风评分；您仍可关闭“跟我读”继续自动播放。" : "Microphone scoring is unavailable. Turn Repeat off to continue autoplay.");
      return;
    }
    let stream: MediaStream;
    try {
      if (!microphoneApproved.current && navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (permission.state === "granted") microphoneApproved.current = true;
          else if (permission.state === "denied") throw new DOMException("Microphone access denied", "NotAllowedError");
        } catch (error) {
          if (error instanceof DOMException && error.name === "NotAllowedError") throw error;
        }
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneApproved.current = true;
    } catch (error) {
      setListening(false);
      setMicState(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "denied" : "error");
      setMessage(zh ? "麦克风没有开启。请在浏览器的网站设置中允许麦克风，然后点这里重试。" : "The microphone is not available. Allow it in site settings, then tap here to retry.");
      return;
    }
    const browser = window as typeof window & { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    let recognition: RecognitionLike | null = null;
    let recorder: MediaRecorder | null = null;
    let watchdog = 0;
    let settled = false;
    const chunks: Blob[] = [];
    const stopTracks = () => stream.getTracks().forEach(track => track.stop());
    const dispose = () => {
      window.clearTimeout(watchdog);
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try { recognition.abort?.(); } catch { try { recognition.stop(); } catch { /* already stopped */ } }
      }
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      stopTracks();
      speechCleanupRef.current = () => undefined;
    };
    speechCleanupRef.current = dispose;
    const evaluate = (transcript: string, reviewed?: { score?: number; passed?: boolean }) => {
      if (!transcript) return;
      const local = scoreSmartCardPronunciation(slide.form, transcript, slide.pronunciation, language);
      const result = typeof reviewed?.score === "number" ? { score: reviewed.score, passed: Boolean(reviewed.passed) } : local;
      setListening(false);
      setMicState("idle");
      setBestScore(current => Math.max(current, result.score));
      attemptsRef.current += 1;
      setMessage(result.passed
        ? (zh ? `听到“${transcript}” · ${result.score} 分，太棒了！` : `Heard “${transcript}” · ${result.score}. Great job!`)
        : attemptsRef.current < 3
          ? (zh ? `听到“${transcript}” · ${result.score} 分。AI 再示范一次，请慢慢说。` : `Heard “${transcript}” · ${result.score}. The AI will model it again; speak slowly.`)
          : (zh ? `本句练习完成，最高 ${Math.max(bestScore, result.score)} 分；继续下一句。` : `Practice complete. Best ${Math.max(bestScore, result.score)}; moving on.`));
      timerRef.current = window.setTimeout(() => result.passed || attemptsRef.current >= 3 ? move(index + 1) : setDemoNonce(value => value + 1), result.passed ? 1400 : 1700);
    };
    const uploadRecording = async (audio: Blob) => {
      setListening(false);
      setMicState("analyzing");
      setMessage(zh ? "正在分析发音……" : "Analyzing pronunciation…");
      const form = new FormData();
      form.set("language", language);
      form.set("scene", scene.id);
      form.set("slideId", slide.id);
      form.set("audio", new File([audio], `everyday-${Date.now()}`, { type: audio.type || "audio/webm" }));
      try {
        const response = await fetch("/api/everyday-speaking/speech", { method: "POST", body: form });
        const result = await response.json().catch(() => ({})) as { transcript?: string; score?: number; passed?: boolean };
        if (!response.ok || !result.transcript) throw new Error("transcription failed");
        evaluate(result.transcript, result);
      } catch {
        setMicState("error");
        setMessage(zh ? "暂时无法分析发音。点这里重新听 AI 并跟读。" : "Pronunciation analysis is temporarily unavailable. Tap here to hear the AI and retry.");
      }
    };
    if (typeof MediaRecorder !== "undefined") {
      try {
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
          stopTracks();
          if (settled) return;
          settled = true;
          speechCleanupRef.current = () => undefined;
          const audio = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
          if (audio.size < 256) {
            setListening(false);
            setMicState("error");
            setMessage(zh ? "没有听到声音。点这里重新听 AI 并跟读。" : "I could not hear anything. Tap here to hear the AI and retry.");
            return;
          }
          void uploadRecording(audio);
        };
        recorder.start();
      } catch { recorder = null; }
    }
    if (Recognition) {
      recognition = new Recognition();
      recognition.lang = speechLocale;
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 5;
      recognition.onresult = event => {
        if (settled) return;
        const transcript = String(event.results?.[0]?.[0]?.transcript || "");
        if (!transcript) return;
        settled = true;
        dispose();
        evaluate(transcript);
      };
      recognition.onerror = event => {
        if (event.error === "not-allowed") {
          settled = true;
          dispose();
          setListening(false);
          setMicState("denied");
          setMessage(zh ? "麦克风未获允许。请在网站设置中允许麦克风，然后点这里重试。" : "Microphone access is blocked. Allow it in site settings, then tap here to retry.");
        }
      };
      recognition.onend = () => { recognition = null; };
      try { recognition.start(); } catch { recognition = null; }
    }
    setListening(true);
    setMicState("listening");
    setMessage(zh ? "正在听您说……" : "Listening to you…");
    watchdog = window.setTimeout(() => {
      if (settled) return;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      else {
        settled = true;
        dispose();
        setListening(false);
        setMicState("error");
        setMessage(zh ? "没有听清。点这里重新听 AI 并跟读。" : "I could not hear clearly. Tap here to hear the AI and retry.");
      }
    }, 5000);
  }
  useEffect(() => {
    listenRef.current = () => { void listen(); };
  });

  function replay() {
    clearTimer();
    speechCleanupRef.current();
    window.speechSynthesis?.cancel();
    setComplete(false);
    setIndex(0);
    setStarted(true);
    setPaused(false);
    setMessage("");
    setBestScore(0);
    setMicState("idle");
    attemptsRef.current = 0;
  }

  return <section className="everyday-player" data-layout-fill="everyday-speaking-player">
    <header className="everyday-player-heading">
      <div><p>{languageName} · {zh ? "生活口语" : "Everyday speaking"}</p><h1>{zh ? scene.nameZh : scene.nameEn}</h1><span>{zh ? scene.goalZh : scene.goalEn}</span></div>
      <aside><strong>{bestScore}</strong><span>{zh ? "本轮最高跟读分" : "Best speaking score"}</span></aside>
    </header>
    <div className="everyday-stage" dir={direction}>
      <img src={scene.image} alt={zh ? `${scene.nameZh}生活口语场景` : `${scene.nameEn} everyday speaking scene`}/>
      <div className="everyday-shade"/>
      <div className="everyday-progress"><span style={{ width: `${(index + 1) * 100 / slides.length}%` }}/></div>
      <div className="everyday-copy">
        <p>{index + 1} / {slides.length} · {zh ? slide.stageZh : slide.stageEn}</p>
        <small>{zh ? "请跟我说" : "REPEAT AFTER ME"}</small>
        <h2>{slide.form}</h2>
        <b>{slide.pronunciation}</b>
        <span>{zh ? slide.meaningZh : slide.meaningEn}</span>
        <em aria-live="polite">{message}</em>
      </div>
      {!started ? <button className="everyday-start" type="button" onClick={begin}><span>▶</span><strong>{zh ? "开始自动课程" : "Start auto lesson"}</strong><small>{zh ? "AI 示范 · 您跟读 · 12 张幻灯片" : "AI speaks · you repeat · 12 slides"}</small></button> : null}
      {complete ? <div className="everyday-complete"><span>✦</span><h2>{zh ? "完成一个生活口语场景！" : "Everyday speaking scene complete!"}</h2><p>{zh ? "再玩一次巩固短句，或选择另一个真实生活场景。" : "Play again to reinforce the phrases, or choose another real-life scene."}</p><nav><button onClick={replay}>{zh ? "再玩一次" : "Play again"}</button><Link href={`/${lang}/play/everyday?language=${language}`}>{zh ? "选择其他场景" : "Choose another scene"}</Link></nav></div> : null}
    </div>
    <div className="everyday-controls" aria-label={zh ? "幻灯片控制" : "Slide controls"}>
      <button onClick={() => move(0)} disabled={index === 0} aria-label={zh ? "第一张" : "First slide"}>≪</button>
      <button onClick={() => move(index - 1)} disabled={index === 0} aria-label={zh ? "上一张" : "Previous slide"}>‹</button>
      <button className={`everyday-repeat-toggle${repeatAfterMe ? " on" : ""}`} type="button" aria-pressed={repeatAfterMe} onClick={() => setRepeatAfterMe(!repeatAfterMe)}>{zh ? `跟我读：${repeatAfterMe ? "开" : "关"}` : `Repeat: ${repeatAfterMe ? "On" : "Off"}`}</button>
      <button onClick={() => move(index + 1)} disabled={complete} aria-label={zh ? "下一张" : "Next slide"}>›</button>
      <button onClick={() => move(slides.length - 1)} disabled={index === slides.length - 1} aria-label={zh ? "最后一张" : "Last slide"}>≫</button>
      <button className="everyday-pause" onClick={togglePause} disabled={!started || complete}>{paused ? (zh ? "▶ 继续" : "▶ Play") : (zh ? "Ⅱ 暂停" : "Ⅱ Pause")}</button>
      <Link className="everyday-quit" href={`/${lang}/play/everyday?language=${language}`}>{zh ? "退出" : "Quit"}</Link>
    </div>
    {started && !complete && (micState === "denied" || micState === "error" || micState === "unsupported") ? <button className="everyday-speech-retry" type="button" onClick={() => { setMicState("idle"); setMessage(zh ? "AI 正在重新示范，请听完后跟读。" : "The AI is modeling it again; listen and repeat."); setDemoNonce(value => value + 1); }}>{zh ? "🎙 重新听并跟读" : "🎙 Listen and retry"}</button> : null}
    <style>{`.everyday-controls .everyday-repeat-toggle{border-color:#9caaa5;background:#eef2f0}.everyday-controls .everyday-repeat-toggle.on{border-color:#087d62;background:#ddf7ed;color:#076650}.everyday-speech-retry{min-height:48px;margin:12px auto 0;padding:0 20px;display:flex;align-items:center;border:1px solid #087d62;border-radius:999px;background:#ddf7ed;color:#076650;font-weight:900;cursor:pointer}@media(max-width:620px){.everyday-controls .everyday-repeat-toggle{grid-column:span 2}}`}</style>
  </section>;
}
