"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { vocabularyLibraryPage } from "../lib/smartlingo-learning-hub";
import { SentenceBuilderRound } from "./SentenceBuilderRound";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { beginnerVocabularyImageKey } from "../lib/smartlingo-vocabulary-images";
import { VocabularyPicture } from "./VocabularyPicture";

type Status = "mastered" | "learning" | "unlearned";
type Mode = "recognition" | "recall" | "listening" | "spelling" | "cloze";
type Card = {
  id: string; form: string; pronunciation: string; targetPhonetic: string; pronunciationEn: string;
  pronunciationZh: string; pronunciationGuides: Record<string, string>; meaningEn: string; meaningZh: string; sceneKey: string; direction: "ltr" | "rtl";
  status: Status; memoryStage: number; nextMemoryDay: number | null; mode: Mode; dueAt: number | null;
  difficulty: number; frequencyDegree: number;
  sentence: { id: string; scenario: string; promptZh: string; promptEn: string; audioText: string; answerTokens: string[] };
  options: { id: string; form: string; meaningEn: string; meaningZh: string }[];
};
type LibraryItem = Pick<Card, "id" | "form" | "targetPhonetic" | "meaningEn" | "meaningZh" | "sceneKey" | "direction" | "status" | "memoryStage" | "difficulty" | "frequencyDegree">;
type Summary = { total: number; mastered: number; learning: number; unlearned: number; percent: number; stars: number };
type Report = Summary & { localDate: string };
type Payload = {
  localDate: string; targetLanguage: string; level: string; methodology: { days: number[]; minimumModes: number };
  summary: Summary; dailyDeck: Card[]; items: LibraryItem[]; reports: Report[]; correct?: boolean; error?: string;
};
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void;
  abort?(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const SPEECH_LOCALES: Record<string, string> = { zh: "zh-CN", en: "en-US", es: "es-ES", ja: "ja-JP", ko: "ko-KR", fr: "fr-FR", de: "de-DE", ru: "ru-RU", it: "it-IT", pt: "pt-BR", ar: "ar-SA", hi: "hi-IN" };
const SCENES: Record<string, string> = { greetings: "☀️", introductions: "👋", transport: "🚆", directions: "🧭", restaurant: "🍜", shopping: "🛍️", help: "🛟" };

export function VocabularyMemoryWorkspace({ lang, classId }: { lang: InterfaceLanguage; classId: string }) {
  const zh = lang === "zh";
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Status>("unlearned");
  const [index, setIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<"answer" | "feedback" | "speak" | "sentence" | "done">("answer");
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [speechMessage, setSpeechMessage] = useState("");
  const [pronunciationRound, setPronunciationRound] = useState(0);
  const [pronunciationScores, setPronunciationScores] = useState<number[]>([]);
  const [coachStatus, setCoachStatus] = useState<"idle" | "model" | "listening" | "scoring" | "complete">("idle");
  const [timeScene, setTimeScene] = useState<"dawn" | "day" | "sunset" | "night">("day");
  const [busy, setBusy] = useState(false);
  const [repeatAfterMe, setRepeatAfterMe] = useState(false);
  const [error, setError] = useState("");
  const [libraryPage, setLibraryPage] = useState(1);
  const zone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const load = useCallback(async (startWordId?: string) => {
    const query = new URLSearchParams({ timeZone: zone, lang: zh ? "zh" : "en" });
    if (startWordId) query.set("startWordId", startWordId);
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/vocabulary?${query}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as Payload;
    if (!response.ok) throw new Error(payload.error || "LOAD_FAILED");
    setData(payload);
  }, [classId, zone, zh]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(() => setError(t("The course vocabulary is temporarily unavailable.", "暂时无法读取课程词库。"))); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, lang]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hour = new Date().getHours();
      setTimeScene(hour < 7 ? "dawn" : hour < 17 ? "day" : hour < 20 ? "sunset" : "night");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const cards = data?.dailyDeck || [];
  const card = cards[index] || null;
  const practicePercent = cards.length ? Math.round(((index + 1) / cards.length) * 100) : 0;
  const filtered = (data?.items || []).filter(item => item.status === tab);
  const pageResult = vocabularyLibraryPage(filtered, libraryPage);
  const { page: visiblePage, pageCount, items: pageItems } = pageResult;
  const meaning = (item: { meaningZh: string; meaningEn: string }) => zh ? item.meaningZh : item.meaningEn;
  const textMode = card?.mode === "spelling" || card?.mode === "cloze";

  // Selection questions score immediately; typing questions score after the learner pauses.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedOptionId && phase === "answer" && !busy) void submit(selectedOptionId); }, [selectedOptionId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!textMode || phase !== "answer" || !typed.trim() || busy) return; const timer = window.setTimeout(checkTyped, 900); return () => window.clearTimeout(timer); }, [typed, textMode, phase, busy]);

  function playWord(rate = .86, after?: () => void) {
    if (!card || !("speechSynthesis" in window)) { after?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.form);
    utterance.lang = SPEECH_LOCALES[data?.targetLanguage || ""] || data?.targetLanguage || "en-US";
    utterance.rate = rate;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(watchdog);
      after?.();
    };
    const watchdog = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      finish();
    }, Math.min(8000, Math.max(3000, Array.from(card.form).length * 500 + 1800)));
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }

  async function submit(selectedId: string, answer = "") {
    if (!card || busy) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/vocabulary`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id, selectedId, answer, mode: card.mode, timeZone: zone, lang: zh ? "zh" : "en" }),
    });
    const payload = await response.json().catch(() => ({})) as Payload;
    setBusy(false);
    if (!response.ok) { setError(payload.error || t("Unable to save. Try again.", "提交失败，请再试一次。")); return; }
    setData(current => current ? { ...payload, dailyDeck: current.dailyDeck } : payload);
    setPronunciationScores([]);
    setAnswerCorrect(Boolean(payload.correct));
    setPhase("feedback");
  }

  function checkTyped() {
    if (!card || !typed.trim()) return;
    const clean = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
    void submit(clean(typed) === clean(card.form) ? card.id : "wrong", typed);
  }

  function continueAfterFeedback() {
    if (!repeatAfterMe) {
      setPhase("sentence");
      return;
    }
    setPhase("speak");
    setPronunciationRound(1);
    setCoachStatus("idle");
    setSpeechMessage(answerCorrect
      ? t("Correct! Now follow the model three times. Each attempt receives a score.", "回答正确！现在跟读三次，每次都会获得评分。")
      : `${t("Remember this word", "请记住这个词")}：${card?.form || ""} · ${card ? meaning(card) : ""}。${t("Now follow the model three times.", "现在跟读三次。")}`);
  }

  function nextCard() {
    setIndex(current => Math.min(current + 1, Math.max(0, cards.length - 1)));
    setSelectedOptionId(""); setTyped(""); setRevealed(false); setAnswerCorrect(null); setPhase(index + 1 >= cards.length ? "done" : "answer"); setSpeechMessage("");
    setPronunciationRound(0); setPronunciationScores([]); setCoachStatus("idle");
  }

  async function startFromWord(wordId: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await load(wordId);
      setIndex(0); setSelectedOptionId(""); setTyped(""); setRevealed(false); setAnswerCorrect(null); setPhase("answer");
      setSpeechMessage(""); setPronunciationRound(0); setPronunciationScores([]); setCoachStatus("idle");
      document.getElementById("vm-practice")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError(t("Unable to start from this word. Try again shortly.", "暂时无法从这个词开始，请稍后重试。"));
    } finally { setBusy(false); }
  }

  function continueTwentyWordRound() {
    const lastId = cards.at(-1)?.id;
    const ordered = data?.items || [];
    const lastIndex = lastId ? ordered.findIndex(item => item.id === lastId) : -1;
    const next = ordered[lastIndex + 1] || ordered[0];
    if (next) void startFromWord(next.id);
  }

  async function runPronunciationTurn(round: number) {
    const browser = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition || !card) { setSpeechMessage(t("Speech recognition is unavailable. Use the latest Safari, Chrome, or Edge.", "当前浏览器不支持语音识别，请使用最新版 Safari、Chrome 或 Edge。")); setCoachStatus("idle"); return; }
    const recognition = new Recognition();
    recognition.lang = SPEECH_LOCALES[data?.targetLanguage || ""] || data?.targetLanguage || "en-US";
    recognition.interimResults = false; recognition.continuous = false;
    let heardResult = false;
    let listeningWatchdog = 0;
    const stopListeningWatchdog = () => window.clearTimeout(listeningWatchdog);
    const recoverListening = () => {
      if (heardResult) return;
      stopListeningWatchdog();
      setCoachStatus("idle");
      setSpeechMessage(t("I could not hear clearly. Allow the microphone and select “Continue”, or skip this word.", "没有听清。请允许麦克风，然后点“继续跟读”；也可以跳过本词。"));
    };
    recognition.onresult = event => {
      heardResult = true;
      stopListeningWatchdog();
      const heard = String(event.results?.[0]?.[0]?.transcript || "");
      setCoachStatus("scoring");
      void fetch(`/api/classes/${encodeURIComponent(classId)}/vocabulary`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pronunciation_review", cardId: card.id, transcript: heard, timeZone: zone }),
      }).then(async response => ({ response, payload: await response.json().catch(() => ({})) as { pronunciationFeedback?: { score: number; feedback: { zh: string; en: string } }; error?: string } }))
        .then(({ response, payload }) => {
          if (!response.ok || !payload.pronunciationFeedback) throw new Error(payload.error || "SCORE_FAILED");
          const score = payload.pronunciationFeedback.score;
          setPronunciationScores(current => [...current, score]);
          setSpeechMessage(`${zh ? `第 ${round} 次听到“${heard}”` : `${t("Round", "第")} ${round}: “${heard}”`} · ${score} ${t("points", "分")}。${payload.pronunciationFeedback.feedback[lang === "zh" ? "zh" : "en"]}`);
          setCoachStatus(round >= 3 ? "complete" : "idle");
          setPronunciationRound(round >= 3 ? 3 : round + 1);
        }).catch(() => { setCoachStatus("idle"); setSpeechMessage(t("Scoring failed. Select “Continue” to retry this round.", "评分暂时失败，请点“继续跟读”重试本轮。")); });
    };
    recognition.onerror = recoverListening;
    recognition.onend = recoverListening;
    setCoachStatus("model");
    setSpeechMessage(zh ? `第 ${round}/3 次：先听示范，然后跟读。` : `${t("Round", "第")} ${round}/3: ${t("listen, then repeat.", "先听示范，然后跟读。")}`);
    playWord(.86, () => {
      setCoachStatus("listening");
      try {
        recognition.start();
        listeningWatchdog = window.setTimeout(() => {
          try { recognition.abort?.(); } catch { /* recognition already ended */ }
          recoverListening();
        }, 12000);
      } catch {
        recoverListening();
      }
    });
  }

  const modeLabel: Record<Mode, string> = {
    recognition: t("Word → meaning", "看词选义"), recall: t("Meaning → word", "看义找词"), listening: t("Listen → meaning", "听音辨义"),
    spelling: t("Spelling recall", "拼写回忆"), cloze: t("Active completion", "主动填词"),
  };

  return <section className="vm-shell" data-layout-ready={data ? "true" : undefined} data-layout-overlap-check="vocabulary-memory">
    <header className="vm-hero" data-layout-overlap-check="vocabulary-hero"><div><p>{t("SMARTLINGO · 21-DAY MEMORY", "SMARTLINGO · 21 天记忆")}</p><h1>{t("Ten daily cards. Turn new words into lasting memory.", "每天十张卡，把新词变成长久记忆")}</h1><span>{t("A word becomes mastered only after retrieval on days 1, 3, 7, 14 and 21 across at least three modes.", "第 1、3、7、14、21 天跨日回忆，并完成至少三种题型后才计入“学会了”。")}</span></div><Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>← {t("Back to course", "返回课程")}</Link></header>

    {data ? <><section className="vm-dashboard" data-layout-overlap-check="vocabulary-dashboard" aria-label={t("Vocabulary overview", "词汇学习总览")}>
      <div className="vm-score"><span>{t("Mastery", "已学会比例")}</span><strong>{data.summary.percent}%</strong><div aria-label={`${data.summary.stars} / 5`}>{[1,2,3,4,5].map(star => <b className={star <= data.summary.stars ? "on" : ""} key={star}>★</b>)}</div><small>{data.summary.mastered} / {data.summary.total} {t("published course words", "个已发布课程词条")}</small></div>
      <div className="vm-stat mastered"><i>✓</i><span>{t("Mastered", "学会了")}</span><strong>{data.summary.mastered}</strong></div>
      <div className="vm-stat learning"><i>↻</i><span>{t("Learning", "正在学")}</span><strong>{data.summary.learning}</strong></div>
      <div className="vm-stat new"><i>＋</i><span>{t("Not started", "还未学")}</span><strong>{data.summary.unlearned}</strong></div>
    </section>

    <section className="vm-practice" id="vm-practice" aria-labelledby="vm-practice-title">
      <header><div><p>{data.localDate} · {data.targetLanguage.toUpperCase()}</p><h2 id="vm-practice-title">{t("Today's SmartCard practice", "今日智慧卡练习")}</h2></div><div className="vm-practice-tools"><label><input type="checkbox" checked={repeatAfterMe} onChange={event => setRepeatAfterMe(event.target.checked)}/><span>{t("Three scored repeats (off by default)", "三次跟读评分（默认关闭）")}</span></label><strong>{Math.min(index + 1, cards.length)} <span>/ {cards.length} · {practicePercent}%</span></strong></div></header>
      {card && phase !== "done" ? <div className="vm-card" dir={card.direction} style={{ backgroundImage: `linear-gradient(rgba(3,55,47,.64),rgba(3,55,47,.64)),url('/images/smartcards/learning-world-${timeScene}.jpg')`, backgroundPosition: "center", backgroundSize: "cover", textShadow: "0 3px 14px rgba(0,20,16,.9)" }}>
        <div className="vm-progress" role="progressbar" aria-label={t("Today's card progress", "今日词卡进度")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={practicePercent}><span style={{ width: `${practicePercent}%` }}/></div>
        <div className="vm-card-status"><strong>{card.status === "unlearned" ? t("New word", "新词") : t("Previous mistake", "以前错过")}</strong><span>{t("Difficulty", "难度")} {card.difficulty}/5</span><span>{t("Frequency", "常用度")} {card.frequencyDegree}/10</span></div>
        <div className="vm-card-scene"><span>{SCENES[card.sceneKey] || "✨"}</span><small>{modeLabel[card.mode]} · {t("Memory stage", "记忆阶段")} {card.memoryStage}/5</small></div>
        {phase === "answer" && !revealed ? <div className="vm-study-card">{data.level === "beginner" ? <VocabularyPicture imageKey={beginnerVocabularyImageKey(card.form, card.meaningEn, card.meaningZh)} label={meaning(card)}/> : null}<strong>{card.form}</strong>{card.targetPhonetic ? <b>{card.targetPhonetic}</b> : null}<small>{t("Learn the word, then continue to check its meaning.", "先认识这个词，再继续检查词义。")}</small><button type="button" onClick={() => setRevealed(true)}>{t("Continue", "继续")}</button></div> : phase === "answer" && revealed ? <div className="vm-card-back"><h3>{meaning(card)}</h3></div> : phase === "feedback" ? <div className={`vm-answer-feedback ${answerCorrect ? "correct" : "incorrect"}`} role="status"><strong>{answerCorrect ? `✓ ${t("Correct", "回答正确")}` : `× ${t("Keep learning", "继续学习")}`}</strong><p>{answerCorrect ? t("One retrieval has been recorded.", "已记录一次有效回忆。") : <>{t("Correct answer", "正确答案")}：<b>{card.form}</b> · {meaning(card)}</>}</p><button type="button" onClick={continueAfterFeedback}>{t("Continue", "继续")}</button></div> : card.mode === "listening" ? <div className="vm-speed-controls"><button type="button" onClick={() => playWord(.86)}>🔊 {t("Normal", "正常语速")}</button><button type="button" onClick={() => playWord(.58)}>🐢 {t("Slow", "慢速")}</button></div> : phase !== "sentence" && phase !== "speak" ? <h3>{card.mode === "recall" || textMode ? meaning(card) : card.form}</h3> : null}
        {phase === "answer" ? !revealed ? null : textMode ? <div className="vm-typing"><input value={typed} onChange={event => setTyped(event.target.value)} onKeyDown={event => { if (event.key === "Enter") checkTyped(); }} placeholder={t("Type the target-language word", "输入目标语言词语")}/><button type="button" disabled={!typed.trim() || busy} onClick={checkTyped}>{t("Submit", "提交")}</button></div> : <div className={`vm-options ${data.level === "beginner" ? "vm-picture-options" : ""}`}>{card.options.map(option => <button type="button" aria-pressed={selectedOptionId === option.id} className={selectedOptionId === option.id ? "selected" : ""} disabled={busy} onClick={() => setSelectedOptionId(option.id)} key={option.id}>{data.level === "beginner" ? <VocabularyPicture imageKey={beginnerVocabularyImageKey(option.form, option.meaningEn, option.meaningZh)} label={meaning(option)}/> : null}<span>{card.mode === "recall" ? option.form : meaning(option)}</span></button>)}</div> : phase === "speak" ? <div className="vm-speak">
          <p>{speechMessage}</p><h3>{card.form}</h3>{card.targetPhonetic ? <b>{card.targetPhonetic}</b> : null}<span>{t("Approximate reading aid", "当前语言助读（近似）")} · {card.pronunciationGuides?.[lang] || (zh ? card.pronunciationZh : card.pronunciationEn)}</span>
          <div className="vm-rounds" aria-label={t("Three pronunciation scores", "三次跟读分数")}>{[1,2,3].map(round => <b className={round <= pronunciationScores.length ? "scored" : round === pronunciationRound ? "active" : ""} key={round}>{pronunciationScores[round - 1] ?? round}</b>)}</div>
          {pronunciationScores.length ? <strong className="vm-average">{t("Average", "平均")} {Math.round(pronunciationScores.reduce((sum, score) => sum + score, 0) / pronunciationScores.length)}</strong> : null}
          <nav className="vm-speed-controls" aria-label={t("Model speaking speed", "示范语速")}><button type="button" onClick={() => playWord(.86)}>🔊 {t("Normal", "正常语速")}</button><button type="button" onClick={() => playWord(.58)}>🐢 {t("Slow", "慢速")}</button></nav>
          <div>{coachStatus === "model" || coachStatus === "listening" || coachStatus === "scoring" ? <span role="status">{coachStatus === "listening" ? t("Speak now…", "请开始说…") : coachStatus === "scoring" ? t("Scoring…", "评分中…") : t("Playing model…", "正在播放示范…")}</span> : <button type="button" onClick={() => coachStatus === "complete" && pronunciationScores.length >= 3 ? setPhase("sentence") : void runPronunciationTurn(Math.max(1, pronunciationRound))}>{t("Continue", "继续")}</button>}</div>
        </div> : null}
        {phase === "sentence" ? <SentenceBuilderRound lang={lang as any} mode="writing" speechLocale={SPEECH_LOCALES[data?.targetLanguage || ""] || "en-US"} exercises={[{ ...card.sentence, prompt: zh ? card.sentence.promptZh : card.sentence.promptEn }]} onComplete={nextCard}/> : null}
      </div> : <div className="vm-round-summary" role="dialog" aria-modal="true" aria-labelledby="vm-round-summary-title"><section><span>✦</span><h3 id="vm-round-summary-title">{t("This 20-word round is complete", "本轮 20 个词已完成")}</h3><p>{repeatAfterMe ? t("You completed 20 word checks, three scored repeats per word, and sentence building. Continue with the next 20 words?", "你已完成 20 个词的学习、每词三次评分跟读和组句。要继续下一组 20 个词吗？") : t("You completed 20 word checks and sentence building. Continue with the next 20 words?", "你已完成 20 个词的学习与组句。要继续下一组 20 个词吗？")}</p><nav><button type="button" onClick={continueTwentyWordRound}>{t("Continue", "继续下一组")} →</button><Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>{t("Not now", "暂不继续")}</Link></nav></section></div>}
    </section>

    <section className="vm-library"><header><div><p>{t("VOCABULARY LIBRARY", "词汇库")}</p><h2>{t("My course vocabulary", "我的课程词汇")}</h2></div><div role="tablist">{(["mastered","learning","unlearned"] as Status[]).map(status => <button role="tab" aria-selected={tab === status} className={tab === status ? "active" : ""} onClick={() => { setTab(status); setLibraryPage(1); }} key={status}>{status === "mastered" ? t("Mastered", "学会了") : status === "learning" ? t("Learning", "正在学") : t("Not started", "还未学")} <b>{data.summary[status]}</b></button>)}</div></header>
      <p className="vm-library-note">{t("Twenty words per page. Select any word to start a SmartCard set there. Showing", "每页 20 个词；点击任意词即可从该词开始一组智慧卡。当前显示")} {pageResult.start}–{pageResult.end} / {filtered.length}。</p>
      <div className="vm-word-grid">{pageItems.map(item => <button className="vm-word-start" type="button" onClick={() => void startFromWord(item.id)} disabled={busy} key={item.id}><span>{SCENES[item.sceneKey] || "Aa"}</span><div><strong dir={item.direction}>{item.form}</strong>{item.targetPhonetic ? <small>{item.targetPhonetic}</small> : null}<p>{meaning(item)}</p><em>{t("Difficulty", "难度")} {item.difficulty}/5 · {t("Frequency", "常用度")} {item.frequencyDegree}/10</em></div></button>)}</div>
      <nav className="vm-pagination" aria-label={t("Vocabulary pages", "词汇分页")}><button type="button" disabled={visiblePage <= 1} onClick={() => setLibraryPage(page => Math.max(1, page - 1))}>← {t("Previous", "上一页")}</button><span>{visiblePage} / {pageCount}</span><button type="button" disabled={visiblePage >= pageCount} onClick={() => setLibraryPage(page => Math.min(pageCount, page + 1))}>{t("Next", "下一页")} →</button></nav>
    </section>

    <section className="vm-report"><header><p>{t("21-DAY REPORT", "21 天报告")}</p><h2>{t("Daily vocabulary growth", "每日词汇成长报告")}</h2></header><div>{data.reports.map(report => <article key={report.localDate}><time>{report.localDate.slice(5)}</time><span><i style={{ width: `${report.percent}%` }}/></span><strong>{report.percent}%</strong><small>{report.mastered} / {report.learning} / {report.unlearned}</small></article>)}</div><footer><span>● {t("Mastered", "学会了")}</span><span>↻ {t("Learning", "正在学")}</span><span>○ {t("Not started", "还未学")}</span></footer></section>
    </> : null}
    {!data && !error ? <p className="vm-loading">{t("Preparing today's cards…", "正在整理今天的词卡…")}</p> : null}{error ? <p className="vm-error" role="alert">{error}</p> : null}
    <style>{`.vm-speak>.vm-rounds{margin-top:18px}.vm-rounds b{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.45);border-radius:50%;background:rgba(255,255,255,.12)}.vm-rounds b.active{outline:3px solid #ffe69a;background:#b57514}.vm-rounds b.scored{background:#fff;color:#0a5e4c}.vm-average{display:block;margin-top:12px;font-size:24px}`}</style>
    <style>{`.vm-card-status{margin-top:18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.vm-card-status strong,.vm-card-status span{padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.15);font-size:12px;font-weight:950;letter-spacing:.04em}.vm-card-status strong{background:#f1b647;color:#18332b;text-transform:uppercase;text-shadow:none}.vm-study-card{width:100%;min-height:260px;margin:24px 0;padding:28px;display:grid;place-items:center;align-content:center;gap:10px;border:1px solid rgba(255,255,255,.4);border-radius:20px;background:rgba(255,255,255,.12);color:#fff}.vm-study-card strong{font-size:clamp(38px,7vw,76px);overflow-wrap:anywhere}.vm-study-card b,.vm-study-card small{color:#d0e7df}.vm-study-card button,.vm-step-action button,.vm-answer-feedback button{min-width:160px;min-height:52px;margin-top:14px;padding:10px 20px;border:0;border-radius:15px;background:#fff;color:#09634f;font-weight:950}.vm-card-back{text-align:center}.vm-card-back h3{font-size:clamp(35px,6vw,64px)}.vm-options button.selected{border-color:#91f1ce;background:#fff;color:#09634f;outline:3px solid #69d6b1}.vm-step-action{max-width:none;margin-top:18px;padding:18px 0 0;display:flex;justify-content:flex-end;border-top:1px solid rgba(255,255,255,.3)}.vm-step-action button:disabled{opacity:.42}.vm-answer-feedback{margin-top:28px;padding:24px;border-radius:18px;background:#dff9e9;color:#075c48;text-align:left;text-shadow:none}.vm-answer-feedback.incorrect{background:#ffe3df;color:#9b3027}.vm-answer-feedback>strong{font-size:25px}.vm-answer-feedback p{line-height:1.6}.vm-answer-feedback button{display:block;margin-left:auto;background:#087d62;color:#fff}.vm-answer-feedback.incorrect button{background:#d84a3d}.vm-speed-controls{margin:22px 0;display:flex;justify-content:center;gap:10px}.vm-speed-controls button{min-height:50px;padding:11px 16px;border:1px solid rgba(255,255,255,.48);border-radius:14px;background:rgba(255,255,255,.14);color:#fff;font-weight:900}.vm-speak>.vm-speed-controls{margin-top:18px}@media(max-width:600px){.vm-card-status{align-items:stretch}.vm-card-status strong,.vm-card-status span{flex:1;text-align:center}.vm-step-action button,.vm-answer-feedback button{width:100%}.vm-speed-controls{display:grid;grid-template-columns:1fr 1fr}}`}</style>
    <style>{`.vm-practice-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}.vm-practice-tools>label{display:flex;align-items:center;gap:7px;color:#4a6259;font-size:12px;font-weight:850}.vm-practice-tools>label input{width:18px;height:18px;accent-color:#087d62}.vm-practice-tools>strong{font-size:34px;color:#087d62}.vm-practice-tools>strong span{color:#8a9691;font-size:17px}.vm-study-card .vocabulary-picture{width:min(220px,60vw);height:min(220px,60vw);display:block;border-radius:22px;background-color:#edf7f2;box-shadow:0 16px 36px rgba(0,0,0,.18);text-shadow:none}.vm-picture-options button{display:grid;grid-template-columns:94px 1fr;align-items:center;gap:14px;text-align:left}.vm-picture-options .vocabulary-picture{width:94px;height:94px;display:block;border-radius:14px;background-color:#edf7f2;text-shadow:none}.vm-library-note{margin:20px 0 0;color:#60716b;line-height:1.6}.vm-word-grid .vm-word-start{min-width:0;padding:17px;display:flex;gap:13px;border:1px solid #d8e1dd;border-radius:16px;background:#fff;color:inherit;text-align:left;font:inherit;cursor:pointer}.vm-word-grid .vm-word-start:hover,.vm-word-grid .vm-word-start:focus-visible{border-color:#087d62;background:#effaf5;transform:translateY(-2px)}.vm-word-grid .vm-word-start:disabled{opacity:.55}.vm-word-grid .vm-word-start>span{font-size:28px}.vm-word-grid .vm-word-start>div{min-width:0}.vm-pagination{margin-top:20px;display:flex;align-items:center;justify-content:center;gap:14px}.vm-pagination button{min-height:44px;padding:0 17px;border:1px solid #b9cec5;border-radius:999px;background:#fff;color:#08745e;font-weight:850}.vm-pagination button:disabled{opacity:.4}.vm-pagination span{font-weight:900}@media(max-width:600px){.vm-practice>header{align-items:flex-start;flex-direction:column}.vm-practice-tools{width:100%;justify-content:space-between}.vm-picture-options button{grid-template-columns:76px 1fr}.vm-picture-options .vocabulary-picture{width:76px;height:76px}}`}</style>
    <style>{`.vm-round-summary{position:fixed;z-index:1000;inset:0;padding:18px;display:grid;place-items:center;background:rgba(5,29,24,.75)}.vm-round-summary>section{width:min(560px,100%);padding:clamp(28px,5vw,48px);border-radius:26px;background:#f7f3ea;color:#17342c;text-align:center}.vm-round-summary>section>span{font-size:64px;color:#e5a326}.vm-round-summary h3{font-size:clamp(30px,5vw,48px)}.vm-round-summary p{line-height:1.7}.vm-round-summary nav{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}.vm-round-summary button,.vm-round-summary a{min-height:52px;padding:12px;display:grid;place-items:center;border:1px solid #a9c2b8;border-radius:14px;background:#fff;color:#17342c;font-weight:900;text-decoration:none}.vm-round-summary button{border:0;background:#087d62;color:#fff}@media(max-width:560px){.vm-round-summary nav{grid-template-columns:1fr}}`}</style>
    <style>{styles}</style>
  </section>;
}

