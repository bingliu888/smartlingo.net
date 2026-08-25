"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { scoreSmartCardPronunciation } from "../lib/smartlingo-smartcards";
import { VocabularyPicture } from "./VocabularyPicture";
import type { BeginnerVocabularyImageKey } from "../lib/smartlingo-vocabulary-images";
import { speakLearningText } from "../lib/smartlingo-speech";
import { vocabularyGradeLabel } from "../lib/smartlingo-vocabulary-order";

type Slide = {
  id: string;
  form: string;
  pronunciation: string;
  meaningZh: string;
  meaningEn: string;
  stageZh: string;
  stageEn: string;
  kind: "word" | "sentence";
  imageKey: BeginnerVocabularyImageKey | null;
  anchorVocabulary?: string;
  role?: "staff" | "learner";
  pairIndex?: number;
  difficulty?: number;
  frequencyDegree?: number;
  gradeLevel?: number;
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

function readProgressCookie(key: string) {
  const value = document.cookie.split("; ").find(item => item.startsWith(`${key}=`))?.split("=").slice(1).join("=");
  const parsed = Number(value ? decodeURIComponent(value) : 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function writeProgressCookie(key: string, value: number) {
  document.cookie = `${key}=${encodeURIComponent(String(value))}; Max-Age=2592000; Path=/; SameSite=Lax`;
}

export function EverydaySpeakingPlayer({ lang, language, languageName, speechLocale, direction, scene, level, slides }: {
  lang: "zh" | "en";
  language: string;
  languageName: string;
  speechLocale: string;
  direction: "ltr" | "rtl";
  scene: { id: string; nameZh: string; nameEn: string; goalZh: string; goalEn: string; image: string; motionMedia?: readonly string[] };
  level: "beginner" | "intermediate" | "advanced";
  slides: readonly Slide[];
}) {
  const zh = lang === "zh";
  const levelName = level === "beginner" ? (zh ? "初级" : "Beginner") : level === "intermediate" ? (zh ? "中级" : "Intermediate") : (zh ? "高级" : "Advanced");
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [complete, setComplete] = useState(false);
  const [listening, setListening] = useState(false);
  const [micState, setMicState] = useState<MicState>("idle");
  const [message, setMessage] = useState("");
  const [bestScore, setBestScore] = useState(0);
  const [attemptScores, setAttemptScores] = useState<number[]>([]);
  const [readyToContinue, setReadyToContinue] = useState(false);
  const [modelRate, setModelRate] = useState(.84);
  const [repeatAfterMe, setRepeatAfterMe] = useState(false);
  const [userLanguageHelp, setUserLanguageHelp] = useState(false);
  const [demoNonce, setDemoNonce] = useState(0);
  const timerRef = useRef<number | null>(null);
  const speechCleanupRef = useRef<() => void>(() => undefined);
  const attemptsRef = useRef(0);
  const microphoneApproved = useRef(false);
  const listenRef = useRef<() => void>(() => undefined);
  const slide = slides[index];
  const progressCookie = `smartlingo_everyday_${language}_${scene.id}_${level}`;

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
    setAttemptScores([]);
    setReadyToContinue(false);
    setMessage("");
    if (next >= slides.length) { writeProgressCookie(progressCookie, slides.length); setComplete(true); return; }
    setComplete(false);
    const safeNext = Math.max(0, next);
    writeProgressCookie(progressCookie, safeNext);
    setIndex(safeNext);
  }, [clearTimer, progressCookie, slides.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readProgressCookie(progressCookie);
      if (!saved || !slides.length) return;
      setStarted(true);
      if (saved >= slides.length) {
        setIndex(slides.length - 1);
        setComplete(true);
        return;
      }
      setIndex(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [progressCookie, slides.length]);

  useEffect(() => {
    if (!started || paused || complete || !slide) return;
    clearTimer();
    let disposed = false;
    let activeCleanup: () => void = () => undefined;
    const schedule = () => {
      if (disposed) return;
      if (!repeatAfterMe) {
        setReadyToContinue(true);
        setMessage(zh ? "听完示范后，可查看词义并继续。" : "Model complete. Review the meaning, then continue.");
        return;
      }
      setMessage(zh ? `第 ${attemptsRef.current + 1}/3 次：请跟我说，AI 会自动评分。` : `Attempt ${attemptsRef.current + 1}/3: repeat after me for an automatic score.`);
      timerRef.current = window.setTimeout(() => listenRef.current(), 450);
    };
    const playTarget = () => {
      if (disposed) return;
      activeCleanup = speakLearningText(slide.form, speechLocale, modelRate, schedule);
    };
    if (userLanguageHelp) {
      activeCleanup = speakLearningText(zh ? slide.meaningZh : slide.meaningEn, zh ? "zh-CN" : "en-US", .88, playTarget);
    } else playTarget();
    const cleanup = () => { disposed = true; clearTimer(); activeCleanup(); };
    speechCleanupRef.current = cleanup;
    return cleanup;
  }, [clearTimer, complete, demoNonce, index, modelRate, paused, repeatAfterMe, slide, speechLocale, started, userLanguageHelp, zh]);

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

  function setRepeat(enabled: boolean) {
    clearTimer();
    window.speechSynthesis?.cancel();
    speechCleanupRef.current();
    setListening(false);
    setMicState("idle");
    attemptsRef.current = 0;
    setAttemptScores([]);
    setReadyToContinue(!enabled && started);
    setMessage(enabled ? (zh ? "跟读评分已开启；每句可跟读三次。" : "Repeat-after-me scoring is on for three attempts per line.") : (zh ? "跟读评分已关闭；听完即可继续。" : "Repeat-after-me scoring is off; listen and continue."));
    setRepeatAfterMe(enabled);
    if (started) setDemoNonce(value => value + 1);
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
      setMessage(zh ? "此浏览器暂不支持麦克风评分；跟读后可点“我已跟读”完成三次练习。" : "Microphone scoring is unavailable. Repeat aloud, then use “I said it” for each attempt.");
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
      setAttemptScores(current => [...current, result.score]);
      setMessage(result.passed
        ? (zh ? `听到“${transcript}” · ${result.score} 分，太棒了！` : `Heard “${transcript}” · ${result.score}. Great job!`)
        : attemptsRef.current < 3
          ? (zh ? `听到“${transcript}” · ${result.score} 分。AI 再示范一次，请慢慢说。` : `Heard “${transcript}” · ${result.score}. The AI will model it again; speak slowly.`)
          : (zh ? `三次跟读完成，最高 ${Math.max(bestScore, result.score)} 分。点“继续”进入下一句。` : `Three attempts complete. Best ${Math.max(bestScore, result.score)}. Tap Continue for the next phrase.`));
      if (attemptsRef.current >= 3) setReadyToContinue(true);
      else timerRef.current = window.setTimeout(() => setDemoNonce(value => value + 1), 1500);
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
    setAttemptScores([]);
    setReadyToContinue(false);
    setMicState("idle");
    attemptsRef.current = 0;
    writeProgressCookie(progressCookie, 0);
  }

  function manualAttempt() {
    if (readyToContinue) return;
    attemptsRef.current += 1;
    setAttemptScores(current => [...current, 0]);
    if (attemptsRef.current >= 3) {
      setReadyToContinue(true);
      setMessage(zh ? "三次跟读完成。当前浏览器未提供语音分数，点“继续”进入下一句。" : "Three attempts complete. This browser could not provide a score; tap Continue.");
    } else {
      setMessage(zh ? `已记录第 ${attemptsRef.current}/3 次跟读。再听一次示范。` : `Attempt ${attemptsRef.current}/3 recorded. Listen to the model again.`);
      setDemoNonce(value => value + 1);
    }
  }

  const sentenceIndex = slides.slice(0, index + 1).filter(item => item.kind === "sentence").length - 1;
  const customerTurn = slide.kind === "sentence" && (slide.role ? slide.role === "learner" : sentenceIndex % 2 === 1);
  const sceneMedia = slide.kind === "sentence" && scene.motionMedia?.length
    ? scene.motionMedia[(slide.pairIndex ?? Math.floor(Math.max(0, sentenceIndex) / 2)) % scene.motionMedia.length]
    : scene.image;
  const speakerLabel = slide.kind === "word" ? (zh ? "场景词汇教练" : "Vocabulary guide") : customerTurn ? (zh ? "顾客 / 学习者" : "Customer / learner") : (zh ? "工作人员" : "Staff member");
  return <section className="everyday-player" data-layout-fill="everyday-speaking-player">
    <header className="everyday-player-heading">
      <div><p>{languageName} · {levelName} · {zh ? "生活口语" : "Everyday speaking"}</p><h1>{zh ? scene.nameZh : scene.nameEn}</h1><span>{zh ? scene.goalZh : scene.goalEn}</span></div>
      <aside><strong>{bestScore}</strong><span>{repeatAfterMe ? (zh ? "本轮最高跟读分" : "Best speaking score") : (zh ? "跟读默认关闭" : "Repeat is off")}</span></aside>
    </header>
    <label className="everyday-repeat-check"><input type="checkbox" checked={repeatAfterMe} onChange={event => setRepeat(event.target.checked)}/><span><b>{zh ? "开启三次跟读与评分" : "Repeat after me three times with scoring"}</b><small>{zh ? "默认关闭；需要口语训练时再开启麦克风。" : "Off by default. Enable it only when you want microphone practice."}</small></span></label>
    <fieldset className="everyday-language-help"><legend>{zh ? "用户语言语音辅助" : "User-language spoken help"}</legend><label><input type="radio" name="user-language-help" checked={!userLanguageHelp} onChange={() => setUserLanguageHelp(false)}/>{zh ? "关闭" : "Off"}</label><label><input type="radio" name="user-language-help" checked={userLanguageHelp} onChange={() => setUserLanguageHelp(true)}/>{zh ? "开启" : "On"}</label><small>{zh ? "开启后先用用户语言提示，再播放学习语言；评分仍只检查学习语言。" : "When on, hear a bridge-language cue before the learning language. Scoring still checks only the learning language."}</small></fieldset>
    <div className="everyday-stage" dir={direction}>
      <img src={sceneMedia} alt={zh ? `${scene.nameZh}生活口语场景` : `${scene.nameEn} everyday speaking scene`}/>
      <div className="everyday-shade"/>
      <div className="everyday-progress"><span style={{ width: `${(index + 1) * 100 / slides.length}%` }}/></div>
      <div className={`everyday-conversation-person ${customerTurn ? "customer" : "staff"}`} aria-hidden="true"><span>{customerTurn ? "👤" : "●"}</span><i>{speakerLabel}</i></div>
      <div className={`everyday-copy ${customerTurn ? "customer-turn" : "staff-turn"}`}>
        <p>{levelName} · {index + 1} / {slides.length} · {zh ? slide.stageZh : slide.stageEn}</p>
        <small>{speakerLabel} · {repeatAfterMe ? (zh ? "请跟我说" : "REPEAT AFTER ME") : (zh ? "先听真实对话" : "LISTEN IN CONTEXT")}</small>
        {slide.kind === "word" ? <><VocabularyPicture imageKey={slide.imageKey} label={zh ? slide.meaningZh : slide.meaningEn} className="everyday-word-picture"/><div className="everyday-word-metrics"><span>{zh ? "难度" : "Difficulty"} {slide.difficulty || 1}/5</span><span>{zh ? "常用度" : "Frequency"} {slide.frequencyDegree || 10}/10</span><span>{vocabularyGradeLabel(slide.gradeLevel, zh ? "zh" : "en")}</span></div></> : null}
        <h2>{slide.form}</h2>
        <b>{slide.pronunciation}</b>
        <span>{zh ? slide.meaningZh : slide.meaningEn}</span>
        <em aria-live="polite">{message}</em>
      </div>
      {!started ? <button className="everyday-start" type="button" onClick={begin}><span>▶</span><strong>{zh ? "开始真实场景对话" : "Start the real-life conversation"}</strong><small>{repeatAfterMe ? (zh ? "人物对话 · 每句跟读 3 次 · 即时评分" : "Role-play · repeat each line 3 times · instant scores") : (zh ? "人物对话 · 场景词汇 · 听完继续" : "Role-play · scene vocabulary · listen and continue")}</small></button> : null}
      {complete ? <div className="everyday-complete"><span>✦</span><h2>{zh ? "完成一个生活口语场景！" : "Everyday speaking scene complete!"}</h2><p>{zh ? "再玩一次巩固短句，或选择另一个真实生活场景。" : "Play again to reinforce the phrases, or choose another real-life scene."}</p><nav><button onClick={replay}>{zh ? "再玩一次" : "Play again"}</button><Link href={`/${lang}/play/everyday?language=${language}`}>{zh ? "选择其他场景" : "Choose another scene"}</Link></nav></div> : null}
    </div>
    <div className="everyday-controls" aria-label={zh ? "幻灯片控制" : "Slide controls"}>
      <button onClick={() => move(0)} disabled={index === 0} aria-label={zh ? "第一张" : "First slide"}>≪</button>
      <button onClick={() => move(index - 1)} disabled={index === 0} aria-label={zh ? "上一张" : "Previous slide"}>‹</button>
      <button className={modelRate > .7 ? "everyday-repeat-toggle on" : "everyday-repeat-toggle"} type="button" aria-pressed={modelRate > .7} onClick={() => { setModelRate(.84); setDemoNonce(value => value + 1); }}>🔊 {zh ? "正常语速" : "Normal"}</button>
      <button className={modelRate <= .7 ? "everyday-repeat-toggle on" : "everyday-repeat-toggle"} type="button" aria-pressed={modelRate <= .7} onClick={() => { setModelRate(.58); setDemoNonce(value => value + 1); }}>🐢 {zh ? "慢速" : "Slow"}</button>
      <button onClick={() => move(index + 1)} disabled={complete} aria-label={zh ? "下一张" : "Next slide"}>›</button>
      <button onClick={() => move(slides.length - 1)} disabled={index === slides.length - 1} aria-label={zh ? "最后一张" : "Last slide"}>≫</button>
      <button className="everyday-pause" onClick={togglePause} disabled={!started || complete}>{paused ? (zh ? "▶ 继续" : "▶ Play") : (zh ? "Ⅱ 暂停" : "Ⅱ Pause")}</button>
      <Link className="everyday-quit" href={`/${lang}/play/everyday?language=${language}`}>{zh ? "退出" : "Quit"}</Link>
    </div>
    <output className="everyday-speed-status" aria-live="polite">{modelRate <= .7 ? (zh ? "当前语速：慢速 0.42×" : "Current speed: Slow 0.42×") : (zh ? "当前语速：正常 0.84×" : "Current speed: Normal 0.84×")}</output>
    {started && !complete && repeatAfterMe ? <div className="everyday-attempts" aria-label={zh ? "三次跟读成绩" : "Three speaking attempt scores"}>{[1, 2, 3].map(turn => <b className={turn <= attemptScores.length ? "scored" : ""} key={turn}>{attemptScores[turn - 1] ?? turn}</b>)}</div> : null}
    {started && !complete && repeatAfterMe && (micState === "denied" || micState === "error" || micState === "unsupported") ? <div className="everyday-fallback"><button className="everyday-speech-retry" type="button" onClick={() => { setMicState("idle"); setMessage(zh ? "AI 正在重新示范，请听完后跟读。" : "The AI is modeling it again; listen and repeat."); setDemoNonce(value => value + 1); }}>{zh ? "🎙 重新听并跟读" : "🎙 Listen and retry"}</button><button className="everyday-speech-retry" type="button" onClick={manualAttempt}>{zh ? "我已跟读" : "I said it"}</button></div> : null}
    {started && !complete && readyToContinue ? <button className="everyday-continue" type="button" onClick={() => move(index + 1)}>{zh ? "继续" : "Continue"} →</button> : null}
    <style>{`.everyday-word-metrics{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}.everyday-word-metrics span{padding:6px 9px;border-radius:999px;background:#eff9f5;color:#075f4d;font-size:11px;font-weight:900}`}</style>
    <style>{`.everyday-repeat-check,.everyday-language-help{width:min(1180px,100%);margin:0 auto 16px;padding:14px 17px;border:1px solid #bad5ca;border-radius:15px;background:#fff}.everyday-repeat-check{display:flex;align-items:center;gap:12px}.everyday-repeat-check input{width:22px;height:22px;accent-color:#087d62}.everyday-repeat-check span,.everyday-repeat-check small{display:block}.everyday-repeat-check small{margin-top:3px;color:#61756d}.everyday-language-help{display:flex;align-items:center;gap:16px}.everyday-language-help legend{padding:0 7px;font-weight:900}.everyday-language-help label{display:flex;align-items:center;gap:6px;font-weight:850}.everyday-language-help input{accent-color:#087d62}.everyday-language-help small{margin-left:auto;color:#61756d}.everyday-stage>img{animation:everyday-camera 14s ease-in-out infinite alternate}.everyday-conversation-person{position:absolute;z-index:3;bottom:28px;right:25px;display:grid;justify-items:center;color:#fff;filter:drop-shadow(0 7px 16px #0018)}.everyday-conversation-person.customer{right:auto;left:25px}.everyday-conversation-person span{width:66px;height:66px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;background:#087d62;font-size:34px}.everyday-conversation-person.staff span{background:#234c76}.everyday-conversation-person i{margin-top:6px;padding:5px 9px;border-radius:999px;background:#082f28db;font-style:normal;font-size:11px}.everyday-copy{animation:everyday-bubble .35s ease-out}.everyday-word-picture{width:min(180px,38vw);aspect-ratio:1;border:5px solid #fff;border-radius:20px;box-shadow:0 12px 34px #0017}.everyday-controls .everyday-repeat-toggle{border-color:#9caaa5;background:#eef2f0}.everyday-controls .everyday-repeat-toggle.on{border-color:#087d62;background:#ddf7ed;color:#076650}.everyday-speed-status{width:max-content;max-width:100%;margin:10px auto 0;padding:7px 12px;display:block;border-radius:999px;background:#e8f6f0;color:#076650;font-weight:850}.everyday-fallback,.everyday-attempts{margin:12px auto 0;display:flex;justify-content:center;gap:10px}.everyday-attempts b{width:42px;height:42px;display:grid;place-items:center;border:2px solid #bfd3ca;border-radius:50%;color:#60746c}.everyday-attempts b.scored{border-color:#087d62;background:#ddf7ed;color:#076650}.everyday-speech-retry,.everyday-continue{min-height:48px;margin:12px auto 0;padding:0 20px;display:flex;align-items:center;border:1px solid #087d62;border-radius:999px;background:#ddf7ed;color:#076650;font-weight:900;cursor:pointer}.everyday-fallback .everyday-speech-retry{margin:0}.everyday-continue{min-width:180px;justify-content:center;background:#087d62;color:#fff}@keyframes everyday-camera{from{transform:scale(1.01) translateX(-.5%)}to{transform:scale(1.08) translateX(.8%)}}@keyframes everyday-bubble{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.everyday-stage>img,.everyday-copy{animation:none}}@media(max-width:620px){.everyday-language-help{align-items:flex-start;flex-wrap:wrap}.everyday-language-help small{width:100%;margin:0}.everyday-controls .everyday-repeat-toggle{grid-column:span 2}.everyday-fallback{flex-direction:column;align-items:center}.everyday-conversation-person{display:none}}`}</style>
  </section>;
}
