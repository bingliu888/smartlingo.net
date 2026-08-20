"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "mastered" | "learning" | "unlearned";
type Mode = "recognition" | "recall" | "listening" | "spelling" | "cloze";
type Card = {
  id: string; form: string; pronunciation: string; targetPhonetic: string; pronunciationEn: string;
  pronunciationZh: string; meaningEn: string; meaningZh: string; sceneKey: string; direction: "ltr" | "rtl";
  status: Status; memoryStage: number; nextMemoryDay: number | null; mode: Mode; dueAt: number | null;
  options: { id: string; form: string; meaningEn: string; meaningZh: string }[];
};
type Summary = { total: number; mastered: number; learning: number; unlearned: number; percent: number; stars: number };
type Report = Summary & { localDate: string };
type Payload = {
  localDate: string; targetLanguage: string; level: string; methodology: { days: number[]; minimumModes: number };
  summary: Summary; dailyDeck: Card[]; items: Card[]; reports: Report[]; correct?: boolean; error?: string;
};
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
};

const SPEECH_LOCALES: Record<string, string> = { zh: "zh-CN", en: "en-US", es: "es-ES", ja: "ja-JP", ko: "ko-KR", fr: "fr-FR", de: "de-DE", ru: "ru-RU", it: "it-IT", pt: "pt-BR", ar: "ar-SA", hi: "hi-IN" };
const SCENES: Record<string, string> = { greetings: "☀️", introductions: "👋", transport: "🚆", directions: "🧭", restaurant: "🍜", shopping: "🛍️", help: "🛟" };

