"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { scoreSmartCardPronunciation } from "../lib/smartlingo-smartcards";

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
  start(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

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
  const [message, setMessage] = useState("");
  const [bestScore, setBestScore] = useState(0);
  const timerRef = useRef<number | null>(null);
  const slide = slides[index];

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const move = useCallback((next: number) => {
    clearTimer();
    window.speechSynthesis?.cancel();
    setListening(false);
    setMessage("");
    if (next >= slides.length) { setComplete(true); return; }
    setComplete(false);
    setIndex(Math.max(0, next));
  }, [clearTimer, slides.length]);

  useEffect(() => {
    if (!started || paused || complete || !slide) return;
    clearTimer();
    setMessage(zh ? "AI 正在示范，请听完后跟读。" : "Listen to the AI, then repeat.");
    if (!("speechSynthesis" in window)) {
      timerRef.current = window.setTimeout(() => move(index + 1), 8000);
      return clearTimer;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(slide.form);
    utterance.lang = speechLocale;
    utterance.rate = .76;
    const schedule = () => {
      setMessage(zh ? "轮到您：请跟我说。也可点麦克风获得即时评分。" : "Your turn: repeat after me. Use the microphone for an instant score.");
      timerRef.current = window.setTimeout(() => move(index + 1), 8000);
    };
    utterance.onend = schedule;
    utterance.onerror = schedule;
    window.speechSynthesis.speak(utterance);
    return () => { clearTimer(); window.speechSynthesis.cancel(); };
  }, [clearTimer, complete, index, move, paused, slide, speechLocale, started, zh]);

  function begin() {
    setStarted(true);
    setPaused(false);
    setComplete(false);
    setMessage("");
  }

  function togglePause() {
    clearTimer();
    window.speechSynthesis?.cancel();
    setPaused(value => !value);
  }

  function listen() {
    if (listening || !slide) return;
    clearTimer();
    window.speechSynthesis?.cancel();
    const browser = window as typeof window & { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage(zh ? "此浏览器暂不支持自动评分。您仍可听读并使用幻灯片练习。" : "Automatic scoring is unavailable in this browser. You can still listen and repeat.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = speechLocale;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      setListening(false);
      const transcript = String(event.results?.[0]?.[0]?.transcript || "");
      const result = scoreSmartCardPronunciation(slide.form, transcript, slide.pronunciation, language);
      setBestScore(current => Math.max(current, result.score));
      setMessage(result.passed
        ? (zh ? `听到“${transcript}” · ${result.score} 分，太棒了！` : `Heard “${transcript}” · ${result.score}. Great job!`)
        : (zh ? `听到“${transcript}” · ${result.score} 分。再听一次，慢慢说。` : `Heard “${transcript}” · ${result.score}. Listen once more and speak slowly.`));
      if (result.passed) timerRef.current = window.setTimeout(() => move(index + 1), 1400);
    };
    recognition.onerror = event => {
      setListening(false);
      setMessage(event.error === "not-allowed"
        ? (zh ? "麦克风未获允许。请在浏览器的网站设置中允许麦克风后再试。" : "Microphone access is blocked. Allow it in this site's browser settings and try again.")
        : (zh ? "没有听清，请靠近麦克风再试一次。" : "I could not hear clearly. Move closer to the microphone and try again."));
    };
    setListening(true);
    setMessage(zh ? "正在听您说……" : "Listening to you…");
    try { recognition.start(); } catch { setListening(false); }
  }

  function replay() {
    clearTimer();
    setComplete(false);
    setIndex(0);
    setStarted(true);
    setPaused(false);
    setMessage("");
    setBestScore(0);
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
      <button className="everyday-mic" onClick={listen} disabled={!started || complete || listening}>🎙 {listening ? (zh ? "正在听" : "Listening") : (zh ? "跟读评分" : "Score my speech")}</button>
      <button onClick={() => move(index + 1)} disabled={complete} aria-label={zh ? "下一张" : "Next slide"}>›</button>
      <button onClick={() => move(slides.length - 1)} disabled={index === slides.length - 1} aria-label={zh ? "最后一张" : "Last slide"}>≫</button>
      <button className="everyday-pause" onClick={togglePause} disabled={!started || complete}>{paused ? (zh ? "▶ 继续" : "▶ Play") : (zh ? "Ⅱ 暂停" : "Ⅱ Pause")}</button>
      <Link className="everyday-quit" href={`/${lang}/play/everyday?language=${language}`}>{zh ? "退出" : "Quit"}</Link>
    </div>
  </section>;
}
