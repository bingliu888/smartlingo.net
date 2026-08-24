"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SentenceBuilderRound } from "./SentenceBuilderRound";
import { useRepeatAfterMePreference } from "./useRepeatAfterMePreference";

type Lang = "zh" | "en";
type Skill = "vocabulary" | "reading" | "writing" | "listening" | "dialogue";
type Status = "mastered" | "learning" | "unlearned";
type Option = { id: string; form: string; meaningEn: string; meaningZh: string };
type Card = {
  stableId?: string; id?: string; form: string; pronunciation: string; targetPhonetic?: string;
  pronunciationEn?: string; pronunciationZh?: string; pronunciationGuides?: Record<string, string>;
  meaning?: { zh: string; en: string }; meaningEn?: string; meaningZh?: string;
  sceneKey?: string; options?: Option[]; direction?: "ltr" | "rtl"; difficulty?: number; frequencyDegree?: number;
};
type LibraryItem = { id: string; form: string; targetPhonetic: string; meaningEn: string; meaningZh: string; sceneKey: string; direction: "ltr" | "rtl"; difficulty?: number; frequencyDegree?: number };
type TrialPayload = { localDate: string; summary: { total: number }; dailyDeck: Card[]; items: LibraryItem[]; error?: string };
type Task = { taskId: string; skill: Skill; prompt: string; context?: string; audioText?: string; options?: readonly { id: string; label: string }[]; sentenceExercises?: readonly { id: string; scenario: string; prompt: string; audioText?: string; answerTokens: readonly string[]; sourceLanguage?: string; answerLanguage?: string }[]; direction?: "ltr" | "rtl" };
type RecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null };
type TrialProgress = {
  index: number;
  phase: "study" | "feedback" | "sentence" | "done";
  answerPoints?: number;
  correct?: boolean;
  scores?: number[];
};

