"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SentenceBuilderRound } from "./SentenceBuilderRound";
import { gradeSprintPlan, type SprintAnswer, type SprintPlan } from "../lib/smartlingo-sprint";
import { scoreSmartCardPronunciation } from "../lib/smartlingo-smartcards";
import { beginnerVocabularyImageKey } from "../lib/smartlingo-vocabulary-images";
import { VocabularyPicture } from "./VocabularyPicture";
import { speakLearningText } from "../lib/smartlingo-speech";
import { vocabularyGradeLabel } from "../lib/smartlingo-vocabulary-order";
import type { InterfaceLanguage } from "../lib/interface-locale";

type Stage = "vocabulary" | "reading" | "listening" | "writing" | "dialogue" | "complete";
type SpeechKind = "vocabulary" | "reading" | "dialogue";
type SprintSpeechRecognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort?(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
const LOCALES: Record<string, string> = { zh: "zh-CN", en: "en-US", es: "es-ES", ja: "ja-JP", ko: "ko-KR", fr: "fr-FR", de: "de-DE", ru: "ru-RU", it: "it-IT", pt: "pt-PT", ar: "ar-SA", hi: "hi-IN" };

function vocabularyOptions(round: SprintPlan["rounds"][number], wordIndex: number) {
  const count = Math.min(4, round.vocabulary.length), start = wordIndex * 3 % round.vocabulary.length;
  const options = Array.from({ length: count }, (_, index) => round.vocabulary[(start + index) % round.vocabulary.length]);
  const answer = round.vocabulary[wordIndex];
  if (!options.some(item => item.id === answer.id)) options[options.length - 1] = answer;
  return [...options].sort((left, right) => left.id.localeCompare(right.id));
}

export function DailySprint({ lang, classId, durationMinutes, dayNumber: requestedDay, publicPlay = false, freshAnonymous = false }: { lang: InterfaceLanguage; classId: string; durationMinutes: 5 | 10 | 15 | 20; dayNumber?: number; publicPlay?: boolean; freshAnonymous?: boolean }) {
  const zh = lang === "zh";
  const [runId, setRunId] = useState(""), [plan, setPlan] = useState<SprintPlan | null>(null), [courseTitle, setCourseTitle] = useState(""), [anonymous, setAnonymous] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0), [stage, setStage] = useState<Stage>("vocabulary"), [wordIndex, setWordIndex] = useState(0), [responses, setResponses] = useState<SprintAnswer[]>([]);
  const [vocabFlipped, setVocabFlipped] = useState(false), [vocabChoice, setVocabChoice] = useState(""), [vocabChecked, setVocabChecked] = useState(false);
  const [readingChoice, setReadingChoice] = useState(""), [readingChecked, setReadingChecked] = useState(false);
  const [speechKind, setSpeechKind] = useState<SpeechKind | null>(null), [speechTranscript, setSpeechTranscript] = useState(""), [speechAttempted, setSpeechAttempted] = useState(false), [speechFeedback, setSpeechFeedback] = useState(""), [speechBusy, setSpeechBusy] = useState(false);
  const [speechRound, setSpeechRound] = useState(0), [speechScores, setSpeechScores] = useState<number[]>([]);
  const [repeatAfterMe, setRepeatAfterMe] = useState(false);
  const [activeDay, setActiveDay] = useState(requestedDay || 1);
  const dayNumber = activeDay;
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60), [timeExpired, setTimeExpired] = useState(false);
  const [result, setResult] = useState<{ score: number; skillScores: Record<string, number>; rewardPoints?: number } | null>(null), [error, setError] = useState("");
  const [transitionBusy, setTransitionBusy] = useState(false);
  const responsesRef = useRef<SprintAnswer[]>([]), recognitionRef = useRef<SprintSpeechRecognition | null>(null);
  const speechContinueRef = useRef<(() => void) | null>(null);
  const speechTimerRef = useRef<number | undefined>(undefined), transitionTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    fetch(`/api/classes/${encodeURIComponent(classId)}/sprint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", durationMinutes, dayNumber: requestedDay, lang, timeZone, source: publicPlay ? "play" : undefined, fresh: freshAnonymous }) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || (zh ? "无法开始今日速成" : "Unable to start Today’s Sprint")); return data; })
      .then(data => { if (freshAnonymous) { const url = new URL(window.location.href); url.searchParams.delete("fresh"); window.history.replaceState(null, "", url); } return data; })
      .then(data => { const saved = data.progress as { roundIndex?: number; stage?: Stage; wordIndex?: number; responses?: SprintAnswer[]; remainingSeconds?: number } | undefined; const initial: SprintAnswer[] = Array.isArray(saved?.responses) && saved.responses.length === data.plan.rounds.length ? saved.responses : Array.from({ length: data.plan.rounds.length }, () => ({} as SprintAnswer)); const savedRound = Math.min(saved?.roundIndex || 0, data.plan.rounds.length - 1), savedWord = Math.min(saved?.wordIndex || 0, 4); const savedStage: Stage = saved?.stage && saved.stage !== "complete" ? saved.stage : "vocabulary"; const savedAnswer = initial[savedRound] || {}; const savedWordId = data.plan.rounds[savedRound]?.vocabulary[savedWord]?.id; const savedVocabChoice = savedWordId ? savedAnswer.vocabularyAnswers?.[savedWordId] || "" : ""; setActiveDay(Number(data.dayNumber || requestedDay || 1)); setRunId(data.runId); setPlan(data.plan); setCourseTitle(data.courseTitle); setAnonymous(data.anonymous === true); setResponses(initial); responsesRef.current = initial; setRoundIndex(savedRound); setStage(savedStage); setWordIndex(savedWord); setVocabChoice(savedVocabChoice); setVocabChecked(Boolean(savedVocabChoice)); setReadingChoice(savedAnswer.reading || ""); setReadingChecked(Boolean(savedAnswer.reading)); setRemainingSeconds(Math.max(0, saved?.remainingSeconds ?? durationMinutes * 60)); })
      .catch(cause => setError(cause.message));
  }, [classId, requestedDay, durationMinutes, freshAnonymous, lang, publicPlay, zh]);


  useEffect(() => {
    if (!plan || stage === "complete" || timeExpired) return;
    const timer = window.setInterval(() => setRemainingSeconds(current => {
      if (current > 1) return current - 1;
      window.clearInterval(timer); setTimeExpired(true); return 0;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [plan, stage, timeExpired]);

  const checkpointBucket = Math.floor(remainingSeconds / 5);
  useEffect(() => {
    if (!plan || !runId || stage === "complete") return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/classes/${encodeURIComponent(classId)}/sprint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "checkpoint", runId, durationMinutes, dayNumber: activeDay, source: publicPlay ? "play" : undefined, progress: { roundIndex, stage, wordIndex, responses: responsesRef.current, remainingSeconds: checkpointBucket * 5 } }) });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeDay, checkpointBucket, classId, durationMinutes, plan, publicPlay, responses, roundIndex, runId, stage, wordIndex]);

  useEffect(() => () => {
    window.clearTimeout(speechTimerRef.current); window.clearTimeout(transitionTimerRef.current);
    try { recognitionRef.current?.abort?.(); } catch { try { recognitionRef.current?.stop(); } catch {} }
    window.speechSynthesis?.cancel();
  }, []);

  const round = plan?.rounds[roundIndex], word = round?.vocabulary[wordIndex];
  const choices = useMemo(() => round ? vocabularyOptions(round, wordIndex) : [], [round, wordIndex]);
  const totalSteps = (plan?.rounds.length || 1) * 5, step = roundIndex * 5 + ["vocabulary", "reading", "listening", "writing", "dialogue", "complete"].indexOf(stage) + 1;
  const progress = Math.min(100, Math.round(step * 100 / totalSteps));
  const update = (value: Partial<SprintAnswer>) => setResponses(current => {
    const next = current.map((item, index) => index === roundIndex ? { ...item, ...value } : item);
    responsesRef.current = next; return next;
  });
  const labels = useMemo(() => ({ vocabulary: zh ? "词汇" : "Vocabulary", reading: zh ? "阅读" : "Reading", listening: zh ? "听力" : "Listening", writing: zh ? "写作" : "Writing", dialogue: zh ? "口语" : "Speaking" }), [zh]);

  function speak(text: string, rate = .78, onEnd?: () => void) {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; window.clearTimeout(speechTimerRef.current); onEnd?.(); };
    speechTimerRef.current = window.setTimeout(() => { window.speechSynthesis.cancel(); finish(); }, Math.min(9000, Math.max(3200, Array.from(text).length * 420 + 1800)));
    speakLearningText(text,LOCALES[plan?.language || "en"] || "en-US",rate,finish);
  }
  function resetSpeech(kind: SpeechKind | null = null) { setSpeechKind(kind); setSpeechTranscript(""); setSpeechAttempted(false); setSpeechFeedback(""); setSpeechBusy(false); setSpeechRound(0); setSpeechScores([]); }
  function beginSpeechSeries(expected: string, pronunciation: string, kind: SpeechKind, onComplete: () => void) {
    resetSpeech(kind); speechContinueRef.current = onComplete; setSpeechBusy(true); let bestTranscript = "", bestScore = -1;
    const finishSeries = (scores: number[]) => {
      const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
      if (kind === "dialogue") update({ dialogueTranscript: bestTranscript });
      setSpeechBusy(false); setSpeechAttempted(true); setSpeechFeedback(zh ? `三次跟读完成，平均 ${average} 分。请选择“继续”。` : `Three repeats complete. Average ${average}. Select Continue.`);
    };
    const run = (turn: number, scores: number[]) => {
      setSpeechRound(turn); setSpeechFeedback(zh ? `第 ${turn}/3 次：正在播放 AI 示范…` : `Round ${turn}/3: playing the AI model…`);
      speak(expected, .72, () => {
        const browser = window as typeof window & { SpeechRecognition?: new () => SprintSpeechRecognition; webkitSpeechRecognition?: new () => SprintSpeechRecognition };
        const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
        if (!Recognition) {
          const next = [...scores, 0]; setSpeechScores(next); setSpeechFeedback(zh ? `第 ${turn}/3 次：浏览器不能分析语音，本次记为 0 分。` : `Round ${turn}/3: speech analysis is unavailable, scored 0.`);
          transitionTimerRef.current = window.setTimeout(() => turn < 3 ? run(turn + 1, next) : finishSeries(next), 700); return;
        }
        const recognition = new Recognition(); recognitionRef.current = recognition; let settled = false;
        const settle = (transcript = "") => {
          if (settled) return; settled = true; window.clearTimeout(speechTimerRef.current); recognitionRef.current = null;
          const review = scoreSmartCardPronunciation(expected, transcript, pronunciation, plan?.language || "");
          if (review.score > bestScore) { bestScore = review.score; bestTranscript = transcript; }
          const next = [...scores, review.score]; setSpeechScores(next); setSpeechTranscript(transcript);
          const analysis = review.score >= 85 ? (zh ? "发音清楚，很好！" : "Clear pronunciation—great job!") : review.score >= 60 ? (zh ? "可以听懂，再注意节奏和清晰度。" : "Understandable; refine rhythm and clarity.") : (zh ? "请更清楚地说，注意每个音节。" : "Speak more clearly and shape each syllable.");
          setSpeechFeedback(transcript ? `${zh ? `第 ${turn}/3 次听到“${transcript}”` : `Round ${turn}/3 heard “${transcript}”`} · ${review.score} ${zh ? "分" : "points"}。${analysis}` : (zh ? `第 ${turn}/3 次没有听清，本次 0 分。` : `Round ${turn}/3 was not clear, scored 0.`));
          transitionTimerRef.current = window.setTimeout(() => turn < 3 ? run(turn + 1, next) : finishSeries(next), 850);
        };
        recognition.lang = LOCALES[plan?.language || "en"] || "en-US"; recognition.interimResults = false; recognition.continuous = false;
        recognition.onresult = event => settle(String(event.results[0]?.[0]?.transcript || "")); recognition.onerror = () => settle(); recognition.onend = () => settle();
        setSpeechFeedback(zh ? `第 ${turn}/3 次：正在听您说…` : `Round ${turn}/3: listening…`);
        try { recognition.start(); speechTimerRef.current = window.setTimeout(() => { try { recognition.stop(); } catch {} settle(); }, 10000); } catch { settle(); }
      });
    };
    run(1, []);
  }

  function chooseVocabulary(choice: string) {
    if (!word || vocabChecked) return;
    setVocabChoice(choice);
    setVocabChecked(true); const current = responsesRef.current[roundIndex] || {};
    update({ vocabularySeen: [...new Set([...(current.vocabularySeen || []), word.id])], vocabularyAnswers: { ...(current.vocabularyAnswers || {}), [word.id]: choice } });
  }
  function startVocabularySpeaking() {
    if (!word) return;
    beginSpeechSeries(word.form, word.pronunciation, "vocabulary", nextWord);
  }
  async function saveTransition(nextStage: Stage, nextWordIndex: number) {
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/sprint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "checkpoint", runId, durationMinutes, dayNumber: activeDay, source: publicPlay ? "play" : undefined, progress: { roundIndex, stage: nextStage, wordIndex: nextWordIndex, responses: responsesRef.current, remainingSeconds } }) });
    if (!response.ok) throw new Error(zh ? "无法保存当前速成进度" : "Unable to save the current Sprint step");
  }
  async function nextWord() {
    if (!round || !word) return;
    const nextWordIndex = wordIndex + 1 < round.vocabulary.length ? wordIndex + 1 : 0;
    const nextStage: Stage = wordIndex + 1 < round.vocabulary.length ? "vocabulary" : "reading";
    setTransitionBusy(true);
    try {
      await saveTransition(nextStage, nextWordIndex);
      if (nextStage === "vocabulary") { setWordIndex(nextWordIndex); setVocabFlipped(false); setVocabChoice(""); setVocabChecked(false); resetSpeech(); return; }
      setStage("reading"); setWordIndex(0); resetSpeech("reading");
      if (repeatAfterMe) transitionTimerRef.current = window.setTimeout(() => beginSpeechSeries(round.reading.prompt, "", "reading", () => setSpeechAttempted(true)), 100);
      else setSpeechAttempted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (zh ? "无法保存当前速成进度" : "Unable to save the current Sprint step"));
    } finally {
      setTransitionBusy(false);
    }
  }
  function chooseReading(choice: string) {
    if (readingChecked) return;
    setReadingChoice(choice);
    setReadingChecked(true); update({ reading: choice });
  }
  function startDialogue() {
    if (!round) return;
    setStage("dialogue"); resetSpeech("dialogue");
    if (repeatAfterMe) transitionTimerRef.current = window.setTimeout(() => beginSpeechSeries(round.dialogue.audioText, "", "dialogue", nextRound), 100);
    else setSpeechAttempted(true);
  }
  async function nextRound() {
    if (!plan) return;
    if (roundIndex + 1 < plan.rounds.length) { setRoundIndex(index => index + 1); setStage("vocabulary"); setWordIndex(0); setVocabFlipped(false); setVocabChoice(""); setVocabChecked(false); setReadingChoice(""); setReadingChecked(false); resetSpeech(); return; }
    if(anonymous){setResult(gradeSprintPlan(plan,responsesRef.current));setStage("complete");return;}
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/sprint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "complete", runId, responses: responsesRef.current, source: publicPlay ? "play" : undefined }) });
    const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error || (zh ? "无法保存成绩" : "Unable to save score")); return; } setResult(data); setStage("complete");
  }

  if (error) return <section className="daily-sprint sprint-error"><h1>{zh ? "今日速成暂时不可用" : "Today’s Sprint is unavailable"}</h1><p role="alert">{error}</p><Link href={`/${lang}/play`}>{zh ? "返回边玩边学" : "Back to Play"}</Link></section>;
  if (!plan || !round) return <section className="daily-sprint"><p>{zh ? "正在编排五技能速成课程…" : "Building your five-skill sprint…"}</p></section>;
  const vocabularyCorrect = vocabChecked && vocabChoice === word?.id;
  const vocabularyWasMissed = Boolean(word && responses.some(item => item.vocabularyAnswers?.[word.id] && item.vocabularyAnswers[word.id] !== word.id));
  const readingCorrectLabel = round.reading.options.find(option => option.id === round.reading.answerId)?.label || "";

  return <section className="daily-sprint">
    <header className="sprint-head"><div><p>TODAY’S SPRINT · {durationMinutes} MIN · DAY {activeDay}/21</p><h1>{zh ? "今日速成" : "Today’s Sprint"}</h1><span>{courseTitle} · {zh ? `第 ${activeDay} 天` : `Day ${activeDay}`} · {roundIndex + 1}/{plan.rounds.length} {zh ? "回合" : "rounds"}</span><label className="sprint-repeat-check"><input type="checkbox" checked={repeatAfterMe} onChange={event => setRepeatAfterMe(event.target.checked)}/><span>{zh ? "三次跟读与评分（默认关闭）" : "Three scored repeats (off by default)"}</span></label></div><aside><div className="sprint-countdown" aria-live="polite"><small>{zh ? "剩余时间" : "TIME LEFT"}</small><b>{String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:{String(remainingSeconds % 60).padStart(2, "0")}</b></div><strong>{progress}%</strong></aside></header><div className="sprint-progress"><span style={{ width: `${progress}%` }}/></div>
    {stage === "vocabulary" && word ? <article className="sprint-card sprint-vocabulary"><small>{vocabularyWasMissed ? (zh ? "以前错过" : "PREVIOUS MISTAKE") : (zh ? "新词" : "NEW WORD")} · {labels.vocabulary} · {wordIndex + 1}/{round.vocabulary.length}</small><div className="sprint-word-metrics"><span>{zh ? "难度" : "Difficulty"} {word.difficulty}/5</span><span>{zh ? "常用度" : "Frequency"} {word.frequencyDegree}/10</span><span>{vocabularyGradeLabel(word.gradeLevel, zh ? "zh" : "en")}</span></div><h3>{plan.level === "beginner" ? (zh ? "选择与单词匹配的图片" : "Choose the picture that matches the word") : (zh ? "选择正确的意思，或点击卡片翻面" : "Choose the meaning, or flip the card")}</h3><button type="button" className={`sprint-flip-card ${vocabFlipped ? "flipped" : ""}`} onClick={() => setVocabFlipped(value => !value)}><span className="front"><strong dir={plan.language === "ar" ? "rtl" : "ltr"}>{word.form}</strong>{word.pronunciation ? <b>{word.pronunciation}</b> : null}<em>{zh ? "点击查看意思" : "Tap to see the meaning"}</em></span><span className="back"><strong>{word.meaning}</strong><b>{word.pronunciation}</b><em>{zh ? "再点一次返回" : "Tap again to return"}</em></span></button><div className={`sprint-options vocab-options ${plan.level === "beginner" ? "picture-options" : ""}`}>{choices.map(option => <button type="button" aria-pressed={vocabChoice === option.id} className={vocabChoice === option.id ? "selected" : ""} disabled={vocabChecked} onClick={() => chooseVocabulary(option.id)} key={option.id}>{plan.level === "beginner" ? <VocabularyPicture imageKey={beginnerVocabularyImageKey(option.form, option.meaning)} label={option.meaning}/> : null}<span>{option.meaning}</span></button>)}</div>{vocabChecked ? <aside className={vocabularyCorrect ? "correct" : "incorrect"}><strong>{vocabularyCorrect ? (zh ? "✓ 太棒了！" : "✓ Great!") : (zh ? "× 答案不对" : "× Not quite")}</strong>{!vocabularyCorrect ? <p><b>{zh ? "正确答案：" : "Correct answer: "}</b>{word.meaning}</p> : null}<nav className="sprint-speed"><button type="button" onClick={() => speak(word.form,.86)}>🔊 {zh ? "正常语速" : "Normal"}</button><button type="button" onClick={() => speak(word.form,.58)}>🐢 {zh ? "慢速" : "Slow"}</button></nav>{repeatAfterMe ? <><p>{speechKind === "vocabulary" ? speechFeedback : (zh ? "选择继续后进行三次跟读评分。" : "Continue for three scored repeats.")}</p>{speechKind === "vocabulary" ? <div className="sprint-speech-analysis" aria-label={zh ? "三次跟读分析" : "Three pronunciation analyses"}><span>{[1,2,3].map(turn => <b className={turn <= speechScores.length ? "scored" : turn === speechRound ? "active" : ""} key={turn}>{speechScores[turn - 1] ?? turn}</b>)}</span>{speechScores.length ? <strong>{zh ? "当前平均" : "Current average"} {Math.round(speechScores.reduce((sum, score) => sum + score, 0) / speechScores.length)}</strong> : null}</div> : null}{speechTranscript ? <p><b>{zh ? "设备听到：" : "Device heard: "}</b>{speechTranscript}</p> : null}</> : null}{!speechBusy ? <footer><button type="button" className="primary-button" disabled={transitionBusy} onClick={() => repeatAfterMe ? (speechKind === "vocabulary" && speechAttempted ? speechContinueRef.current?.() : startVocabularySpeaking()) : void nextWord()}>{transitionBusy ? (zh ? "正在保存…" : "Saving…") : (zh ? "继续" : "Continue")}</button></footer> : null}</aside> : null}</article> : null}
    {stage === "reading" ? <article className="sprint-card sprint-reading"><small>02 · {labels.reading}</small><h3>{repeatAfterMe ? (zh ? "跟读句子三遍，再选择正确意思" : "Repeat the sentence three times, then choose its meaning") : (zh ? "阅读句子并选择正确意思" : "Read the sentence and choose its meaning")}</h3><blockquote dir={plan.language === "ar" ? "rtl" : "ltr"}>{round.reading.prompt}</blockquote><nav className="sprint-speed"><button type="button" onClick={() => speak(round.reading.prompt,.86)}>🔊 {zh ? "正常语速" : "Normal"}</button><button type="button" onClick={() => speak(round.reading.prompt,.58)}>🐢 {zh ? "慢速" : "Slow"}</button></nav>{repeatAfterMe && speechKind === "reading" ? <aside className={speechTranscript ? "correct" : "incorrect"}><p>{speechFeedback || (zh ? "正在准备句子跟读…" : "Preparing sentence practice…")}</p><div className="sprint-speech-analysis"><span>{[1,2,3].map(turn => <b className={turn <= speechScores.length ? "scored" : turn === speechRound ? "active" : ""} key={turn}>{speechScores[turn - 1] ?? turn}</b>)}</span></div>{speechTranscript ? <p><b>{zh ? "设备听到：" : "Device heard: "}</b>{speechTranscript}</p> : null}</aside> : null}<div className="sprint-options">{round.reading.options.map(option => <button type="button" aria-pressed={readingChoice === option.id} className={readingChoice === option.id ? "selected" : ""} disabled={readingChecked || !speechAttempted} onClick={() => chooseReading(option.id)} key={option.id}>{option.label}</button>)}</div>{readingChecked ? <aside className={readingChoice === round.reading.answerId ? "correct" : "incorrect"}><strong>{readingChoice === round.reading.answerId ? (zh ? "✓ 回答正确" : "✓ Correct") : (zh ? "× 答案不对" : "× Not quite")}</strong>{readingChoice !== round.reading.answerId ? <p><b>{zh ? "正确答案：" : "Correct answer: "}</b>{readingCorrectLabel}</p> : null}<footer><button type="button" className="primary-button" onClick={() => setStage("listening")}>{zh ? "继续" : "Continue"}</button></footer></aside> : null}</article> : null}
    {stage === "listening" ? <article className="sprint-card"><small>03 · {labels.listening}</small><SentenceBuilderRound lang={zh ? "zh" : "en"} mode="listening" speechLocale={LOCALES[plan.language]} exercises={[round.listening]} onComplete={answer => { const parsed = JSON.parse(answer) as string[]; update({ listening: parsed[0] || "" }); setStage("writing"); }}/></article> : null}
    {stage === "writing" ? <article className="sprint-card"><small>04 · {labels.writing}</small><SentenceBuilderRound lang={zh ? "zh" : "en"} mode="writing" speechLocale={LOCALES[plan.language]} exercises={[round.writing]} onComplete={answer => { const parsed = JSON.parse(answer) as string[]; update({ writing: parsed[0] || "" }); startDialogue(); }}/></article> : null}
    {stage === "dialogue" ? <article className="sprint-card sprint-dialogue"><small>05 · {labels.dialogue}</small><h3>{repeatAfterMe ? (zh ? "最后跟 AI 说一句，完成三次评分跟读" : "Finish with three scored AI speaking attempts") : (zh ? "听一遍真实表达，再继续完成本轮" : "Listen to a useful expression, then finish the round")}</h3><blockquote dir={plan.language === "ar" ? "rtl" : "ltr"}>{round.dialogue.audioText}</blockquote><p>{round.dialogue.prompt}</p><nav className="sprint-speed"><button type="button" onClick={() => speak(round.dialogue.audioText,.86)}>🔊 {zh ? "正常语速" : "Normal"}</button><button type="button" onClick={() => speak(round.dialogue.audioText,.58)}>🐢 {zh ? "慢速" : "Slow"}</button></nav>{repeatAfterMe ? <aside className={speechTranscript ? "correct" : "incorrect"}><p>{speechFeedback || (zh ? "正在准备口语分析…" : "Preparing speech analysis…")}</p><div className="sprint-speech-analysis"><span>{[1,2,3].map(turn => <b className={turn <= speechScores.length ? "scored" : turn === speechRound ? "active" : ""} key={turn}>{speechScores[turn - 1] ?? turn}</b>)}</span></div>{speechTranscript ? <p><b>{zh ? "设备听到：" : "Device heard: "}</b>{speechTranscript}</p> : null}{speechAttempted && !speechBusy ? <footer><button type="button" className="primary-button" onClick={() => speechContinueRef.current?.()}>{zh ? "继续" : "Continue"}</button></footer> : null}</aside> : <footer><button type="button" className="primary-button" onClick={() => void nextRound()}>{zh ? "继续" : "Continue"}</button></footer>}</article> : null}
    {stage === "complete" && result ? <article className="sprint-result"><span>★</span><h2>{zh ? `第 ${dayNumber} 天速成完成！` : `Day ${dayNumber} complete!`}</h2><strong>{result.score}<small>/100</small></strong>{!anonymous ? <p className="sprint-reward">+{result.rewardPoints || 0} {zh ? "学习奖励分" : "learning reward points"}</p> : null}<div>{Object.entries(result.skillScores).map(([skill, score]) => <p key={skill}><b>{labels[skill as keyof typeof labels]}</b><span>{score}</span></p>)}</div>{anonymous ? <section className="sprint-signup"><h3>{zh ? "保存今天的成绩" : "Save today’s score"}</h3><p>{zh ? "本次匿名学习不会写入账户或数据库。免费注册或登录后，即可保存进度、参加排行榜并继续学习。" : "This anonymous session was not written to an account or database. Create a free account or sign in to save progress, join rankings, and keep learning."}</p><nav><Link href={`/${lang}/auth/sign-up?returnTo=${encodeURIComponent(`/${lang}/play?language=${plan.language}`)}`}>{zh ? "免费注册" : "Create free account"} →</Link><Link href={`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/play?language=${plan.language}`)}`}>{zh ? "登录" : "Sign in"}</Link></nav></section> : <nav><Link href={`/${lang}/play/rankings?language=${plan.language}`}>{zh ? "查看排行榜" : "View rankings"} →</Link><Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>{zh ? "返回课程" : "Back to course"}</Link></nav>}</article> : null}
    {timeExpired && stage !== "complete" ? <div className="sprint-timeout" role="dialog" aria-modal="true" aria-labelledby="sprint-timeout-title"><section><p>TIME IS UP</p><h2 id="sprint-timeout-title">{zh ? "是否延长 5 分钟完成？" : "Add 5 minutes to finish?"}</h2><span>{zh ? "选择“是”继续当前学习；选择“否”立即退出今日速成。" : "Choose Yes to continue, or No to quit Today’s Sprint now."}</span><nav><button type="button" onClick={() => { setRemainingSeconds(300); setTimeExpired(false); }}>{zh ? "是，延长 5 分钟" : "Yes, add 5 minutes"}</button><button type="button" onClick={() => window.location.assign(publicPlay ? `/${lang}/play?language=${plan.language}` : `/${lang}/classes/${encodeURIComponent(classId)}/learn`)}>{zh ? "否，退出" : "No, quit"}</button></nav></section></div> : null}
    <style>{`.daily-sprint{width:min(980px,calc(100% - 32px));min-height:70vh;margin:42px auto 90px;color:#17342c}.sprint-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:end}.sprint-head p,.sprint-card>small{color:#087d62;font-size:12px;font-weight:950;letter-spacing:.12em}.sprint-head h1{margin:6px 0;font-size:clamp(40px,6vw,70px)}.sprint-head aside{display:flex;align-items:center;gap:12px}.sprint-head aside button{padding:11px;border:1px solid #afc8be;border-radius:12px;background:#fff}.sprint-head aside>strong{font-size:34px}.sprint-countdown{min-width:104px;padding:9px 12px;border-radius:14px;background:#123f35;color:#fff;text-align:center}.sprint-countdown small,.sprint-countdown b{display:block}.sprint-countdown small{color:#9de7cf;font-size:9px;font-weight:950;letter-spacing:.08em}.sprint-countdown b{margin-top:2px;font-size:24px;font-variant-numeric:tabular-nums}.sprint-progress{height:11px;margin:24px 0;border-radius:99px;background:#dce8e3;overflow:hidden}.sprint-progress span{display:block;height:100%;background:#18bf84}.sprint-card,.sprint-result{padding:clamp(24px,5vw,54px);border:1px solid #bed1c8;border-radius:28px;background:#fff;box-shadow:0 22px 65px #143d3020}.sprint-card>h3{margin:18px 0;font-size:clamp(25px,4vw,40px)}.sprint-card button,.sprint-result a{min-height:48px;padding:11px 17px;border:1px solid #b8cbc3;border-radius:13px;background:#fff;color:#17342c;font-weight:850}.sprint-card .primary-button,.sprint-result a:first-child{border:0;background:#0a7d61;color:#fff}.sprint-flip-card{position:relative;width:100%;min-height:260px!important;margin:18px 0;padding:0!important;overflow:hidden;border:0!important;border-radius:24px!important;background:linear-gradient(145deg,#0c503f,#0c8768)!important;color:#fff!important;perspective:1000px}.sprint-flip-card>span{position:absolute;inset:0;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;backface-visibility:hidden;transition:transform .45s}.sprint-flip-card .front strong{font-size:clamp(48px,9vw,86px)}.sprint-flip-card .front b{color:#ccefe3}.sprint-flip-card .back{transform:rotateY(180deg);background:linear-gradient(145deg,#173b54,#276b83)}.sprint-flip-card.flipped .front{transform:rotateY(180deg)}.sprint-flip-card.flipped .back{transform:rotateY(360deg)}.sprint-flip-card .back strong{font-size:clamp(34px,6vw,62px)}.sprint-flip-card b{font-size:22px}.sprint-flip-card em{font-style:normal;color:#d7f7eb}.sprint-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:24px 0}.sprint-options button{text-align:left}.sprint-options .selected{border-color:#087d62;background:#e2f5ed}.sprint-card>aside{margin:16px 0;padding:18px;border-radius:15px;background:#dff7e9;color:#096646}.sprint-card>aside.incorrect{background:#ffe3e3;color:#a23232}.sprint-card>aside p{margin:6px 0}.sprint-speech-analysis{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px}.sprint-speech-analysis>span{display:flex;gap:7px}.sprint-speech-analysis>span b{width:38px;height:38px;display:grid;place-items:center;border:2px solid #9fcabb;border-radius:50%;background:#fff;color:#41675b}.sprint-speech-analysis>span b.active{border-color:#087d62;box-shadow:0 0 0 4px #bcebdc}.sprint-speech-analysis>span b.scored{border-color:#087d62;background:#087d62;color:#fff}.sprint-card>footer,.sprint-card>nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:22px}.sprint-reading blockquote,.sprint-dialogue blockquote{padding:25px;border:0;border-radius:18px;background:#123f35;color:#fff;font-size:clamp(25px,4vw,42px)}.sprint-result{text-align:center}.sprint-result>span{font-size:70px;color:#f1b629}.sprint-result h2{font-size:42px}.sprint-result>strong{font-size:80px;color:#087d62}.sprint-result>strong small{font-size:20px}.sprint-result>div{max-width:520px;margin:25px auto}.sprint-result p{display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #dde7e2}.sprint-result nav{display:flex;justify-content:center;flex-wrap:wrap;gap:10px}.sprint-signup{max-width:680px;margin:30px auto 0;padding:24px;border-radius:20px;background:#e5f6ee}.sprint-signup h3{margin:0;font-size:28px}.sprint-signup p{display:block;margin:10px 0 20px;border:0;line-height:1.65}.sprint-signup nav{display:flex;justify-content:center;flex-wrap:wrap;gap:10px}.sprint-timeout{position:fixed;z-index:1200;inset:0;padding:18px;display:grid;place-items:center;background:rgba(5,29,24,.76);backdrop-filter:blur(8px)}.sprint-timeout>section{width:min(560px,100%);padding:clamp(25px,5vw,46px);border-radius:25px;background:#f7f3ea;box-shadow:0 30px 90px rgba(0,0,0,.3)}.sprint-timeout p{color:#087d62;font-size:11px;font-weight:950;letter-spacing:.13em}.sprint-timeout h2{font-size:clamp(32px,6vw,53px)}.sprint-timeout span{display:block;color:#5f716a;line-height:1.6}.sprint-timeout nav{margin-top:25px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.sprint-timeout button{min-height:54px;border:1px solid #adc4bb;border-radius:14px;background:#fff;color:#17342c;font-weight:900}.sprint-timeout button:first-child{border:0;background:#087d62;color:#fff}@media(max-width:620px){.sprint-head{grid-template-columns:1fr}.sprint-head aside{justify-content:space-between;flex-wrap:wrap}.sprint-options{grid-template-columns:1fr}.sprint-flip-card{min-height:220px!important}.sprint-speech-analysis{align-items:flex-start;flex-direction:column}.sprint-timeout nav{grid-template-columns:1fr}}`}</style>
    <style>{`.sprint-word-metrics{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sprint-word-metrics span{padding:7px 10px;border-radius:999px;background:#eef6f2;color:#41675b;font-size:12px;font-weight:900}.sprint-repeat-check{margin-top:12px;display:flex;align-items:center;gap:8px;color:#46645b;font-size:13px;font-weight:850}.sprint-repeat-check input{width:18px;height:18px;accent-color:#087d62}.sprint-speed{display:flex;justify-content:flex-start!important;gap:9px;margin:12px 0!important}.sprint-speed button{min-height:44px!important}.sprint-card button:disabled{opacity:.42;cursor:not-allowed}.sprint-card>aside footer{display:flex;justify-content:flex-end;margin-top:16px}.sprint-card>aside footer button{border:0;background:#0a7d61;color:#fff}.picture-options button{display:grid;grid-template-columns:84px 1fr;align-items:center;gap:14px}.picture-options .vocabulary-picture{width:84px;height:84px;display:block;border-radius:14px;background-color:#eef7f3}.picture-options button>span{text-align:left}`}</style>
  </section>;
}