export function VocabularyMemoryWorkspace({ lang, classId }: { lang: "zh" | "en"; classId: string }) {
  const zh = lang === "zh";
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Status>("unlearned");
  const [index, setIndex] = useState(0);
  const [tries, setTries] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"answer" | "speak" | "done">("answer");
  const [speechMessage, setSpeechMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const zone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const load = useCallback(async () => {
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/vocabulary?timeZone=${encodeURIComponent(zone)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as Payload;
    if (!response.ok) throw new Error(payload.error || "LOAD_FAILED");
    setData(payload);
  }, [classId, zone]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(() => setError(zh ? "暂时无法读取课程词库。" : "The course vocabulary is temporarily unavailable.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, zh]);

  const cards = data?.dailyDeck || [];
  const card = cards[index] || null;
  const filtered = (data?.items || []).filter(item => item.status === tab);
  const meaning = (item: { meaningZh: string; meaningEn: string }) => zh ? item.meaningZh : item.meaningEn;
  const textMode = card?.mode === "spelling" || card?.mode === "cloze";

  function playWord(after?: () => void) {
    if (!card || !("speechSynthesis" in window)) { after?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.form);
    utterance.lang = SPEECH_LOCALES[data?.targetLanguage || ""] || data?.targetLanguage || "en-US";
    utterance.rate = .72;
    utterance.onend = () => after?.();
    utterance.onerror = () => after?.();
    window.speechSynthesis.speak(utterance);
  }

  async function submit(selectedId: string, answer = "") {
    if (!card || busy) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/vocabulary`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id, selectedId, answer, mode: card.mode, timeZone: zone }),
    });
    const payload = await response.json().catch(() => ({})) as Payload;
    setBusy(false);
    if (!response.ok) { setError(payload.error || (zh ? "提交失败，请再试一次。" : "Unable to save. Try again.")); return; }
    setData(current => current ? { ...payload, dailyDeck: current.dailyDeck } : payload);
    if (payload.correct) {
      setPhase("speak"); setSpeechMessage(zh ? "答对了！+1 次有效回忆。现在听并跟读。" : "Correct! One retrieval recorded. Now listen and repeat.");
      playWord();
    } else {
      setPhase("speak"); setSpeechMessage(zh ? `今天先记住：${card.form} · ${meaning(card)}。听一遍再跟读，明天会再次出现。` : `Remember for today: ${card.form} · ${meaning(card)}. Listen and repeat; it returns tomorrow.`);
      playWord();
    }
  }

  function choose(optionId: string) {
    if (!card || phase !== "answer") return;
    if (optionId === card.id) { void submit(optionId); return; }
    const next = tries + 1;
    setTries(next); setWrongIds(current => [...current, optionId]);
    if (next >= 3) void submit(optionId);
  }

  function checkTyped() {
    if (!card || !typed.trim()) return;
    const clean = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (clean(typed) === clean(card.form)) { void submit(card.id, typed); return; }
    const next = tries + 1; setTries(next);
    if (next >= 3) void submit("wrong", typed);
  }

  function nextCard() {
    setIndex(current => Math.min(current + 1, Math.max(0, cards.length - 1)));
    setTries(0); setWrongIds([]); setTyped(""); setPhase(index + 1 >= cards.length ? "done" : "answer"); setSpeechMessage("");
  }

  function repeatAfterMe() {
    const browser = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition || !card) { setSpeechMessage(zh ? "浏览器暂不支持语音识别；请跟读后点“完成本卡”。" : "Speech recognition is unavailable; repeat aloud, then finish this card."); return; }
    const recognition = new Recognition();
    recognition.lang = SPEECH_LOCALES[data?.targetLanguage || ""] || data?.targetLanguage || "en-US";
    recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = event => {
      const heard = String(event.results?.[0]?.[0]?.transcript || "");
      const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const close = normalize(heard) === normalize(card.form) || normalize(heard).includes(normalize(card.form));
      setSpeechMessage(close ? (zh ? `听到了“${heard}”，发音很棒！` : `I heard “${heard}”. Great pronunciation!`) : (zh ? `听到了“${heard}”。再听一次，慢一点跟读。` : `I heard “${heard}”. Listen once more and repeat slowly.`));
    };
    recognition.onerror = () => setSpeechMessage(zh ? "没有听清。请确认麦克风已允许，然后再试。" : "I could not hear clearly. Allow the microphone and try again.");
    playWord(() => recognition.start());
  }

  const modeLabel: Record<Mode, string> = zh
    ? { recognition: "看词选义", recall: "看义找词", listening: "听音辨义", spelling: "拼写回忆", cloze: "主动填词" }
    : { recognition: "Word → meaning", recall: "Meaning → word", listening: "Listen → meaning", spelling: "Spelling recall", cloze: "Active completion" };

  return <section className="vm-shell">
    <header className="vm-hero"><div><p>SMARTLINGO · 21-DAY MEMORY</p><h1>{zh ? "每天十张卡，把新词变成长久记忆" : "Ten daily cards. Turn new words into lasting memory."}</h1><span>{zh ? "第 1、3、7、14、21 天跨日回忆，并完成至少三种题型后才计入“学会了”。" : "A word becomes mastered only after retrieval on days 1, 3, 7, 14 and 21 across at least three modes."}</span></div><Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>← {zh ? "返回课程" : "Back to course"}</Link></header>

    {data ? <><section className="vm-dashboard" aria-label={zh ? "词汇学习总览" : "Vocabulary overview"}>
      <div className="vm-score"><span>{zh ? "已学会比例" : "Mastery"}</span><strong>{data.summary.percent}%</strong><div aria-label={`${data.summary.stars} / 5`}>{[1,2,3,4,5].map(star => <b className={star <= data.summary.stars ? "on" : ""} key={star}>★</b>)}</div><small>{data.summary.mastered} / {data.summary.total} {zh ? "个已发布课程词条" : "published course words"}</small></div>
      <div className="vm-stat mastered"><i>✓</i><span>{zh ? "学会了" : "Mastered"}</span><strong>{data.summary.mastered}</strong></div>
      <div className="vm-stat learning"><i>↻</i><span>{zh ? "正在学" : "Learning"}</span><strong>{data.summary.learning}</strong></div>
      <div className="vm-stat new"><i>＋</i><span>{zh ? "还未学" : "Not started"}</span><strong>{data.summary.unlearned}</strong></div>
    </section>

    <section className="vm-practice" aria-labelledby="vm-practice-title">
      <header><div><p>{data.localDate} · {data.targetLanguage.toUpperCase()}</p><h2 id="vm-practice-title">{zh ? "今日智慧卡练习" : "Today's SmartCard practice"}</h2></div><strong>{Math.min(index + 1, cards.length)} <span>/ {cards.length}</span></strong></header>
      {card && phase !== "done" ? <div className={`vm-card tries-${tries}`} dir={card.direction}>
        <div className="vm-progress"><span style={{ width: `${(index + 1) / Math.max(1, cards.length) * 100}%` }}/></div>
        <div className="vm-card-scene"><span>{SCENES[card.sceneKey] || "✨"}</span><small>{modeLabel[card.mode]} · {zh ? `记忆阶段 ${card.memoryStage}/5` : `Memory stage ${card.memoryStage}/5`}</small></div>
        {card.mode === "listening" ? <button className="vm-listen-prompt" type="button" onClick={() => playWord()}>▶ {zh ? "播放发音" : "Play word"}</button> : <h3>{card.mode === "recall" || textMode ? meaning(card) : card.form}</h3>}
        {tries ? <p className="vm-hint" role="status">{tries === 1 ? (zh ? `提示：这是“${card.sceneKey}”场景词。` : `Hint: this belongs to “${card.sceneKey}”.`) : (zh ? `再提示：开头是“${Array.from(card.form)[0]}”，共 ${Array.from(card.form).length} 个字符。` : `More help: it starts with “${Array.from(card.form)[0]}” and has ${Array.from(card.form).length} characters.`)}</p> : null}
        {phase === "answer" ? textMode ? <div className="vm-typing"><input value={typed} onChange={event => setTyped(event.target.value)} onKeyDown={event => { if (event.key === "Enter") checkTyped(); }} placeholder={zh ? "输入目标语言词语" : "Type the target-language word"}/><button type="button" disabled={!typed.trim() || busy} onClick={checkTyped}>{zh ? "检查" : "Check"}</button></div> : <div className="vm-options">{card.options.map(option => <button type="button" disabled={busy || wrongIds.includes(option.id)} onClick={() => choose(option.id)} key={option.id}>{card.mode === "recall" ? option.form : meaning(option)}</button>)}</div> : <div className="vm-speak">
          <p>{speechMessage}</p><h3>{card.form}</h3>{card.targetPhonetic ? <b>{card.targetPhonetic}</b> : null}<span>{zh ? "中文拼音式助读" : "English sound guide"} · {zh ? card.pronunciationZh : card.pronunciationEn}</span>
          <div><button type="button" onClick={repeatAfterMe}>🎙 {zh ? "听并跟读" : "Listen and repeat"}</button><button type="button" onClick={nextCard}>{zh ? "完成本卡" : "Finish card"} →</button></div>
        </div>}
      </div> : <div className="vm-complete"><span>✦</span><h3>{zh ? "今天的词汇记忆完成了！" : "Today's vocabulary memory is complete!"}</h3><p>{zh ? "明天回来，系统会按到期顺序自动挑选下一组词。" : "Come back tomorrow; due reviews and new words will be selected automatically."}</p></div>}
    </section>

    <section className="vm-library"><header><div><p>VOCABULARY LIBRARY</p><h2>{zh ? "我的课程词汇" : "My course vocabulary"}</h2></div><div role="tablist">{(["mastered","learning","unlearned"] as Status[]).map(status => <button role="tab" aria-selected={tab === status} className={tab === status ? "active" : ""} onClick={() => setTab(status)} key={status}>{status === "mastered" ? (zh ? "学会了" : "Mastered") : status === "learning" ? (zh ? "正在学" : "Learning") : (zh ? "还未学" : "Not started")} <b>{data.summary[status]}</b></button>)}</div></header>
      <div className="vm-word-grid">{filtered.map(item => <article key={item.id}><span>{SCENES[item.sceneKey] || "Aa"}</span><div><strong dir={item.direction}>{item.form}</strong>{item.targetPhonetic ? <small>{item.targetPhonetic}</small> : null}<p>{meaning(item)}</p><em>{item.status === "mastered" ? (zh ? "永久掌握" : "Mastered") : item.status === "learning" ? `${zh ? "记忆阶段" : "Stage"} ${item.memoryStage}/5` : (zh ? "等待首次学习" : "Ready to learn")}</em></div></article>)}</div>
    </section>

    <section className="vm-report"><header><p>21-DAY REPORT</p><h2>{zh ? "每日词汇成长报告" : "Daily vocabulary growth"}</h2></header><div>{data.reports.map(report => <article key={report.localDate}><time>{report.localDate.slice(5)}</time><span><i style={{ width: `${report.percent}%` }}/></span><strong>{report.percent}%</strong><small>{report.mastered} / {report.learning} / {report.unlearned}</small></article>)}</div><footer><span>● {zh ? "学会了" : "Mastered"}</span><span>↻ {zh ? "正在学" : "Learning"}</span><span>○ {zh ? "还未学" : "Not started"}</span></footer></section>
    </> : null}
    {!data && !error ? <p className="vm-loading">{zh ? "正在整理今天的词卡…" : "Preparing today's cards…"}</p> : null}{error ? <p className="vm-error" role="alert">{error}</p> : null}
    <style>{styles}</style>
  </section>;
}

const styles = `.vocabulary-memory-page{min-height:100vh;background:linear-gradient(180deg,#eef9f4 0,#fbf7ed 36%,#f5efe4 100%)}.vm-shell,.vm-shell *{box-sizing:border-box}.vm-shell{width:min(1220px,calc(100% - 32px));margin:0 auto;padding:52px 0 100px;color:#12202a}.vm-hero{display:flex;justify-content:space-between;gap:28px;align-items:flex-start;padding:42px;border-radius:28px;background:#123f35;color:#fff;box-shadow:0 26px 70px rgba(18,63,53,.2)}.vm-hero p,.vm-practice header p,.vm-library header p,.vm-report header p{margin:0;color:#63d4b0;font-size:11px;font-weight:950;letter-spacing:.13em}.vm-hero h1{max-width:800px;margin:12px 0;font-size:clamp(35px,5vw,64px);line-height:1.04;letter-spacing:-.045em}.vm-hero span{display:block;max-width:760px;color:#c7dbd4;line-height:1.65}.vm-hero>a{padding:11px 16px;border:1px solid #588078;border-radius:999px;color:#fff;white-space:nowrap}.vm-dashboard{margin-top:20px;display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:12px}.vm-score,.vm-stat{min-width:0;padding:23px;border:1px solid #d4dfda;border-radius:20px;background:#fff}.vm-score{display:grid;grid-template-columns:auto auto;align-items:center}.vm-score>span{font-weight:900}.vm-score>strong{grid-row:span 2;font-size:clamp(40px,5vw,66px);text-align:right}.vm-score>div{color:#d7d6ce;font-size:20px;letter-spacing:2px}.vm-score b.on{color:#f2a331}.vm-score small{grid-column:1/-1;margin-top:9px;color:#65736e}.vm-stat{display:grid;grid-template-columns:auto 1fr;gap:6px 10px}.vm-stat i{grid-row:span 2;width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#e5f5ee;color:#087d62;font-style:normal;font-weight:950}.vm-stat span{color:#63726d;font-size:13px}.vm-stat strong{font-size:30px}.vm-stat.learning i{background:#fff0d5;color:#9a6000}.vm-stat.new i{background:#edf0f2;color:#56636a}.vm-practice,.vm-library,.vm-report{margin-top:20px;padding:clamp(22px,4vw,42px);border:1px solid #d4dfda;border-radius:26px;background:rgba(255,255,255,.92)}.vm-practice>header,.vm-library>header,.vm-report>header{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.vm-practice h2,.vm-library h2,.vm-report h2{margin:7px 0 0;font-size:clamp(27px,4vw,43px)}.vm-practice>header>strong{font-size:34px;color:#087d62}.vm-practice>header>strong span{color:#8a9691;font-size:17px}.vm-card{margin-top:24px;padding:clamp(22px,4vw,42px);position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(145deg,#0b4d41,#147b61);color:#fff;box-shadow:0 18px 45px rgba(7,64,52,.2);transition:background .25s}.vm-card.tries-1{background:linear-gradient(145deg,#765315,#b97b16)}.vm-card.tries-2,.vm-card.tries-3{background:linear-gradient(145deg,#74392f,#a85a45)}.vm-progress{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.2)}.vm-progress span{height:100%;display:block;border-radius:inherit;background:#74e3bd}.vm-card-scene{margin-top:24px;display:flex;justify-content:space-between;align-items:center;gap:14px}.vm-card-scene>span{font-size:38px}.vm-card-scene small{color:#d0e7df;font-weight:800}.vm-card>h3,.vm-speak>h3{margin:26px auto;text-align:center;font-size:clamp(38px,7vw,76px);line-height:1.15;overflow-wrap:anywhere}.vm-hint{padding:12px 15px;border-radius:12px;background:rgba(255,255,255,.13);text-align:center}.vm-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vm-options button,.vm-typing button,.vm-listen-prompt,.vm-speak button{min-height:54px;padding:13px 17px;border:1px solid rgba(255,255,255,.38);border-radius:15px;background:rgba(255,255,255,.12);color:#fff;font:850 16px/1.35 inherit;cursor:pointer}.vm-options button:disabled{opacity:.34;text-decoration:line-through}.vm-listen-prompt{width:min(360px,100%);margin:35px auto;display:block;background:#fff;color:#0a5e4c}.vm-typing{display:grid;grid-template-columns:1fr auto;gap:10px}.vm-typing input{min-width:0;padding:15px;border:0;border-radius:14px;font:18px inherit}.vm-speak{text-align:center}.vm-speak>p{padding:12px;border-radius:12px;background:rgba(255,255,255,.12)}.vm-speak>h3{margin-bottom:6px}.vm-speak>b,.vm-speak>span{display:block;margin-top:7px}.vm-speak>span{color:#d2e8e0}.vm-speak>div{margin-top:25px;display:flex;justify-content:center;gap:10px}.vm-speak button:last-child{background:#fff;color:#0a5e4c}.vm-complete{margin-top:24px;padding:55px 20px;text-align:center;border-radius:22px;background:#e5f6ee}.vm-complete>span{font-size:55px;color:#e49b2d}.vm-complete h3{font-size:30px}.vm-library>header{align-items:center;flex-wrap:wrap}.vm-library header>div:last-child{display:flex;gap:7px;flex-wrap:wrap}.vm-library [role=tab]{padding:10px 14px;border:1px solid #c9d8d2;border-radius:999px;background:#fff;font-weight:850}.vm-library [role=tab].active{border-color:#087d62;background:#e2f5ed;color:#08745e}.vm-library [role=tab] b{margin-left:6px}.vm-word-grid{margin-top:22px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.vm-word-grid article{min-width:0;padding:17px;display:flex;gap:13px;border:1px solid #d8e1dd;border-radius:16px;background:#fff}.vm-word-grid article>span{font-size:28px}.vm-word-grid article>div{min-width:0}.vm-word-grid strong,.vm-word-grid small{display:block;overflow-wrap:anywhere}.vm-word-grid strong{font-size:21px}.vm-word-grid small{margin-top:3px;color:#6b7974}.vm-word-grid p{margin:9px 0;line-height:1.4}.vm-word-grid em{color:#087d62;font-size:12px;font-style:normal;font-weight:850}.vm-report>div{margin-top:22px;display:grid;gap:9px}.vm-report article{display:grid;grid-template-columns:55px minmax(90px,1fr) 50px 130px;align-items:center;gap:12px}.vm-report article>span{height:9px;overflow:hidden;border-radius:99px;background:#e2e8e5}.vm-report article i{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,#0b9473,#69d9b5)}.vm-report article small{text-align:right;color:#65736e}.vm-report footer{max-width:none;padding:18px 0 0;border:0;display:flex;gap:18px;color:#65736e;font-size:12px}.vm-loading,.vm-error{margin-top:20px;padding:18px;border-radius:14px;background:#fff}.vm-error{background:#fff0ed;color:#973e35}@media(max-width:900px){.vm-dashboard{grid-template-columns:1fr 1fr}.vm-score{grid-column:1/-1}.vm-word-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.vm-shell{width:calc(100% - 24px);padding-top:24px}.vm-hero{padding:26px;display:grid}.vm-dashboard{grid-template-columns:1fr}.vm-score{grid-column:auto}.vm-practice,.vm-library,.vm-report{padding:19px}.vm-options,.vm-word-grid{grid-template-columns:1fr}.vm-speak>div{display:grid}.vm-report article{grid-template-columns:45px 1fr 44px}.vm-report article small{grid-column:2/-1;text-align:left}.vm-report footer{flex-wrap:wrap}.vm-typing{grid-template-columns:1fr}.vm-hero>a{justify-self:start}}`;