const SKILLS: Skill[] = ["vocabulary", "reading", "writing", "listening", "dialogue"];
const ACCENTS: Record<Skill, string> = { vocabulary: "#0a8e6f", reading: "#2f6fbb", writing: "#ad642d", listening: "#7a5aad", dialogue: "#c74455" };
const SCENES: Record<string, string> = { greetings: "☀️", introductions: "👋", transport: "🚆", directions: "🧭", restaurant: "🍜", shopping: "🛍️", help: "🛟" };
function normalized(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[\s.,!?！？。，、'’"“”]+/gu, ""); }
function speechScore(expected: string, heard: string) {
  const left = normalized(expected), right = normalized(heard);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 82;
  let same = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) if (left[index] === right[index]) same += 1;
  return Math.max(25, Math.round(same * 100 / Math.max(left.length, right.length)));
}
function seedDeck(cards: readonly Card[]) {
  return cards.map((card, index) => {
    const id = card.id || card.stableId || `seed-${index}`;
    const alternatives = cards.filter(candidate => candidate !== card).slice(index % Math.max(1, cards.length - 1), index % Math.max(1, cards.length - 1) + 3);
    const choices = alternatives.length === 3 ? alternatives : cards.filter(candidate => candidate !== card).slice(0, 3);
    return {
      ...card, id,
      options: [card, ...choices].map((option, optionIndex) => ({
        id: option === card ? id : option.id || option.stableId || `seed-option-${index}-${optionIndex}`,
        form: option.form,
        meaningEn: option.meaningEn || option.meaning?.en || "",
        meaningZh: option.meaningZh || option.meaning?.zh || "",
      })),
    };
  });
}

function readTrialProgress(key: string) {
  const value = document.cookie.split("; ").find(item => item.startsWith(`${key}=`))?.split("=").slice(1).join("=");
  if (!value) return { index: 0, phase: "study" } satisfies TrialProgress;
  const decoded = decodeURIComponent(value);
  const legacyIndex = Number(decoded);
  if (Number.isFinite(legacyIndex)) return { index: Math.max(0, Math.floor(legacyIndex)), phase: "study" } satisfies TrialProgress;
  try {
    const parsed = JSON.parse(decoded) as Partial<TrialProgress>;
    const phase = parsed.phase === "feedback" || parsed.phase === "sentence" || parsed.phase === "done" ? parsed.phase : "study";
    return {
      index: Number.isFinite(parsed.index) ? Math.max(0, Math.floor(parsed.index || 0)) : 0,
      phase,
      answerPoints: Number.isFinite(parsed.answerPoints) ? Math.max(0, Math.floor(parsed.answerPoints || 0)) : undefined,
      correct: typeof parsed.correct === "boolean" ? parsed.correct : undefined,
      scores: Array.isArray(parsed.scores) ? parsed.scores.filter(value => Number.isFinite(value)).map(value => Math.max(0, Math.floor(value))).slice(0, 20) : undefined,
    } satisfies TrialProgress;
  } catch {
    return { index: 0, phase: "study" } satisfies TrialProgress;
  }
}

function writeTrialProgress(key: string, value: TrialProgress) {
  document.cookie = `${key}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=2592000; Path=/; SameSite=Lax`;
}

export function AnonymousBeginnerTrial({ lang, language, languageName, speechLocale, direction, cards: seedCards, tasks, initialSkill = "vocabulary", lockedSkill = false, classId }: {
  lang: Lang; language: string; languageName: string; speechLocale: string; direction: "ltr" | "rtl"; cards: readonly Card[]; tasks: readonly Task[];
  initialSkill?: Skill; lockedSkill?: boolean; classId?: string;
}) {
  const zh = lang === "zh";
  const [active, setActive] = useState<Skill>(initialSkill);
  const [completed, setCompleted] = useState<Skill[]>([]);
  const [cards, setCards] = useState<Card[]>(() => seedDeck(seedCards));
  const [catalog, setCatalog] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(1000);
  const [localDate, setLocalDate] = useState("");
  const [loadingWords, setLoadingWords] = useState(true);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"study" | "answer" | "feedback" | "speak" | "sentence" | "done">("study");
  const [revealed, setRevealed] = useState(false);
  const [tries, setTries] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [reportTab, setReportTab] = useState<Status>("unlearned");
  const [libraryPage, setLibraryPage] = useState(1);
  const [speechRound, setSpeechRound] = useState(0);
  const [speechMessage, setSpeechMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [answerPoints, setAnswerPoints] = useState(0);
  const [cardScores, setCardScores] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [repeatAfterMe, setRepeatAfterMe] = useRepeatAfterMePreference();
  const progressCookie = `smartlingo_trial_${classId || language}_${initialSkill}`;
  const task = useMemo(() => tasks.find(item => item.skill === active), [active, tasks]);
  const vocabularySentences = useMemo(() => tasks.find(item => item.skill === "writing")?.sentenceExercises || [], [tasks]);
  const vocabularySentence = vocabularySentences[index % Math.max(1, vocabularySentences.length)];
  const card = cards[index];
  const cardId = card?.id || card?.stableId || "";
  const meaning = card ? (zh ? card.meaningZh || card.meaning?.zh : card.meaningEn || card.meaning?.en) || "" : "";
  const counts = useMemo(() => catalog.reduce((all, item) => { all[statuses[item.id] || "unlearned"] += 1; return all; }, { mastered: 0, learning: 0, unlearned: 0 }), [catalog, statuses]);
  const pendingAnswerScore = answerPoints > 0 && (phase === "feedback" || phase === "sentence" || phase === "speak") ? answerPoints : 0;
  const visibleScores = pendingAnswerScore ? [...cardScores, pendingAnswerScore] : cardScores;
  const score = visibleScores.length ? Math.round(visibleScores.reduce((sum, value) => sum + value, 0) / visibleScores.length) : 0;
  const filteredWords = catalog.filter(item => (statuses[item.id] || "unlearned") === reportTab);
  const pageCount = Math.max(1, Math.ceil(filteredWords.length / 20));
  const visiblePage = Math.min(libraryPage, pageCount);
  const pageWords = filteredWords.slice((visiblePage - 1) * 20, visiblePage * 20);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/vocabulary/trial?language=${encodeURIComponent(language)}`, { method: "GET", cache: "no-store", signal: controller.signal })
      .then(async response => ({ response, payload: await response.json().catch(() => ({})) as TrialPayload }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.dailyDeck?.length) throw new Error(payload.error || "LOAD_FAILED");
        setCards(payload.dailyDeck); setCatalog(payload.items); setTotal(payload.summary.total); setLocalDate(payload.localDate);
      }).catch(() => { /* Keep the server-rendered ten-card seed if the read-only catalog cannot load. */ })
      .finally(() => setLoadingWords(false));
    return () => controller.abort();
  }, [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readTrialProgress(progressCookie);
      if (!cards.length || (!saved.index && saved.phase === "study")) return;
      setIndex(Math.min(saved.index, Math.max(0, cards.length - 1)));
      setCardScores(saved.scores || []);
      setAnswerPoints(saved.answerPoints || 0);
      if (saved.phase === "feedback") {
        setRevealed(true);
        setPhase("feedback");
        setSpeechMessage(saved.correct
          ? (zh ? `回答正确！答题 ${saved.answerPoints || 0} 分。` : `Correct! ${saved.answerPoints || 0} answer points.`)
          : (zh ? `正确答案是：${meaning}。` : `The answer is: ${meaning}.`));
      } else if (saved.phase === "sentence") {
        setRevealed(true);
        setPhase("sentence");
      } else if (saved.phase === "done") {
        setRevealed(true);
        setPhase("done");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cards.length, meaning, progressCookie, zh]);

  const labels: Record<Skill, [string, string, string]> = {
    vocabulary: ["词汇", "Vocabulary", "智慧卡与实用表达"], reading: ["阅读", "Reading", "理解真实语境"], writing: ["写作", "Writing", "组织简短表达"], listening: ["听力", "Listening", "听辨语音与含义"], dialogue: ["口语", "Speaking", "自然开口回应"],
  };
  function markComplete(skill: Skill) { setCompleted(current => current.includes(skill) ? current : [...current, skill]); }
  function play(text: string, after?: () => void) {
    if (!("speechSynthesis" in window) || !text) { after?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = speechLocale; utterance.rate = .76;
    utterance.onend = () => after?.(); utterance.onerror = () => after?.(); window.speechSynthesis.speak(utterance);
  }
  function finishAnswer(correct: boolean) {
    const points = correct ? Math.max(40, 70 - tries * 15) : 20;
    setAnswerPoints(points); setPhase("feedback");
    setSpeechMessage(correct ? (zh ? `回答正确！答题 ${points} 分。` : `Correct! ${points} answer points.`) : (zh ? `正确答案是：${meaning}。` : `The answer is: ${meaning}.`));
    writeTrialProgress(progressCookie, { index, phase: "feedback", answerPoints: points, correct, scores: cardScores });
  }
  function choose(optionId: string) {
    if (!card || phase !== "answer" || wrongIds.includes(optionId)) return;
    if (optionId === cardId) { finishAnswer(true); return; }
    const next = tries + 1; setTries(next); setWrongIds(current => [...current, optionId]);
    setSpeechMessage(next === 1 ? (zh ? "不对，场景图标会给你提示。" : "Not yet. The scene icon is a hint.") : next === 2 ? (zh ? `再提示：答案以“${meaning.slice(0, 1)}”开头。` : `Another hint: the answer starts with “${meaning.slice(0, 1)}”.`) : "");
    if (next >= 3) finishAnswer(false);
  }
  function nextCard(speech = 0) {
    if (cardId) setStatuses(current => ({ ...current, [cardId]: "learning" }));
    const nextScores = [...cardScores, Math.round(answerPoints * .7 + speech * .3)];
    setCardScores(nextScores);
    if (index + 1 >= cards.length) { writeTrialProgress(progressCookie, { index, phase: "done", scores: nextScores }); setPhase("done"); markComplete("vocabulary"); return; }
    writeTrialProgress(progressCookie, { index: index + 1, phase: "study", scores: nextScores });
    setIndex(current => current + 1); setPhase("study"); setRevealed(false); setTries(0); setWrongIds([]); setSpeechRound(0); setSpeechMessage(""); setAnswerPoints(0);
  }
  function continueAnswer() {
    if (repeatAfterMe) {
      setPhase("speak"); setSpeechRound(1);
      setSpeechMessage(zh ? "第 1/3 次：先听 AI，再开口。" : "Round 1/3: listen to AI, then speak.");
      window.setTimeout(() => startSpeech(1), 250);
      return;
    }
    if (vocabularySentence) {
      writeTrialProgress(progressCookie, { index, phase: "sentence", answerPoints, scores: cardScores });
      setPhase("sentence");
    }
    else nextCard(0);
  }
  function startSpeech(round = speechRound) {
    if (!card || listening) return;
    const browser = window as typeof window & { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) { setSpeechMessage(zh ? "此浏览器不能自动评分。跟读后点“我已跟读”即可继续。" : "Automatic scoring is unavailable. Repeat, then select “I repeated”."); return; }
    const recognition = new Recognition(); recognition.lang = speechLocale; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = event => {
      setListening(false); const heard = String(event.results?.[0]?.[0]?.transcript || ""); const result = speechScore(card.form, heard);
      setSpeechMessage(`${zh ? `听到“${heard}”` : `Heard “${heard}”`} · ${result}${zh ? " 分" : " points"}`);
      if (round >= 3) window.setTimeout(() => vocabularySentence ? setPhase("sentence") : nextCard(result), 900); else {
        const nextRound = round + 1;
        setSpeechRound(nextRound);
        window.setTimeout(() => startSpeech(nextRound), 900);
      }
    };
    recognition.onerror = () => { setListening(false); setSpeechMessage(zh ? "没有听清或麦克风未获允许。请在网站设置中允许麦克风后重试，也可点“我已跟读”。" : "I could not hear you or microphone access was denied. Allow it in site settings and retry, or select “I repeated”."); };
    setSpeechMessage(zh ? `第 ${round}/3 次：先听 AI，再开口。` : `Round ${round}/3: listen to AI, then speak.`);
    play(card.form, () => { setListening(true); try { recognition.start(); } catch { setListening(false); } });
  }
  async function loadTrialWords(startWordId = "") {
    const query = new URLSearchParams({ language });
    if (startWordId) query.set("startWordId", startWordId);
    const response = await fetch(`/api/vocabulary/trial?${query}`, { method: "GET", cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as TrialPayload;
    if (!response.ok || !payload.dailyDeck?.length) return;
    setCards(payload.dailyDeck); setCatalog(payload.items); setTotal(payload.summary.total); setLocalDate(payload.localDate);
    setIndex(0); setPhase("study"); setRevealed(false); setTries(0); setWrongIds([]); setSpeechRound(0); setSpeechMessage(""); setAnswerPoints(0);
    writeTrialProgress(progressCookie, { index: 0, phase: "study" });
    document.querySelector(".trial-activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function continueTrialWords() {
    const lastId = cards.at(-1)?.id;
    const position = lastId ? catalog.findIndex(item => item.id === lastId) : -1;
    const next = catalog[position + 1] || catalog[0];
    if (next) void loadTrialWords(next.id);
  }

  const answer = task ? answers[task.taskId] || "" : "";
  return <section className="trial-shell" data-layout-fill="anonymous-trial" data-layout-ready="true" data-layout-overlap-check="anonymous-trial">
    <header className="trial-hero" data-layout-fill="anonymous-trial-hero"><div data-readable-copy="anonymous-trial-intro"><p>FREE TRIAL · BEGINNER</p><h1 data-layout-text-fit="anonymous-trial-title">{languageName} · {zh ? "初级课程试学" : "Beginner course trial"}</h1><span>{zh ? "无需登录即可体验。正式 Beginner 词库只读加载；本功能用独立 Cookie 保存当前学习位置，不会写入账户或其他学习功能。" : "Try without signing in. The published Beginner catalog is read-only; a feature-specific cookie keeps your place without writing to an account or another activity."}</span></div><aside><strong>{score}</strong><span>{zh ? "今日进度分 · 最高 100" : "Daily progress score · 100 max"}</span></aside></header>
    <label className="trial-repeat-check"><input type="checkbox" checked={repeatAfterMe} onChange={event => setRepeatAfterMe(event.target.checked)}/><span><b>{zh ? "开启三次跟读与评分" : "Repeat after me three times with scoring"}</b><small>{zh ? "默认关闭；需要口语训练时再开启麦克风。" : "Off by default. Enable it only when you want microphone practice."}</small></span></label>
    {!lockedSkill ? <nav className="trial-tabs" data-layout-fill="anonymous-trial-tabs" aria-label={zh ? "试学训练项目" : "Trial activities"}>{SKILLS.map(skill => <button className={active === skill ? "active" : ""} onClick={() => setActive(skill)} key={skill}><i>{completed.includes(skill) ? "✓" : String(SKILLS.indexOf(skill) + 1).padStart(2, "0")}</i><span><strong>{zh ? labels[skill][0] : labels[skill][1]}</strong><small>{labels[skill][2]}</small></span></button>)}</nav> : null}
    <article className="trial-activity" style={{ "--trial-accent": ACCENTS[active] } as CSSProperties}><header><div><span>{String(SKILLS.indexOf(active) + 1).padStart(2, "0")}</span><h2>{zh ? labels[active][0] : labels[active][1]}</h2></div>{active === "vocabulary" ? <a href="#trial-vocabulary-report">{zh ? "查看词汇报告" : "View vocabulary report"} ↓</a> : null}</header>
      {active === "vocabulary" && card ? <div className={`trial-card tries-${tries}`} dir={card.direction || direction}><div className="trial-progress"><span style={{ width: `${Math.round((index + 1) * 100 / Math.max(1, cards.length))}%` }}/></div><p>{index + 1} / {cards.length} · {zh ? `Beginner 共 ${total.toLocaleString()} 词` : `${total.toLocaleString()} Beginner words`}</p>
        <button className="trial-flip" type="button" onClick={phase === "study" ? () => { setRevealed(true); setPhase("answer"); } : undefined}><span>{SCENES[card.sceneKey || ""] || "✨"}</span><strong>{revealed ? meaning : card.form}</strong>{!revealed ? <em>{card.targetPhonetic || card.pronunciation}</em> : <em>{zh ? `难度 ${card.difficulty || 1}/5 · 常用度 ${card.frequencyDegree || 10}/10` : `Difficulty ${card.difficulty || 1}/5 · Frequency ${card.frequencyDegree || 10}/10`}</em>}<small>{revealed ? (zh ? "已查看释义，请回答下面的问题" : "Meaning revealed. Answer below.") : (zh ? "点一下查看意思" : "Tap to see the meaning")}</small></button>
        {phase === "answer" ? <section className="trial-quiz"><h3>{zh ? "这个词是什么意思？" : "What does this word mean?"}</h3><div>{(card.options || []).map(option => <button disabled={wrongIds.includes(option.id)} onClick={() => choose(option.id)} key={option.id}>{zh ? option.meaningZh : option.meaningEn}</button>)}</div>{speechMessage ? <p>{speechMessage}</p> : null}</section> : null}
        {phase === "feedback" ? <section className="trial-feedback" role="status"><strong>{speechMessage}</strong><button type="button" onClick={continueAnswer}>{zh ? "继续" : "Continue"} →</button></section> : null}
        {phase === "speak" ? <section className="trial-speech"><div className="trial-avatar">AI</div><div><h3>{zh ? `请跟我说：${card.form}` : `Repeat after me: ${card.form}`}</h3><b>{card.targetPhonetic || card.pronunciation}</b><span>{card.pronunciationGuides?.[lang] || (zh ? card.pronunciationZh : card.pronunciationEn)}</span><p>{speechMessage}</p><strong>{speechRound} / 3</strong><small>{listening ? (zh ? "请开始说…" : "Speak now…") : (zh ? "AI 将自动播放、聆听并评分" : "AI plays, listens, and scores automatically")}</small></div></section> : null}
        {phase === "sentence" && vocabularySentence ? <SentenceBuilderRound lang={lang} mode="writing" speechLocale={speechLocale} exercises={[vocabularySentence]} onComplete={() => nextCard(60)}/> : null}
        {phase === "done" ? <section className="trial-complete-card" role="dialog" aria-modal="true"><strong>★ {score}</strong><h3>{zh ? "本轮 20 个词已完成！" : "This 20-word round is complete!"}</h3><p>{repeatAfterMe ? (zh ? "已完成答题、三次跟读和句子组句。要继续下一组 20 个词吗？" : "You completed answers, three repeats, and sentence building. Continue with the next 20 words?") : (zh ? "已完成答题和句子组句。要继续下一组 20 个词吗？" : "You completed answers and sentence building. Continue with the next 20 words?")}</p><nav><button type="button" onClick={continueTrialWords}>{zh ? "继续下一组" : "Continue"} →</button><Link href={`/${lang}/play?language=${language}`}>{zh ? "暂不继续" : "Not now"}</Link></nav></section> : null}
      </div> : null}
      {active !== "vocabulary" && task ? <div className="trial-task" dir={task.direction || direction}><p>{zh ? "今日练习" : "TODAY'S PRACTICE"}</p><h3>{task.prompt}</h3>{task.context ? <blockquote>{task.context}</blockquote> : null}{task.audioText && !task.sentenceExercises?.length ? <button className="trial-audio" onClick={() => play(task.audioText || "")}>▶ {zh ? "播放练习音频" : "Play practice audio"}</button> : null}{(active === "listening" || active === "writing") && task.sentenceExercises?.length ? <SentenceBuilderRound lang={lang} mode={active} speechLocale={speechLocale} exercises={task.sentenceExercises} onComplete={serialized => setAnswers(current => ({ ...current, [task.taskId]: serialized }))}/> : task.options?.length ? <div className="trial-options">{task.options.map(option => <button className={answer === option.id ? "selected" : ""} onClick={() => setAnswers(current => ({ ...current, [task.taskId]: option.id }))} key={option.id}>{option.label}</button>)}</div> : <label><span>{zh ? "您的回答" : "Your response"}</span><textarea value={answer} onChange={event => setAnswers(current => ({ ...current, [task.taskId]: event.target.value }))}/></label>}<button className="trial-complete" disabled={!answer.trim()} onClick={() => markComplete(active)}>{completed.includes(active) ? (zh ? "✓ 已完成" : "✓ Completed") : (zh ? "完成本项练习" : "Complete activity")}</button></div> : null}
    </article>
    {active === "vocabulary" ? <section className="trial-report" id="trial-vocabulary-report"><header><div><p>{localDate || (zh ? "本次试学" : "This trial")}</p><h2>{zh ? "词汇学习报告" : "Vocabulary learning report"}</h2></div><aside><span>{zh ? "今日进度分" : "Daily score"}</span><strong>{score}</strong></aside></header><div className="trial-stats"><article><span>{zh ? "学会了" : "Mastered"}</span><strong>{counts.mastered}</strong></article><article><span>{zh ? "正在学" : "Learning"}</span><strong>{counts.learning}</strong></article><article><span>{zh ? "还未学" : "Pending"}</span><strong>{catalog.length ? counts.unlearned : total}</strong></article><article><span>{zh ? "学会比例" : "Mastery"}</span><strong>0%</strong><small>☆☆☆☆☆</small></article></div><nav role="tablist">{(["mastered", "learning", "unlearned"] as Status[]).map(status => <button role="tab" aria-selected={reportTab === status} className={reportTab === status ? "active" : ""} onClick={() => { setReportTab(status); setLibraryPage(1); }} key={status}>{status === "mastered" ? (zh ? "学会了" : "Mastered") : status === "learning" ? (zh ? "正在学" : "Learning") : (zh ? "还未学" : "Pending")} <b>{status === "unlearned" && !catalog.length ? total : counts[status]}</b></button>)}</nav>{loadingWords ? <p>{zh ? "正在读取 1,000 词正式词库…" : "Loading the 1,000-word catalog…"}</p> : <><p>{zh ? `每页 20 个词 · 第 ${visiblePage}/${pageCount} 页` : `20 words per page · Page ${visiblePage}/${pageCount}`}</p><div className="trial-word-grid">{pageWords.map(item => <button type="button" onClick={() => void loadTrialWords(item.id)} dir={item.direction} key={item.id}><span>{SCENES[item.sceneKey] || "◇"}</span><div><strong>{item.form}</strong><small>{item.targetPhonetic}</small><p>{zh ? item.meaningZh : item.meaningEn}</p><em>{zh ? `难度 ${item.difficulty || 1}/5 · 常用度 ${item.frequencyDegree || 10}/10` : `Difficulty ${item.difficulty || 1}/5 · Frequency ${item.frequencyDegree || 10}/10`}</em></div></button>)}</div><nav className="trial-library-pages"><button type="button" disabled={visiblePage <= 1} onClick={() => setLibraryPage(page => Math.max(1, page - 1))}>← {zh ? "上一页" : "Previous"}</button><button type="button" disabled={visiblePage >= pageCount} onClick={() => setLibraryPage(page => Math.min(pageCount, page + 1))}>{zh ? "下一页" : "Next"} →</button></nav></>}</section> : null}
    <section className="trial-cta"><div><p>{zh ? "喜欢这个学习方式？" : "Like this way of learning?"}</p><h2>{zh ? "免费注册，开启完整首月课程。" : "Create an account and start your full free month."}</h2><span>{zh ? "登录后才会保存进度、分数、21 天词汇记忆和证书记录。" : "Progress, scores, 21-day memory, and certificates are saved only after sign-in."}</span></div><nav><Link href={`/${lang}/auth/sign-up?returnTo=${encodeURIComponent(`/${lang}/classes/${classId || `course_${language}_basic`}`)}`}>{zh ? "免费注册" : "Create free account"} →</Link><Link href={`/${lang}/play?language=${language}`}>{zh ? "返回边玩边学" : "Back to Play"}</Link></nav></section>
    <style>{`.trial-word-grid>button{min-width:0;padding:15px;display:flex;gap:12px;border:1px solid #d8e1dd;border-radius:15px;background:#fff;color:inherit;text-align:left;font:inherit;cursor:pointer}.trial-word-grid>button:hover,.trial-word-grid>button:focus-visible{border-color:#087d62;background:#effaf5}.trial-word-grid>button>span{font-size:28px}.trial-word-grid>button>div{min-width:0}.trial-word-grid em{color:#087d62;font-size:12px;font-style:normal;font-weight:850}.trial-complete-card{position:fixed;z-index:1000;inset:0;margin:0!important;padding:clamp(28px,7vw,70px)!important;display:grid;place-content:center;background:#f7f3ea!important}.trial-complete-card nav{margin-top:22px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.trial-complete-card nav button,.trial-complete-card nav a{min-height:48px;padding:11px 18px;display:grid;place-items:center;border:1px solid #8db8a9;border-radius:999px;background:#087d62;color:#fff;font-weight:900;text-decoration:none}.trial-complete-card nav a{background:#fff;color:#087d62}`}</style>
    <style>{STYLE}</style>
    <style>{`.trial-repeat-check{padding:14px 17px;display:flex;align-items:center;gap:12px;border:1px solid #bad5ca;border-radius:15px;background:#fff}.trial-repeat-check input{width:22px;height:22px;accent-color:#087d62}.trial-repeat-check span,.trial-repeat-check small{display:block}.trial-repeat-check small{margin-top:3px;color:#61756d}.trial-feedback{margin-top:18px;padding:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-radius:15px;background:#ddf7ed;color:#076650}.trial-feedback button{min-height:46px;padding:0 20px;border:0;border-radius:12px;background:#087d62;color:#fff;font-weight:900}`}</style>
  </section>;
}

const STYLE = `.trial-shell,.trial-shell *{box-sizing:border-box}.trial-shell{width:100%;min-width:0;padding:clamp(44px,7vw,88px) clamp(16px,4vw,58px) 100px;display:grid;gap:28px;color:var(--ink)}.trial-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:24px}.trial-hero p,.trial-task>p,.trial-cta p,.trial-report header p{margin:0;color:#087d62;font-size:12px;font-weight:950;letter-spacing:.12em}.trial-hero h1{margin:10px 0 16px;font:850 clamp(40px,6vw,76px)/1.02 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.05em;overflow-wrap:anywhere}.trial-hero>div>span{display:block;max-width:76ch;color:#5a6d66;font-size:17px;line-height:1.7}.trial-hero aside,.trial-report header aside{min-width:190px;padding:20px;border-radius:20px;background:#123f35;color:#fff}.trial-hero aside strong,.trial-report aside strong{display:block;font-size:46px}.trial-hero aside span,.trial-report aside span{color:#bfdbd2}.trial-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.trial-tabs button{min-width:0;padding:15px;display:flex;align-items:center;gap:10px;border:1px solid #cad8d2;border-radius:15px;background:#fff;text-align:left}.trial-tabs button.active{border-color:#087d62;background:#e7f7f0}.trial-tabs i{flex:0 0 32px;height:32px;display:grid;place-items:center;border-radius:50%;background:#123f35;color:#fff;font-style:normal}.trial-tabs strong,.trial-tabs small{display:block;overflow-wrap:anywhere}.trial-tabs small{color:#65766f}.trial-activity,.trial-report{padding:clamp(22px,4vw,44px);border:1px solid #d3dfda;border-radius:24px;background:#fffdf8}.trial-activity{border-left:6px solid var(--trial-accent)}.trial-activity>header,.trial-report>header{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}.trial-activity>header>div{display:flex;align-items:baseline;gap:12px}.trial-activity h2,.trial-report h2{margin:0;font-size:clamp(28px,4vw,44px)}.trial-activity>header>a{color:#087d62;font-weight:850}.trial-card{margin-top:24px}.trial-progress{height:7px;border-radius:99px;background:#dce9e4;overflow:hidden}.trial-progress span{height:100%;display:block;background:#0db58a}.trial-card>p{font-weight:900;color:#087d62}.trial-flip{width:100%;min-height:300px;padding:30px;display:grid;place-items:center;align-content:center;gap:10px;border:0;border-radius:22px;background:linear-gradient(145deg,#0c5b4b,#123f35);color:#fff}.tries-1 .trial-flip{background:linear-gradient(145deg,#765315,#b97b16)}.tries-2 .trial-flip,.tries-3 .trial-flip{background:linear-gradient(145deg,#74392f,#a85a45)}.trial-flip>span{font-size:34px}.trial-flip strong{font-size:clamp(42px,7vw,76px);overflow-wrap:anywhere}.trial-flip em,.trial-flip small{color:#cce8df;font-style:normal}.trial-quiz{margin-top:18px}.trial-quiz>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.trial-quiz button{min-height:54px;padding:13px;border:1px solid #bad2c9;border-radius:14px;background:#fff;font:800 16px/1.4 inherit}.trial-quiz button:disabled{opacity:.35;text-decoration:line-through}.trial-quiz>p{padding:11px;border-radius:11px;background:#fff0d5}.trial-speech{margin-top:18px;padding:22px;display:grid;grid-template-columns:auto 1fr;gap:18px;border-radius:20px;background:#e7f6f0}.trial-avatar{width:72px;height:72px;display:grid;place-items:center;border-radius:50%;background:#123f35;color:#fff;font-size:24px;font-weight:950}.trial-speech h3{margin:0}.trial-speech b,.trial-speech span{display:block;margin-top:6px;color:#42675d}.trial-speech p{padding:10px;background:#fff;border-radius:10px}.trial-speech nav{display:flex;gap:9px;flex-wrap:wrap}.trial-speech button,.trial-more{min-height:46px;padding:10px 16px;border:1px solid #8fc3b2;border-radius:999px;background:#087d62;color:#fff;font-weight:850}.trial-speech button:last-child{background:#fff;color:#087d62}.trial-complete-card{margin-top:18px;padding:38px;text-align:center;border-radius:20px;background:#e5f6ee}.trial-complete-card>strong{font-size:48px;color:#087d62}.trial-task{margin-top:28px}.trial-task h3{font-size:clamp(24px,3vw,38px)}.trial-task blockquote{max-width:76ch;margin:18px 0;padding:16px;border-left:4px solid var(--trial-accent);background:#f1f6f3}.trial-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}.trial-options button{min-height:52px;border:1px solid #c8d6d0;border-radius:13px;background:#fff}.trial-options button.selected{background:#e5f6ef}.trial-task label{display:grid;gap:8px}.trial-task textarea{width:100%;min-height:125px;padding:14px;border:1px solid #b9cbc3;border-radius:13px}.trial-audio,.trial-complete{min-height:46px;padding:10px 16px;border:1px solid #a8c9bd;border-radius:999px;background:#087d62;color:#fff;font-weight:850}.trial-stats{margin:22px 0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.trial-stats article{padding:17px;border:1px solid #d4dfda;border-radius:15px;background:#fff}.trial-stats span,.trial-stats strong,.trial-stats small{display:block}.trial-stats strong{font-size:30px}.trial-report>[role=tablist]{display:flex;gap:8px;flex-wrap:wrap}.trial-report [role=tab]{padding:10px 14px;border:1px solid #c9d8d2;border-radius:999px;background:#fff;font-weight:850}.trial-report [role=tab].active{background:#e2f5ed;color:#08745e;border-color:#087d62}.trial-word-grid{margin-top:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.trial-word-grid article{min-width:0;padding:15px;display:flex;gap:12px;border:1px solid #d8e1dd;border-radius:15px;background:#fff}.trial-word-grid article>span{font-size:28px}.trial-word-grid article>div{min-width:0}.trial-word-grid strong,.trial-word-grid small{display:block;overflow-wrap:anywhere}.trial-word-grid p{overflow-wrap:anywhere}.trial-more{margin-top:18px}.trial-cta{padding:clamp(24px,4vw,46px);display:flex;align-items:center;justify-content:space-between;gap:24px;border-radius:25px;background:#123f35;color:#fff}.trial-cta h2{font-size:clamp(28px,4vw,46px)}.trial-cta>div>span{color:#c7dbd4}.trial-cta nav{display:grid;gap:9px;min-width:210px}.trial-cta a{padding:13px 17px;border:1px solid #72d4b4;border-radius:999px;color:#fff;text-align:center}.trial-cta a:first-child{background:#69d6b1;color:#123f35}@media(max-width:980px){.trial-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.trial-word-grid{grid-template-columns:1fr 1fr}}@media(max-width:720px){.trial-hero{grid-template-columns:1fr}.trial-tabs{grid-template-columns:1fr 1fr}.trial-cta{display:grid}.trial-stats{grid-template-columns:1fr 1fr}}@media(max-width:430px){.trial-shell{padding-inline:14px}.trial-tabs,.trial-quiz>div,.trial-word-grid{grid-template-columns:1fr}.trial-activity,.trial-report{padding:20px 15px}.trial-flip{min-height:250px;padding:22px 14px}.trial-speech{grid-template-columns:1fr}}`;
