"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Exercise = {
  id: string;
  scenario: string;
  prompt: string;
  audioText?: string;
  answerTokens: readonly string[];
  sourceLanguage?: string;
  answerLanguage?: string;
};

const LANGUAGE_NAMES: Record<string, { zh: string; en: string }> = {
  zh: { zh: "中文", en: "Chinese" }, en: { zh: "英语", en: "English" }, es: { zh: "西班牙语", en: "Spanish" }, ja: { zh: "日语", en: "Japanese" }, ko: { zh: "韩语", en: "Korean" }, fr: { zh: "法语", en: "French" }, de: { zh: "德语", en: "German" }, ru: { zh: "俄语", en: "Russian" }, it: { zh: "意大利语", en: "Italian" }, pt: { zh: "葡萄牙语", en: "Portuguese" }, ar: { zh: "阿拉伯语", en: "Arabic" }, hi: { zh: "印地语", en: "Hindi" },
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

function shuffledTokens(exercise: Exercise) {
  const tokens = exercise.answerTokens.map((label, index) => ({ id: `${exercise.id}:${index}`, label, index }));
  const shuffled = [...tokens].sort((left, right) => hash(`${exercise.id}:${left.index}`) - hash(`${exercise.id}:${right.index}`));
  return shuffled.every((item, index) => item.index === index) && shuffled.length > 1 ? shuffled.reverse() : shuffled;
}

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function SentenceBuilderRound({ lang, mode, speechLocale, exercises, onComplete, autoAdvance = false }: {
  lang: "zh" | "en";
  mode: "listening" | "writing";
  speechLocale: string;
  exercises: readonly Exercise[];
  onComplete: (serializedAnswers: string) => void;
  autoAdvance?: boolean;
}) {
  const zh = lang === "zh";
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");
  const advanceTimer = useRef<number | undefined>(undefined);
  const exerciseKey = exercises.map(item => item.id).join("|");
  const exercise = exercises[index];
  const tiles = useMemo(() => exercise ? shuffledTokens(exercise) : [], [exercise]);
  const selectedTiles = selected.map(id => tiles.find(tile => tile.id === id)).filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));
  const built = selectedTiles.map(tile => tile.label).join(" ");
  const expected = exercise?.answerTokens.join(" ") || "";
  const complete = index >= exercises.length;
  const sourceName = exercise?.sourceLanguage ? LANGUAGE_NAMES[exercise.sourceLanguage]?.[lang] || exercise.sourceLanguage : "";
  const answerName = exercise?.answerLanguage ? LANGUAGE_NAMES[exercise.answerLanguage]?.[lang] || exercise.answerLanguage : "";
  const listeningPrompt = sourceName && answerName
    ? sourceName === answerName
      ? (zh ? `听${sourceName}，用${answerName}按原句组句` : `Listen in ${sourceName}; rebuild what you hear in ${answerName}`)
      : (zh ? `听${sourceName}，用${answerName}组成意思` : `Listen in ${sourceName}; build the meaning in ${answerName}`)
    : (zh ? "选择听到的内容" : "Build what you hear");

  useEffect(() => {
    setIndex(0); setSelected([]); setAnswers([]); setFeedback("idle");
    window.clearTimeout(advanceTimer.current);
    return () => window.clearTimeout(advanceTimer.current);
  }, [exerciseKey]);

  function play(rate: number) {
    if (!exercise?.audioText || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(exercise.audioText);
    utterance.lang = speechLocale; utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function selectTile(tileId: string) {
    if (!exercise || feedback !== "idle") return;
    const nextSelected = [...selected, tileId];
    setSelected(nextSelected);
    if (nextSelected.length !== exercise.answerTokens.length) return;
    const nextBuilt = nextSelected.map(id => tiles.find(tile => tile.id === id)?.label || "").join(" ");
    setFeedback(normalized(nextBuilt) === normalized(expected) ? "correct" : "incorrect");
    if (autoAdvance) advanceTimer.current = window.setTimeout(next, 1400);
  }

  function next() {
    if (!exercise) return;
    const nextAnswers = [...answers, built];
    if (index + 1 >= exercises.length) {
      setAnswers(nextAnswers); setIndex(exercises.length); setSelected([]); setFeedback("idle");
      onComplete(JSON.stringify(nextAnswers));
      return;
    }
    setAnswers(nextAnswers); setIndex(current => current + 1); setSelected([]); setFeedback("idle");
  }

  if (!exercises.length) return null;
  if (complete) return <section className="sentence-round-complete" aria-live="polite"><span>★</span><h4>{zh ? `${exercises.length} 题练习已完成` : `${exercises.length} exercise${exercises.length === 1 ? "" : "s"} complete`}</h4><p>{autoAdvance ? (zh ? "正在自动进入下一项。" : "Moving to the next activity automatically.") : (zh ? "答案已准备好。提交后会计入今日学习分数。" : "Your answers are ready. Submit to add them to today's learning score.")}</p></section>;

  return <section className={`sentence-builder ${feedback}`} aria-label={mode === "listening" ? (zh ? "听力组句练习" : "Listening sentence builder") : (zh ? "写作组句练习" : "Writing sentence builder")}>
    <header><button type="button" className="sentence-close" aria-label={zh ? "清空本题" : "Clear this answer"} onClick={() => { setSelected([]); setFeedback("idle"); }}>×</button><div className="sentence-progress"><span style={{ width: `${(index + 1) * 100 / exercises.length}%` }}/></div><strong>{index + 1} / {exercises.length}</strong></header>
    <div className="sentence-prompt">
      <p>{mode === "listening" ? listeningPrompt : sourceName && answerName ? (zh ? `阅读${sourceName}，用${answerName}组句` : `Read in ${sourceName}; build the sentence in ${answerName}`) : (zh ? "用所学语言写出这句话" : "Build this sentence in the language you are learning")}</p>
      {mode === "listening" ? <nav><button type="button" onClick={() => play(.86)} aria-label={zh ? "正常速度播放" : "Play at normal speed"}>🔊</button><button type="button" onClick={() => play(.58)} aria-label={zh ? "慢速播放" : "Play slowly"}>🐢</button></nav> : <blockquote>{exercise.prompt}</blockquote>}
    </div>
    <div className="sentence-answer" aria-label={zh ? `${exercise.answerTokens.length} 个组句空位` : `${exercise.answerTokens.length} sentence slots`}>{exercise.answerTokens.map((_, slot) => { const tile = selectedTiles[slot]; return tile ? <button type="button" onClick={() => feedback === "idle" && setSelected(current => current.filter(id => id !== tile.id))} key={tile.id}>{tile.label}</button> : <span className="sentence-slot" aria-label={zh ? `空位 ${slot + 1}` : `Empty slot ${slot + 1}`} key={`slot-${slot}`}>{slot + 1}</span>; })}</div>
    <div className="sentence-tiles" aria-label={zh ? "可选词语" : "Available words"}>{tiles.map(tile => <button type="button" disabled={selected.includes(tile.id) || feedback !== "idle"} onClick={() => selectTile(tile.id)} key={tile.id}>{tile.label}</button>)}</div>
    {feedback !== "idle" ? <aside aria-live="polite"><strong>{feedback === "correct" ? `✓ ${zh ? "回答正确" : "Correct"}` : `× ${zh ? "再接再厉" : "Keep learning"}`}</strong>{feedback === "incorrect" ? <p><b>{zh ? "正确答案：" : "Correct answer: "}</b>{expected}</p> : <p>{zh ? "词序完全正确！" : "Every word is in the right place."}</p>}{autoAdvance ? <small>{zh ? "即将自动进入下一项…" : "Moving to the next activity…"}</small> : <button type="button" onClick={next}>{zh ? "继续" : "Continue"} →</button>}</aside> : <small className="sentence-auto-hint">{zh ? `填满 ${exercise.answerTokens.length} 个空位后自动检查` : `Fill all ${exercise.answerTokens.length} slots to check automatically`}</small>}
    <style>{`.sentence-builder,.sentence-builder *{box-sizing:border-box}.sentence-builder{margin-top:22px;padding:clamp(18px,4vw,34px);border:1px solid #d7e0db;border-radius:22px;background:#fbfcfb}.sentence-builder>header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px}.sentence-close{width:38px;height:38px;border:0;background:transparent;color:#789088;font-size:30px}.sentence-progress{height:9px;border-radius:99px;background:#dfe6e2;overflow:hidden}.sentence-progress span{display:block;height:100%;border-radius:inherit;background:#1acb86}.sentence-builder>header>strong{color:#5f716a}.sentence-prompt{min-height:170px;padding:34px 0 22px;display:grid;place-items:center;align-content:center;text-align:center}.sentence-prompt>p{margin:0 0 22px;font-size:clamp(22px,3vw,34px);font-weight:900}.sentence-prompt nav{display:flex;align-items:end;gap:12px}.sentence-prompt nav button{width:78px;height:72px;border:0;border-radius:19px;background:#139dd7;color:#fff;font-size:34px;box-shadow:0 5px 0 #087aaa}.sentence-prompt nav button+button{width:58px;height:54px;font-size:24px}.sentence-prompt blockquote{margin:0;padding:18px 24px;border:0;border-radius:17px;background:#edf7f2;font-size:clamp(22px,3.5vw,38px);font-weight:850}.sentence-answer{min-height:75px;padding:13px 4px;display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;border-block:2px solid #e0e5e2}.sentence-answer>span{padding:10px;color:#8a9893}.sentence-answer button,.sentence-tiles button{min-height:46px;padding:8px 14px;border:1px solid #c9d2ce;border-radius:10px;background:#fff;color:#18332b;font:800 17px/1.2 inherit;box-shadow:0 3px 0 #d7ddda}.sentence-tiles{min-height:86px;padding:26px 4px;display:flex;justify-content:center;align-content:flex-start;gap:9px;flex-wrap:wrap}.sentence-tiles button:disabled{opacity:.18}.sentence-builder footer{display:flex;justify-content:flex-end}.sentence-builder footer button,.sentence-builder aside button{min-width:150px;min-height:48px;padding:9px 20px;border:0;border-radius:14px;background:#13a46f;color:#fff;font-weight:900}.sentence-builder footer button:disabled{opacity:.4}.sentence-builder aside{margin:20px -34px -34px;padding:24px 34px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 20px;align-items:center;background:#dff7e9;color:#096646}.sentence-builder.incorrect aside{background:#ffe3e3;color:#a23232}.sentence-builder aside strong{font-size:24px}.sentence-builder aside p{margin:0}.sentence-builder aside>small{color:currentColor;font-weight:850}.sentence-builder aside button{grid-column:2;grid-row:1/3;background:currentColor}.sentence-builder aside button{color:#fff}.sentence-builder.incorrect aside button{background:#e44747}@media(max-width:620px){.sentence-builder{padding:16px}.sentence-builder aside{margin:18px -16px -16px;padding:20px 16px;grid-template-columns:1fr}.sentence-builder aside button{grid-column:1;grid-row:auto;width:100%}.sentence-prompt{min-height:145px}.sentence-answer button,.sentence-tiles button{font-size:16px}}`}</style>
  </section>;
}