const styles = `.vocabulary-memory-page{min-height:100vh;background:linear-gradient(180deg,#eef9f4 0,#fbf7ed 36%,#f5efe4 100%)}.vm-shell,.vm-shell *{box-sizing:border-box}.vm-shell{width:min(1220px,calc(100% - 32px));margin:0 auto;padding:52px 0 100px;color:#12202a}.vm-hero{display:flex;justify-content:space-between;gap:28px;align-items:flex-start;padding:42px;border-radius:28px;background:#123f35;color:#fff;box-shadow:0 26px 70px rgba(18,63,53,.2)}.vm-hero p,.vm-practice header p,.vm-library header p,.vm-report header p{margin:0;color:#63d4b0;font-size:11px;font-weight:950;letter-spacing:.13em}.vm-hero h1{max-width:800px;margin:12px 0;font-size:clamp(35px,5vw,64px);line-height:1.04;letter-spacing:-.045em}.vm-hero span{display:block;max-width:760px;color:#c7dbd4;line-height:1.65}.vm-hero>a{padding:11px 16px;border:1px solid #588078;border-radius:999px;color:#fff;white-space:nowrap}.vm-dashboard{margin-top:20px;display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:12px}.vm-score,.vm-stat{min-width:0;padding:23px;border:1px solid #d4dfda;border-radius:20px;background:#fff}.vm-score{display:grid;grid-template-columns:auto auto;align-items:center}.vm-score>span{font-weight:900}.vm-score>strong{grid-row:span 2;font-size:clamp(40px,5vw,66px);text-align:right}.vm-score>div{color:#d7d6ce;font-size:20px;letter-spacing:2px}.vm-score b.on{color:#f2a331}.vm-score small{grid-column:1/-1;margin-top:9px;color:#65736e}.vm-stat{display:grid;grid-template-columns:auto 1fr;gap:6px 10px}.vm-stat i{grid-row:span 2;width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#e5f5ee;color:#087d62;font-style:normal;font-weight:950}.vm-stat span{color:#63726d;font-size:13px}.vm-stat strong{font-size:30px}.vm-stat.learning i{background:#fff0d5;color:#9a6000}.vm-stat.new i{background:#edf0f2;color:#56636a}.vm-practice,.vm-library,.vm-report{margin-top:20px;padding:clamp(22px,4vw,42px);border:1px solid #d4dfda;border-radius:26px;background:rgba(255,255,255,.92)}.vm-practice>header,.vm-library>header,.vm-report>header{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.vm-practice h2,.vm-library h2,.vm-report h2{margin:7px 0 0;font-size:clamp(27px,4vw,43px)}.vm-practice>header>strong{font-size:34px;color:#087d62}.vm-practice>header>strong span{color:#8a9691;font-size:17px}.vm-card{margin-top:24px;padding:clamp(22px,4vw,42px);position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(145deg,#0b4d41,#147b61);color:#fff;box-shadow:0 18px 45px rgba(7,64,52,.2);transition:background .25s}.vm-card.tries-1{background:linear-gradient(145deg,#765315,#b97b16)}.vm-card.tries-2,.vm-card.tries-3{background:linear-gradient(145deg,#74392f,#a85a45)}.vm-progress{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.2)}.vm-progress span{height:100%;display:block;border-radius:inherit;background:#74e3bd}.vm-card-scene{margin-top:24px;display:flex;justify-content:space-between;align-items:center;gap:14px}.vm-card-scene>span{font-size:38px}.vm-card-scene small{color:#d0e7df;font-weight:800}.vm-card>h3,.vm-speak>h3{margin:26px auto;text-align:center;font-size:clamp(38px,7vw,76px);line-height:1.15;overflow-wrap:anywhere}.vm-hint{padding:12px 15px;border-radius:12px;background:rgba(255,255,255,.13);text-align:center}.vm-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vm-options button,.vm-typing button,.vm-listen-prompt,.vm-speak button{min-height:54px;padding:13px 17px;border:1px solid rgba(255,255,255,.38);border-radius:15px;background:rgba(255,255,255,.12);color:#fff;font:850 16px/1.35 inherit;cursor:pointer}.vm-options button:disabled{opacity:.34;text-decoration:line-through}.vm-listen-prompt{width:min(360px,100%);margin:35px auto;display:block;background:#fff;color:#0a5e4c}.vm-typing{display:grid;grid-template-columns:1fr auto;gap:10px}.vm-typing input{min-width:0;padding:15px;border:0;border-radius:14px;font:18px inherit}.vm-speak{text-align:center}.vm-speak>p{padding:12px;border-radius:12px;background:rgba(255,255,255,.12)}.vm-speak>h3{margin-bottom:6px}.vm-speak>b,.vm-speak>span{display:block;margin-top:7px}.vm-speak>span{color:#d2e8e0}.vm-speak>div{margin-top:25px;display:flex;justify-content:center;gap:10px}.vm-speak button:last-child{background:#fff;color:#0a5e4c}.vm-complete{margin-top:24px;padding:55px 20px;text-align:center;border-radius:22px;background:#e5f6ee}.vm-complete>span{font-size:55px;color:#e49b2d}.vm-complete h3{font-size:30px}.vm-library>header{align-items:center;flex-wrap:wrap}.vm-library header>div:last-child{display:flex;gap:7px;flex-wrap:wrap}.vm-library [role=tab]{padding:10px 14px;border:1px solid #c9d8d2;border-radius:999px;background:#fff;font-weight:850}.vm-library [role=tab].active{border-color:#087d62;background:#e2f5ed;color:#08745e}.vm-library [role=tab] b{margin-left:6px}.vm-word-grid{margin-top:22px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.vm-word-grid article{min-width:0;padding:17px;display:flex;gap:13px;border:1px solid #d8e1dd;border-radius:16px;background:#fff}.vm-word-grid article>span{font-size:28px}.vm-word-grid article>div{min-width:0}.vm-word-grid strong,.vm-word-grid small{display:block;overflow-wrap:anywhere}.vm-word-grid strong{font-size:21px}.vm-word-grid small{margin-top:3px;color:#6b7974}.vm-word-grid p{margin:9px 0;line-height:1.4}.vm-word-grid em{color:#087d62;font-size:12px;font-style:normal;font-weight:850}.vm-report>div{margin-top:22px;display:grid;gap:9px}.vm-report article{display:grid;grid-template-columns:55px minmax(90px,1fr) 50px 130px;align-items:center;gap:12px}.vm-report article>span{height:9px;overflow:hidden;border-radius:99px;background:#e2e8e5}.vm-report article i{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,#0b9473,#69d9b5)}.vm-report article small{text-align:right;color:#65736e}.vm-report footer{max-width:none;padding:18px 0 0;border:0;display:flex;gap:18px;color:#65736e;font-size:12px}.vm-loading,.vm-error{margin-top:20px;padding:18px;border-radius:14px;background:#fff}.vm-error{background:#fff0ed;color:#973e35}@media(max-width:900px){.vm-dashboard{grid-template-columns:1fr 1fr}.vm-score{grid-column:1/-1}.vm-word-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.vm-shell{width:calc(100% - 24px);padding-top:24px}.vm-hero{padding:26px;display:grid}.vm-dashboard{grid-template-columns:1fr}.vm-score{grid-column:auto}.vm-practice,.vm-library,.vm-report{padding:19px}.vm-options,.vm-word-grid{grid-template-columns:1fr}.vm-speak>div{display:grid}.vm-report article{grid-template-columns:45px 1fr 44px}.vm-report article small{grid-column:2/-1;text-align:left}.vm-report footer{flex-wrap:wrap}.vm-typing{grid-template-columns:1fr}.vm-hero>a{justify-self:start}}`;
