"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreSmartCardPronunciation } from "../lib/smartlingo-smartcards";
import { dialogueAnswerChoices, splitEverydayMission } from "../lib/smartlingo-dialogue-choices";
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

export function EverydaySpeakingPlayer({ lang, siteLang = lang, language, languageName, speechLocale, direction, scene, level, slides: sourceSlides, roleTutorEnabled = false }: {
  lang: "zh" | "en";
  siteLang?: string;
  language: string;
  languageName: string;
  speechLocale: string;
  direction: "ltr" | "rtl";
  scene: { id: string; nameZh: string; nameEn: string; goalZh: string; goalEn: string; image: string; motionMedia?: readonly string[] };
  level: "beginner" | "intermediate" | "advanced";
  slides: readonly Slide[];
  roleTutorEnabled?: boolean;
}) {
  const zh = lang === "zh";
  const levelName = level === "beginner" ? (zh ? "初级" : "Beginner") : level === "intermediate" ? (zh ? "中级" : "Intermediate") : (zh ? "高级" : "Advanced");
  // Reserve the last two authored exchanges for an uncoached check. The same
  // reviewed deck supplies the distractors; no model-generated answer is scored.
  const mission = useMemo(() => splitEverydayMission(sourceSlides), [sourceSlides]);
  const { guided: slides, independent: independentChecks } = mission;
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
  const [choiceReady, setChoiceReady] = useState(false);
  const [choiceSolved, setChoiceSolved] = useState(false);
  const [choiceRejected, setChoiceRejected] = useState<string[]>([]);
  const [choiceFeedback, setChoiceFeedback] = useState("");
  const [completedPairs, setCompletedPairs] = useState<number[]>([]);
  const [independentStep, setIndependentStep] = useState(-1);
  const [independentAnswers, setIndependentAnswers] = useState<boolean[]>([]);
  const [independentChoice, setIndependentChoice] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const speechCleanupRef = useRef<() => void>(() => undefined);
  const attemptsRef = useRef(0);
  const microphoneApproved = useRef(false);
  const listenRef = useRef<() => void>(() => undefined);
  const slide = slides[index];
  const answerChallenge = useMemo(() => dialogueAnswerChoices(slides, index), [slides, index]);
  const challengeTotal = slides.filter(item => item.kind === "sentence" && item.role === "staff").length;
  const challengeAnswered = completedPairs.length;
  // The deck now alternates scene words and dialogue; old slide indexes no longer
  // point at the same content, so resume progress must start a new version.
  const progressCookie = `smartlingo_everyday_v3_${language}_${scene.id}_${level}`;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const move = useCallback((next: number) => {
    if (independentStep >= 0) return;
    if (next > index && answerChallenge && !choiceSolved) return;
    if (next > index + 1 && challengeAnswered < challengeTotal) return;
    clearTimer();
    window.speechSynthesis?.cancel();
    speechCleanupRef.current();
    setListening(false);
    setMicState("idle");
    attemptsRef.current = 0;
    setAttemptScores([]);
    setReadyToContinue(false);
    setChoiceReady(false);
    setChoiceSolved(false);
    setChoiceRejected([]);
    setChoiceFeedback("");
    setMessage("");
    if (next >= slides.length) {
      if (challengeAnswered < challengeTotal) return;
      writeProgressCookie(progressCookie, slides.length);
      if (independentChecks.length) setIndependentStep(0);
      else setComplete(true);
      return;
    }
    setComplete(false);
    const safeNext = Math.max(0, next);
    writeProgressCookie(progressCookie, safeNext);
    setIndex(safeNext);
  }, [answerChallenge, challengeAnswered, challengeTotal, choiceSolved, clearTimer, independentChecks.length, independentStep, index, progressCookie, slides.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readProgressCookie(progressCookie);
      if (!saved || !slides.length) return;
      setStarted(true);
      if (saved >= slides.length) {
        setIndex(slides.length - 1);
        setCompletedPairs(slides.filter(item => item.kind === "sentence" && item.role === "staff").map(item => Number(item.pairIndex)));
        if (independentChecks.length) setIndependentStep(0);
        else setComplete(true);
        return;
      }
      setCompletedPairs(slides.slice(0, saved).filter(item => item.kind === "sentence" && item.role === "staff").map(item => Number(item.pairIndex)));
      setIndex(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [independentChecks.length, progressCookie, slides]);

  useEffect(() => {
    if (!started || paused || complete || independentStep >= 0 || !slide) return;
    clearTimer();
    let disposed = false;
    let activeCleanup: () => void = () => undefined;
    const schedule = () => {
      if (disposed) return;
      if (!repeatAfterMe) {
        setChoiceReady(Boolean(answerChallenge));
        setReadyToContinue(!answerChallenge);
        setMessage(answerChallenge
          ? (zh ? "听完提问，请选择与提示意思相符的回答。" : "Listen to the question, then choose the reply matching the meaning below.")
          : (zh ? "听完示范后，可查看词义并继续。" : "Model complete. Review the meaning, then continue."));
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
  }, [answerChallenge, clearTimer, complete, demoNonce, independentStep, index, modelRate, paused, repeatAfterMe, slide, speechLocale, started, userLanguageHelp, zh]);

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
    setReadyToContinue(!enabled && started && !answerChallenge);
    setChoiceReady(false);
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
      if (attemptsRef.current >= 3) {
        setChoiceReady(Boolean(answerChallenge));
        setReadyToContinue(!answerChallenge);
      }
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
    setChoiceReady(false);
    setChoiceSolved(false);
    setChoiceRejected([]);
    setChoiceFeedback("");
    setCompletedPairs([]);
    setIndependentStep(-1);
    setIndependentAnswers([]);
    setIndependentChoice(null);
    setMicState("idle");
    attemptsRef.current = 0;
    writeProgressCookie(progressCookie, 0);
  }

  function manualAttempt() {
    if (readyToContinue) return;
    attemptsRef.current += 1;
    setAttemptScores(current => [...current, 0]);
    if (attemptsRef.current >= 3) {
      setChoiceReady(Boolean(answerChallenge));
      setReadyToContinue(!answerChallenge);
      setMessage(zh ? "三次跟读完成。当前浏览器未提供语音分数，点“继续”进入下一句。" : "Three attempts complete. This browser could not provide a score; tap Continue.");
    } else {
      setMessage(zh ? `已记录第 ${attemptsRef.current}/3 次跟读。再听一次示范。` : `Attempt ${attemptsRef.current}/3 recorded. Listen to the model again.`);
      setDemoNonce(value => value + 1);
    }
  }

  function chooseReply(id: string) {
    if (!answerChallenge || !choiceReady || choiceSolved || choiceRejected.includes(id)) return;
    const pair = Number(slide.pairIndex || 0);
    if (id === answerChallenge.answerId) {
      setChoiceSolved(true);
      setReadyToContinue(true);
      setCompletedPairs(value => value.includes(pair) ? value : [...value, pair]);
      setChoiceFeedback(choiceRejected.length
        ? (zh ? "找到了！现在听听这句回答，再进入下一轮。" : "You found it. Listen to this reply, then continue.")
        : (zh ? "答对了！这句回答完成了当前任务。" : "Correct! This reply completes the current task."));
      return;
    }
    const rejected = [...choiceRejected, id];
    setChoiceRejected(rejected);
    if (rejected.length >= 2) {
      setChoiceSolved(true);
      setReadyToContinue(true);
      setCompletedPairs(value => value.includes(pair) ? value : [...value, pair]);
      setChoiceFeedback(zh
        ? `这轮的示范回答是“${answerChallenge.answer.form}”。听一遍后继续。`
        : `The model reply is “${answerChallenge.answer.form}”. Listen once, then continue.`);
    } else setChoiceFeedback(zh ? "再试一次：找出与提示意思完全相符的回答。" : "Try once more: find the reply with the exact meaning shown above.");
  }

  function chooseIndependentReply(id: string) {
    if (independentStep < 0 || independentChoice !== null) return;
    const check = independentChecks[independentStep];
    if (!check || !check.challenge.choices.some(item => item.id === id)) return;
    setIndependentChoice(id);
    setIndependentAnswers(previous => [...previous, id === check.challenge.answerId]);
  }

  function continueIndependentCheck() {
    if (independentChoice === null) return;
    if (independentStep + 1 >= independentChecks.length) {
      setIndependentStep(-1);
      setComplete(true);
    } else {
      setIndependentStep(value => value + 1);
      setIndependentChoice(null);
    }
  }

  const sentenceIndex = slides.slice(0, index + 1).filter(item => item.kind === "sentence").length - 1;
  const customerTurn = slide.kind === "sentence" && (slide.role ? slide.role === "learner" : sentenceIndex % 2 === 1);
  const sceneMedia = slide.kind === "sentence" && scene.motionMedia?.length
    ? scene.motionMedia[(slide.pairIndex ?? Math.floor(Math.max(0, sentenceIndex) / 2)) % scene.motionMedia.length]
    : scene.image;
  const speakerLabel = slide.kind === "word" ? (zh ? "场景词汇教练" : "Vocabulary guide") : customerTurn ? (zh ? "顾客 / 学习者" : "Customer / learner") : (zh ? "工作人员" : "Staff member");
  return <section className="everyday-player">
    <header className="everyday-player-heading" data-layout-overlap-check="everyday-lesson-heading">
      <div><p>{languageName} · {levelName} · {zh ? "生活口语" : "Everyday speaking"}</p><h1>{zh ? scene.nameZh : scene.nameEn}</h1><span>{zh ? scene.goalZh : scene.goalEn}</span></div>
      <aside><strong>{repeatAfterMe ? bestScore : `${challengeAnswered}/${challengeTotal}`}</strong><span>{repeatAfterMe ? (zh ? "本轮最高跟读分" : "Best speaking score") : (zh ? "已完成跟练问答" : "Guided replies completed")}</span></aside>
    </header>
    <label className="everyday-repeat-check"><input type="checkbox" checked={repeatAfterMe} onChange={event => setRepeat(event.target.checked)}/><span><b>{zh ? "开启三次跟读与评分" : "Repeat after me three times with scoring"}</b><small>{zh ? "默认关闭；需要口语训练时再开启麦克风。" : "Off by default. Enable it only when you want microphone practice."}</small></span></label>
    <fieldset className="everyday-language-help"><legend>{zh ? "用户语言语音辅助" : "User-language spoken help"}</legend><label><input type="radio" name="user-language-help" checked={!userLanguageHelp} onChange={() => setUserLanguageHelp(false)}/>{zh ? "关闭" : "Off"}</label><label><input type="radio" name="user-language-help" checked={userLanguageHelp} onChange={() => setUserLanguageHelp(true)}/>{zh ? "开启" : "On"}</label><small>{zh ? "开启后先用用户语言提示，再播放学习语言；评分仍只检查学习语言。" : "When on, hear a bridge-language cue before the learning language. Scoring still checks only the learning language."}</small></fieldset>
    <div className="everyday-stage" dir={direction}>
      <Image src={sceneMedia} alt={zh ? `${scene.nameZh}生活口语场景` : `${scene.nameEn} everyday speaking scene`} width={1200} height={800} unoptimized/>
      <div className="everyday-shade"/>
      <div className="everyday-progress"><span style={{ width: `${(index + 1) * 100 / slides.length}%` }}/></div>
      <div className={`everyday-conversation-person ${customerTurn ? "customer" : "staff"}`} aria-hidden="true"><span>{customerTurn ? "👤" : "●"}</span><i>{speakerLabel}</i></div>
      <div className={`everyday-copy ${customerTurn ? "customer-turn" : "staff-turn"}`}>
        <p>{levelName} · {index + 1} / {slides.length} · {zh ? slide.stageZh : slide.stageEn}</p>
        <small>{speakerLabel} · {repeatAfterMe ? (zh ? "请跟我说" : "REPEAT AFTER ME") : slide.kind === "word" ? (zh ? "认识一个场景词" : "LEARN ONE SCENE WORD") : (zh ? "先听真实对话" : "LISTEN IN CONTEXT")}</small>
        {slide.kind === "word" ? <><VocabularyPicture imageKey={slide.imageKey} label={zh ? slide.meaningZh : slide.meaningEn} className="everyday-word-picture"/><div className="everyday-word-metrics"><span>{zh ? "难度" : "Difficulty"} {slide.difficulty || 1}/5</span><span>{zh ? "常用度" : "Frequency"} {slide.frequencyDegree || 10}/10</span><span>{vocabularyGradeLabel(slide.gradeLevel, zh ? "zh" : "en")}</span></div></> : null}
        <h2>{slide.form}</h2>
        <b>{slide.pronunciation}</b>
        <span>{zh ? slide.meaningZh : slide.meaningEn}</span>
        <em aria-live="polite">{message}</em>
      </div>
      {!started ? <button className="everyday-start" data-layout-allow-overlap="intentional" type="button" onClick={begin}><span>▶</span><strong>{zh ? "开始真实场景对话" : "Start the real-life conversation"}</strong><small>{repeatAfterMe ? (zh ? "人物对话 · 每句跟读 3 次 · 即时评分" : "Role-play · repeat each line 3 times · instant scores") : (zh ? "人物对话 · 场景词汇 · 听完继续" : "Role-play · scene vocabulary · listen and continue")}</small></button> : null}
      {complete ? <div className="everyday-complete"><span>✦</span><h2>{zh ? "完成一个生活口语场景！" : "Everyday speaking scene complete!"}</h2><p>{zh ? `跟练 ${challengeAnswered}/${challengeTotal} 组；无提示应答 ${independentAnswers.filter(Boolean).length}/${independentChecks.length} 组。此结果只反映本次任务，不是正式语言等级或发音评分。` : `${challengeAnswered}/${challengeTotal} guided exchanges; ${independentAnswers.filter(Boolean).length}/${independentChecks.length} uncoached replies. This is a task result, not a formal proficiency or pronunciation score.`}</p><nav><button onClick={replay}>{zh ? "再玩一次" : "Play again"}</button><Link href={`/${siteLang}/play/everyday?language=${language}`}>{zh ? "选择其他场景" : "Choose another scene"}</Link></nav></div> : null}
    </div>
    {independentStep >= 0 && independentChecks[independentStep] ? <section className="everyday-reply-game everyday-independent-check" aria-label={zh ? "无提示独立应答" : "Uncoached reply check"}>
      <div><small>{zh ? `独立应答 ${independentStep + 1}/${independentChecks.length}` : `UNCOACHED REPLY ${independentStep + 1}/${independentChecks.length}`}</small><h2>{zh ? "换个问题，自己选一句回答。" : "A new question. Choose your own reply."}</h2><p dir={direction}>{independentChecks[independentStep].question.form}</p><button type="button" onClick={() => speakLearningText(independentChecks[independentStep].question.form, speechLocale, modelRate)}>{zh ? "🔊 听问题" : "🔊 Hear the question"}</button></div>
      <div className="everyday-reply-options">{independentChecks[independentStep].challenge.choices.map(option => <button type="button" key={option.id} disabled={independentChoice !== null} className={independentChoice === option.id ? (option.id === independentChecks[independentStep].challenge.answerId ? "correct" : "rejected") : ""} onClick={() => chooseIndependentReply(option.id)} dir={direction}>{option.form}</button>)}</div>
      {independentChoice !== null ? <p className="everyday-reply-feedback" role="status">{independentChoice === independentChecks[independentStep].challenge.answerId ? (zh ? "这次独立回答准确。" : "You answered independently.") : (zh ? `这次未答对。示范回答：${independentChecks[independentStep].challenge.answer.form}` : `Not yet. A useful reply is: ${independentChecks[independentStep].challenge.answer.form}`)} <button type="button" onClick={continueIndependentCheck}>{independentStep + 1 === independentChecks.length ? (zh ? "查看本轮结果" : "See result") : (zh ? "下一道" : "Next question")}</button></p> : null}
    </section> : null}
    {complete ? <section className="everyday-finish-next" aria-labelledby="everyday-finish-next-title">
      <div><small>{zh ? "可选的下一步" : "YOUR NEXT STEP"}</small><h2 id="everyday-finish-next-title">{zh ? "把这段对话用得更熟练。" : "Make this conversation feel natural."}</h2><p>{zh ? "继续免费练习，或与明确标注的 AI 学伴交流。旗舰版提供无广告学习及全部课程等级。" : "Keep practicing for free, or chat with a clearly labeled AI study partner. Max currently offers ad-free learning and access to every course level."}</p></div>
      <nav aria-label={zh ? "完成后的学习选择" : "Learning choices after completion"}><Link href={`/${siteLang}/assistant?language=${language}&mode=conversation&partner=aya`}>{zh ? "与 AI 学伴免费练习" : "Practice free with an AI partner"} →</Link>{roleTutorEnabled ? <Link href={`/${siteLang}/assistant/role-tutor?language=${language}&scene=${scene.id}&level=${level}`}>{zh ? "旗舰版 · 与场景角色一对一练习" : "Max · 1:1 scene role-play"} →</Link> : null}<Link href={`/${siteLang}/pricing`}>{zh ? "了解旗舰版方案" : "Explore Max plans"} →</Link></nav>
    </section> : null}
    {started && !complete && answerChallenge && choiceReady ? <section className="everyday-reply-game" aria-label={zh ? "情景回答挑战" : "Scene reply challenge"}>
      <div><small>{zh ? `问答 ${Number(slide.pairIndex || 0) + 1}/${challengeTotal}` : `EXCHANGE ${Number(slide.pairIndex || 0) + 1}/${challengeTotal}`}</small><h2>{zh ? "选出合适的回答" : "Choose the reply"}</h2><p>{zh ? "请选择表达这个意思的一句：" : "Choose the sentence that means:"} <strong>{zh ? answerChallenge.answer.meaningZh : answerChallenge.answer.meaningEn}</strong></p></div>
      <div className="everyday-reply-options">{answerChallenge.choices.map(option => <button type="button" key={option.id} disabled={choiceSolved || choiceRejected.includes(option.id)} className={choiceSolved && option.id === answerChallenge.answerId ? "correct" : choiceRejected.includes(option.id) ? "rejected" : ""} onClick={() => chooseReply(option.id)} dir={direction}>{option.form}</button>)}</div>
      {choiceFeedback ? <p className={choiceSolved ? "everyday-reply-feedback solved" : "everyday-reply-feedback"} role="status">{choiceFeedback}{choiceSolved ? <button type="button" onClick={() => { speakLearningText(answerChallenge.answer.form, speechLocale, modelRate); }}>{zh ? "🔊 听示范回答" : "🔊 Hear the model reply"}</button> : null}</p> : null}
    </section> : null}
    {independentStep < 0 && !complete ? <><div className="everyday-controls" aria-label={zh ? "幻灯片控制" : "Slide controls"} data-layout-overlap-check="everyday-lesson-actions">
      <button onClick={() => move(0)} disabled={index === 0} aria-label={zh ? "第一张" : "First slide"}>≪</button>
      <button onClick={() => move(index - 1)} disabled={index === 0} aria-label={zh ? "上一张" : "Previous slide"}>‹</button>
      <button className={modelRate > .7 ? "everyday-repeat-toggle on" : "everyday-repeat-toggle"} type="button" aria-pressed={modelRate > .7} onClick={() => { setModelRate(.84); setDemoNonce(value => value + 1); }}>🔊 {zh ? "正常语速" : "Normal"}</button>
      <button className={modelRate <= .7 ? "everyday-repeat-toggle on" : "everyday-repeat-toggle"} type="button" aria-pressed={modelRate <= .7} onClick={() => { setModelRate(.58); setDemoNonce(value => value + 1); }}>🐢 {zh ? "慢速" : "Slow"}</button>
      <button onClick={() => move(index + 1)} disabled={complete || Boolean(answerChallenge && !choiceSolved)} aria-label={zh ? "下一张" : "Next slide"}>›</button>
      <button onClick={() => move(slides.length - 1)} disabled={index === slides.length - 1 || challengeAnswered < challengeTotal || Boolean(answerChallenge && !choiceSolved)} aria-label={zh ? "最后一张" : "Last slide"}>≫</button>
      <button className="everyday-pause" onClick={togglePause} disabled={!started || complete}>{paused ? (zh ? "▶ 继续" : "▶ Play") : (zh ? "Ⅱ 暂停" : "Ⅱ Pause")}</button>
      <Link className="everyday-quit" href={`/${siteLang}/play/everyday?language=${language}`}>{zh ? "退出" : "Quit"}</Link>
    </div>
    <output className="everyday-speed-status" aria-live="polite">{modelRate <= .7 ? (zh ? "当前语速：慢速 0.42×" : "Current speed: Slow 0.42×") : (zh ? "当前语速：正常 0.84×" : "Current speed: Normal 0.84×")}</output>
    {started && !complete && repeatAfterMe ? <div className="everyday-attempts" aria-label={zh ? "三次跟读成绩" : "Three speaking attempt scores"}>{[1, 2, 3].map(turn => <b className={turn <= attemptScores.length ? "scored" : ""} key={turn}>{attemptScores[turn - 1] ?? turn}</b>)}</div> : null}
    {started && !complete && repeatAfterMe && (micState === "denied" || micState === "error" || micState === "unsupported") ? <div className="everyday-fallback"><button className="everyday-speech-retry" type="button" onClick={() => { setMicState("idle"); setMessage(zh ? "AI 正在重新示范，请听完后跟读。" : "The AI is modeling it again; listen and repeat."); setDemoNonce(value => value + 1); }}>{zh ? "🎙 重新听并跟读" : "🎙 Listen and retry"}</button><button className="everyday-speech-retry" type="button" onClick={manualAttempt}>{zh ? "我已跟读" : "I said it"}</button></div> : null}
    {started && !complete && (readyToContinue || (answerChallenge && choiceSolved)) ? <button className="everyday-continue" type="button" onClick={() => move(index + 1)}>{zh ? "继续" : "Continue"} →</button> : null}
    </> : null}
    <style>{`.everyday-word-metrics{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}.everyday-word-metrics span{padding:6px 9px;border-radius:999px;background:#eff9f5;color:#075f4d;font-size:11px;font-weight:900}`}</style>
    <style>{`.everyday-repeat-check,.everyday-language-help{width:min(1180px,100%);margin:0 auto 16px;padding:14px 17px;border:1px solid #bad5ca;border-radius:15px;background:#fff}.everyday-repeat-check{display:flex;align-items:center;gap:12px}.everyday-repeat-check input{width:22px;height:22px;accent-color:#087d62}.everyday-repeat-check span,.everyday-repeat-check small{display:block}.everyday-repeat-check small{margin-top:3px;color:#61756d}.everyday-language-help{display:flex;align-items:center;gap:16px}.everyday-language-help legend{padding:0 7px;font-weight:900}.everyday-language-help label{display:flex;align-items:center;gap:6px;font-weight:850}.everyday-language-help input{accent-color:#087d62}.everyday-language-help small{margin-left:auto;color:#61756d}.everyday-stage>img{animation:everyday-camera 14s ease-in-out infinite alternate}.everyday-conversation-person{position:absolute;z-index:3;bottom:28px;right:25px;display:grid;justify-items:center;color:#fff;filter:drop-shadow(0 7px 16px #0018)}.everyday-conversation-person.customer{right:auto;left:25px}.everyday-conversation-person span{width:66px;height:66px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;background:#087d62;font-size:34px}.everyday-conversation-person.staff span{background:#234c76}.everyday-conversation-person i{margin-top:6px;padding:5px 9px;border-radius:999px;background:#082f28db;font-style:normal;font-size:11px}.everyday-copy{animation:everyday-bubble .35s ease-out}.everyday-word-picture{width:min(180px,38vw);aspect-ratio:1;border:5px solid #fff;border-radius:20px;box-shadow:0 12px 34px #0017}.everyday-controls .everyday-repeat-toggle{border-color:#9caaa5;background:#eef2f0}.everyday-controls .everyday-repeat-toggle.on{border-color:#087d62;background:#ddf7ed;color:#076650}.everyday-speed-status{width:max-content;max-width:100%;margin:10px auto 0;padding:7px 12px;display:block;border-radius:999px;background:#e8f6f0;color:#076650;font-weight:850}.everyday-fallback,.everyday-attempts{margin:12px auto 0;display:flex;justify-content:center;gap:10px}.everyday-attempts b{width:42px;height:42px;display:grid;place-items:center;border:2px solid #bfd3ca;border-radius:50%;color:#60746c}.everyday-attempts b.scored{border-color:#087d62;background:#ddf7ed;color:#076650}.everyday-speech-retry,.everyday-continue{min-height:48px;margin:12px auto 0;padding:0 20px;display:flex;align-items:center;border:1px solid #087d62;border-radius:999px;background:#ddf7ed;color:#076650;font-weight:900;cursor:pointer}.everyday-fallback .everyday-speech-retry{margin:0}.everyday-continue{min-width:180px;justify-content:center;background:#087d62;color:#fff}@keyframes everyday-camera{from{transform:scale(1.01) translateX(-.5%)}to{transform:scale(1.08) translateX(.8%)}}@keyframes everyday-bubble{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.everyday-stage>img,.everyday-copy{animation:none}}@media(max-width:620px){.everyday-language-help{align-items:flex-start;flex-wrap:wrap}.everyday-language-help small{width:100%;margin:0}.everyday-controls .everyday-repeat-toggle{grid-column:span 2}.everyday-fallback{flex-direction:column;align-items:center}.everyday-conversation-person{display:none}}`}</style>
  </section>;
}
