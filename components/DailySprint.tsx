"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SentenceBuilderRound } from "./SentenceBuilderRound";
import { useRepeatAfterMePreference } from "./useRepeatAfterMePreference";
import { gradeSprintPlan, type SprintAnswer, type SprintPlan } from "../lib/smartlingo-sprint";

type Stage = "vocabulary" | "reading" | "listening" | "writing" | "dialogue" | "complete";
type SpeechKind = "vocabulary" | "reading" | "dialogue";
type SprintSpeechRecognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
const LOCALES: Record<string, string> = { zh: "zh-CN", en: "en-US", es: "es-ES", ja: "ja-JP", ko: "ko-KR", fr: "fr-FR", de: "de-DE", ru: "ru-RU", it: "it-IT", pt: "pt-PT", ar: "ar-SA", hi: "hi-IN" };

function vocabularyOptions(round: SprintPlan["rounds"][number], wordIndex: number) {
  const count = Math.min(4, round.vocabulary.length), start = wordIndex * 3 % round.vocabulary.length;
  const options = Array.from({ length: count }, (_, index) => round.vocabulary[(start + index) % round.vocabulary.length]);
  const answer = round.vocabulary[wordIndex];
  if (!options.some(item => item.id === answer.id)) options[options.length - 1] = answer;
  return [...options].sort((left, right) => left.id.localeCompare(right.id));
}

export function DailySprint({ lang, classId, durationMinutes, publicPlay = false }: { lang: "zh" | "en"; classId: string; durationMinutes: 5 | 10 | 15 | 20; publicPlay?: boolean }) {
  const zh = lang === "zh";
  const [runId, setRunId] = useState(""), [plan, setPlan] = useState<SprintPlan | null>(null), [courseTitle, setCourseTitle] = useState(""), [anonymous, setAnonymous] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0), [stage, setStage] = useState<Stage>("vocabulary"), [wordIndex, setWordIndex] = useState(0), [responses, setResponses] = useState<SprintAnswer[]>([]);
  const [vocabFlipped, setVocabFlipped] = useState(false), [vocabChoice, setVocabChoice] = useState(""), [vocabChecked, setVocabChecked] = useState(false);
  const [readingChoice, setReadingChoice] = useState(""), [readingChecked, setReadingChecked] = useState(false);
  const [speechKind, setSpeechKind] = useState<SpeechKind | null>(null), [speechTranscript, setSpeechTranscript] = useState(""), [speechAttempted, setSpeechAttempted] = useState(false), [speechFeedback, setSpeechFeedback] = useState(""), [speechBusy, setSpeechBusy] = useState(false);
  const [result, setResult] = useState<{ score: number; skillScores: Record<string, number> } | null>(null), [error, setError] = useState("");
  const [repeatAfterMe, setRepeatAfterMe] = useRepeatAfterMePreference();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    fetch(`/api/classes/${encodeURIComponent(classId)}/sprint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", durationMinutes, lang, timeZone, source: publicPlay ? "play" : undefined }) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || (zh ? "无法开始今日速成" : "Unable to start Today’s Sprint")); return data; })
      .then(data => { setRunId(data.runId); setPlan(data.plan); setCourseTitle(data.courseTitle); setAnonymous(data.anonymous === true); setResponses(Array.from({ length: data.plan.rounds.length }, () => ({}))); })
      .catch(cause => setError(cause.message));
  }, [classId, durationMinutes, lang, publicPlay, zh]);

  const round = plan?.rounds[roundIndex], word = round?.vocabulary[wordIndex];
  const choices = useMemo(() => round ? vocabularyOptions(round, wordIndex) : [], [round, wordIndex]);
  const totalSteps = (plan?.rounds.length || 1) * 5, step = roundIndex * 5 + ["vocabulary", "reading", "listening", "writing", "dialogue", "complete"].indexOf(stage) + 1;
  const progress = Math.min(100, Math.round(step * 100 / totalSteps));
  const update = (value: Partial<SprintAnswer>) => setResponses(current => current.map((item, index) => index === roundIndex ? { ...item, ...value } : item));
  const labels = useMemo(() => ({ vocabulary: zh ? "词汇" : "Vocabulary", reading: zh ? "阅读" : "Reading", listening: zh ? "听力" : "Listening", writing: zh ? "写作" : "Writing", dialogue: zh ? "口语" : "Speaking" }), [zh]);

  function speak(text: string, rate = .78, onEnd?: () => void) {
    if (!("speechSynthesis" in window)) { onEnd?.(); return; }
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALES[plan?.language || "en"] || "en-US"; utterance.rate = rate; utterance.onend = () => onEnd?.(); utterance.onerror = () => onEnd?.(); window.speechSynthesis.speak(utterance);
  }
  function resetSpeech(kind: SpeechKind | null = null) { setSpeechKind(kind); setSpeechTranscript(""); setSpeechAttempted(false); setSpeechFeedback(""); setSpeechBusy(false); }
  function beginSpeech(expected: string, kind: SpeechKind) {
    resetSpeech(kind); setSpeechBusy(true);
    speak(expected, .72, () => {
      const browser = window as typeof window & { SpeechRecognition?: new () => SprintSpeechRecognition; webkitSpeechRecognition?: new () => SprintSpeechRecognition };
      const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
      if (!Recognition) { setSpeechBusy(false); setSpeechAttempted(true); setSpeechFeedback(zh ? "当前浏览器不能评分口语，可继续学习。" : "This browser cannot score speech. You can continue."); return; }
      const recognition = new Recognition(); let settled = false; let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const empty = () => { if (settled) return; settled = true; if (timeoutId) clearTimeout(timeoutId); setSpeechBusy(false); setSpeechAttempted(true); setSpeechFeedback(zh ? "没有识别到清楚语音，可以再试一次或继续。" : "No clear speech was recognized. Try again or continue."); };
      recognition.lang = LOCALES[plan?.language || "en"] || "en-US"; recognition.interimResults = false; recognition.continuous = false;
      recognition.onresult = event => { if (settled) return; settled = true; if (timeoutId) clearTimeout(timeoutId); const transcript = String(event.results[0]?.[0]?.transcript || ""); setSpeechTranscript(transcript); setSpeechAttempted(true); setSpeechBusy(false); setSpeechFeedback(transcript ? (zh ? "已收到您的语音。" : "Speech received.") : ""); if (kind === "dialogue") update({ dialogueTranscript: transcript }); };
      recognition.onerror = empty; recognition.onend = empty;
      try { recognition.start(); timeoutId = setTimeout(() => { try { recognition.stop(); } catch {} empty(); }, 10000); } catch { empty(); }
    });
  }

  function chooseVocabulary(choice: string) {
    if (!word || vocabChecked) return;
    setVocabChoice(choice); setVocabChecked(true); const current = responses[roundIndex] || {};
    update({ vocabularySeen: [...new Set([...(current.vocabularySeen || []), word.id])], vocabularyAnswers: { ...(current.vocabularyAnswers || {}), [word.id]: choice } });
    if (repeatAfterMe) beginSpeech(word.form, "vocabulary"); else speak(word.form);
  }
  function nextWord() {
    if (!round || !word || !vocabChecked) return;
    if (wordIndex + 1 < round.vocabulary.length) { setWordIndex(index => index + 1); setVocabFlipped(false); setVocabChoice(""); setVocabChecked(false); resetSpeech(); return; }
    setStage("reading"); setWordIndex(0); resetSpeech("reading"); if (repeatAfterMe) setTimeout(() => beginSpeech(round.reading.prompt, "reading"), 80); else speak(round.reading.prompt);
  }
  async function nextRound() {
    if (!plan) return;
    if (roundIndex + 1 < plan.rounds.length) { setRoundIndex(index => index + 1); setStage("vocabulary"); setWordIndex(0); setVocabFlipped(false); setVocabChoice(""); setVocabChecked(false); setReadingChoice(""); setReadingChecked(false); resetSpeech(); return; }
    if(anonymous){setResult(gradeSprintPlan(plan,responses));setStage("complete");return;}
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/sprint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "complete", runId, responses, source: publicPlay ? "play" : undefined }) });
    const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error || (zh ? "无法保存成绩" : "Unable to save score")); return; } setResult(data); setStage("complete");
  }

  if (error) return <section className="daily-sprint sprint-error"><h1>{zh ? "今日速成暂时不可用" : "Today’s Sprint is unavailable"}</h1><p role="alert">{error}</p><Link href={`/${lang}/play`}>{zh ? "返回边玩边学" : "Back to Play"}</Link></section>;
  if (!plan || !round) return <section className="daily-sprint"><p>{zh ? "正在编排五技能速成课程…" : "Building your five-skill sprint…"}</p></section>;
  const vocabularyCorrect = vocabChecked && vocabChoice === word?.id;
  const readingCorrectLabel = round.reading.options.find(option => option.id === round.reading.answerId)?.label || "";

  return <section className="daily-sprint">
    <header className="sprint-head"><div><p>TODAY’S SPRINT · {durationMinutes} MIN</p><h1>{zh ? "今日速成" : "Today’s Sprint"}</h1><span>{courseTitle} · {roundIndex + 1}/{plan.rounds.length} {zh ? "回合" : "rounds"}</span></div><aside><button aria-pressed={repeatAfterMe} onClick={() => setRepeatAfterMe(!repeatAfterMe)}>{zh ? `跟我读：${repeatAfterMe ? "开" : "关"}` : `Repeat: ${repeatAfterMe ? "On" : "Off"}`}</button><strong>{progress}%</strong></aside></header><div className="sprint-progress"><span style={{ width: `${progress}%` }}/></div>
    {stage === "vocabulary" && word ? <article className="sprint-card sprint-vocabulary"><small>01 · {labels.vocabulary} · {wordIndex + 1}/10</small><h3>{zh ? "选择正确的意思，或点击卡片翻面" : "Choose the meaning, or flip the card"}</h3><button type="button" className={`sprint-flip-card ${vocabFlipped ? "flipped" : ""}`} onClick={() => setVocabFlipped(value => !value)}><span className="front"><strong dir={plan.language === "ar" ? "rtl" : "ltr"}>{word.form}</strong><em>{zh ? "点击查看意思" : "Tap to see the meaning"}</em></span><span className="back"><strong>{word.meaning}</strong><b>{word.pronunciation}</b><em>{zh ? "再点一次返回" : "Tap again to return"}</em></span></button><div className="sprint-options vocab-options">{choices.map(option => <button type="button" className={vocabChoice === option.id ? "selected" : ""} disabled={vocabChecked} onClick={() => chooseVocabulary(option.id)} key={option.id}>{option.meaning}</button>)}</div>{vocabChecked ? <aside className={vocabularyCorrect ? "correct" : "incorrect"}><strong>{vocabularyCorrect ? (zh ? "✓ 太棒了！" : "✓ Great!") : (zh ? "× 再试下一题" : "× Keep learning")}</strong>{!vocabularyCorrect ? <p><b>{zh ? "正确答案：" : "Correct answer: "}</b>{word.meaning}</p> : null}<p>{repeatAfterMe ? (speechBusy ? (zh ? "AI 已示范，正在听您跟读…" : "AI modeled it. Listening to you…") : speechFeedback || (zh ? "请跟我读" : "Repeat after me")) : (zh ? "跟读已关闭" : "Repeat after me is off")}</p>{speechTranscript ? <p><b>{zh ? "设备听到：" : "Device heard: "}</b>{speechTranscript}</p> : null}</aside> : null}{vocabChecked ? <footer><button type="button" onClick={() => beginSpeech(word.form, "vocabulary")} disabled={speechBusy}>{zh ? "🔊 再跟读一次" : "🔊 Repeat again"}</button><button type="button" className="primary-button" disabled={repeatAfterMe && !speechAttempted} onClick={nextWord}>{wordIndex === 9 ? (zh ? "进入句子练习" : "Start sentence practice") : (zh ? "继续" : "Continue")} →</button></footer> : null}</article> : null}
    {stage === "reading" ? <article className="sprint-card sprint-reading"><small>02 · {labels.reading}</small><h3>{zh ? "先听并跟读，再选择正确意思" : "Listen and repeat, then choose the meaning"}</h3><blockquote dir={plan.language === "ar" ? "rtl" : "ltr"}>{round.reading.prompt}</blockquote><nav><button type="button" onClick={() => beginSpeech(round.reading.prompt, "reading")} disabled={speechBusy}>{speechBusy ? (zh ? "正在听您说…" : "Listening…") : (zh ? "🔊 播放并跟读" : "🔊 Play and repeat")}</button></nav>{speechKind === "reading" && speechAttempted ? <aside className={speechTranscript ? "correct" : "incorrect"}><p>{speechFeedback}</p>{speechTranscript ? <p><b>{zh ? "设备听到：" : "Device heard: "}</b>{speechTranscript}</p> : null}</aside> : null}<div className="sprint-options">{round.reading.options.map(option => <button className={readingChoice === option.id ? "selected" : ""} disabled={readingChecked || (repeatAfterMe && !speechAttempted)} onClick={() => setReadingChoice(option.id)} key={option.id}>{option.label}</button>)}</div>{readingChecked ? <aside className={readingChoice === round.reading.answerId ? "correct" : "incorrect"}><strong>{readingChoice === round.reading.answerId ? (zh ? "✓ 回答正确" : "✓ Correct") : (zh ? "× 答案不对" : "× Not quite")}</strong>{readingChoice !== round.reading.answerId ? <p><b>{zh ? "正确答案：" : "Correct answer: "}</b>{readingCorrectLabel}</p> : null}</aside> : null}<button className="primary-button" disabled={!readingChoice} onClick={() => { if (!readingChecked) { setReadingChecked(true); update({ reading: readingChoice }); } else setStage("listening"); }}>{readingChecked ? (zh ? "进入听力组句" : "Start listening") : (zh ? "检查" : "Check")} →</button></article> : null}
    {stage === "listening" ? <article className="sprint-card"><small>03 · {labels.listening}</small><SentenceBuilderRound lang={lang} mode="listening" speechLocale={LOCALES[plan.language]} exercises={[round.listening]} onComplete={answer => { const parsed = JSON.parse(answer) as string[]; update({ listening: parsed[0] || "" }); setStage("writing"); }}/></article> : null}
    {stage === "writing" ? <article className="sprint-card"><small>04 · {labels.writing}</small><SentenceBuilderRound lang={lang} mode="writing" speechLocale={LOCALES[plan.language]} exercises={[round.writing]} onComplete={answer => { const parsed = JSON.parse(answer) as string[]; update({ writing: parsed[0] || "" }); setStage("dialogue"); resetSpeech("dialogue"); }}/></article> : null}
    {stage === "dialogue" ? <article className="sprint-card sprint-dialogue"><small>05 · {labels.dialogue}</small><h3>{zh ? "最后跟 AI 说一句" : "Finish by speaking with AI"}</h3><blockquote dir={plan.language === "ar" ? "rtl" : "ltr"}>{round.dialogue.audioText}</blockquote><p>{round.dialogue.prompt}</p><button onClick={() => beginSpeech(round.dialogue.audioText, "dialogue")} disabled={speechBusy}>{speechBusy ? (zh ? "正在听您说…" : "Listening to you…") : speechAttempted ? (zh ? "🔊 再试一次" : "🔊 Try again") : (zh ? "🔊 播放并开始说" : "🔊 Play and speak")}</button>{speechTranscript ? <aside className="correct"><b>{zh ? "设备听到：" : "Device heard: "}</b>{speechTranscript}</aside> : null}{speechFeedback ? <aside className={speechTranscript ? "correct" : "incorrect"}>{speechFeedback}</aside> : null}<button className="primary-button" disabled={!speechAttempted} onClick={nextRound}>{!speechTranscript ? (zh ? "以口语 0 分继续" : "Continue with 0 for speaking") : roundIndex + 1 < plan.rounds.length ? (zh ? "下一回合" : "Next round") : anonymous ? (zh ? "完成并查看成绩" : "Finish and view score") : (zh ? "完成并保存成绩" : "Finish and save score")} →</button></article> : null}
    {stage === "complete" && result ? <article className="sprint-result"><span>★</span><h2>{zh ? "速成完成！" : "Sprint complete!"}</h2><strong>{result.score}<small>/100</small></strong><div>{Object.entries(result.skillScores).map(([skill, score]) => <p key={skill}><b>{labels[skill as keyof typeof labels]}</b><span>{score}</span></p>)}</div>{anonymous ? <section className="sprint-signup"><h3>{zh ? "保存今天的成绩" : "Save today’s score"}</h3><p>{zh ? "本次匿名学习不会写入账户或数据库。免费注册或登录后，即可保存进度、参加排行榜并继续学习。" : "This anonymous session was not written to an account or database. Create a free account or sign in to save progress, join rankings, and keep learning."}</p><nav><Link href={`/${lang}/auth/sign-up?returnTo=${encodeURIComponent(`/${lang}/play?language=${plan.language}`)}`}>{zh ? "免费注册" : "Create free account"} →</Link><Link href={`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/play?language=${plan.language}`)}`}>{zh ? "登录" : "Sign in"}</Link></nav></section> : <nav><Link href={`/${lang}/play/rankings?language=${plan.language}`}>{zh ? "查看排行榜" : "View rankings"} →</Link><Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>{zh ? "返回课程" : "Back to course"}</Link></nav>}</article> : null}
    <style>{`.daily-sprint{width:min(980px,calc(100% - 32px));min-height:70vh;margin:42px auto 90px;color:#17342c}.sprint-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:end}.sprint-head p,.sprint-card>small{color:#087d62;font-size:12px;font-weight:950;letter-spacing:.12em}.sprint-head h1{margin:6px 0;font-size:clamp(40px,6vw,70px)}.sprint-head aside{display:flex;align-items:center;gap:12px}.sprint-head aside button{padding:11px;border:1px solid #afc8be;border-radius:12px;background:#fff}.sprint-head aside strong{font-size:34px}.sprint-progress{height:11px;margin:24px 0;border-radius:99px;background:#dce8e3;overflow:hidden}.sprint-progress span{display:block;height:100%;background:#18bf84}.sprint-card,.sprint-result{padding:clamp(24px,5vw,54px);border:1px solid #bed1c8;border-radius:28px;background:#fff;box-shadow:0 22px 65px #143d3020}.sprint-card>h3{margin:18px 0;font-size:clamp(25px,4vw,40px)}.sprint-card button,.sprint-result a{min-height:48px;padding:11px 17px;border:1px solid #b8cbc3;border-radius:13px;background:#fff;color:#17342c;font-weight:850}.sprint-card .primary-button,.sprint-result a:first-child{border:0;background:#0a7d61;color:#fff}.sprint-flip-card{position:relative;width:100%;min-height:260px!important;margin:18px 0;padding:0!important;overflow:hidden;border:0!important;border-radius:24px!important;background:linear-gradient(145deg,#0c503f,#0c8768)!important;color:#fff!important;perspective:1000px}.sprint-flip-card>span{position:absolute;inset:0;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;backface-visibility:hidden;transition:transform .45s}.sprint-flip-card .front strong{font-size:clamp(48px,9vw,86px)}.sprint-flip-card .back{transform:rotateY(180deg);background:linear-gradient(145deg,#173b54,#276b83)}.sprint-flip-card.flipped .front{transform:rotateY(180deg)}.sprint-flip-card.flipped .back{transform:rotateY(360deg)}.sprint-flip-card .back strong{font-size:clamp(34px,6vw,62px)}.sprint-flip-card b{font-size:22px}.sprint-flip-card em{font-style:normal;color:#d7f7eb}.sprint-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:24px 0}.sprint-options button{text-align:left}.sprint-options .selected{border-color:#087d62;background:#e2f5ed}.sprint-card>aside{margin:16px 0;padding:18px;border-radius:15px;background:#dff7e9;color:#096646}.sprint-card>aside.incorrect{background:#ffe3e3;color:#a23232}.sprint-card>aside p{margin:6px 0}.sprint-card>footer,.sprint-card>nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:22px}.sprint-reading blockquote,.sprint-dialogue blockquote{padding:25px;border:0;border-radius:18px;background:#123f35;color:#fff;font-size:clamp(25px,4vw,42px)}.sprint-reading>.primary-button,.sprint-dialogue>.primary-button{display:block;margin:24px 0 0 auto}.sprint-result{text-align:center}.sprint-result>span{font-size:70px;color:#f1b629}.sprint-result h2{font-size:42px}.sprint-result>strong{font-size:80px;color:#087d62}.sprint-result>strong small{font-size:20px}.sprint-result>div{max-width:520px;margin:25px auto}.sprint-result p{display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #dde7e2}.sprint-result nav{display:flex;justify-content:center;flex-wrap:wrap;gap:10px}.sprint-signup{max-width:680px;margin:30px auto 0;padding:24px;border-radius:20px;background:#e5f6ee}.sprint-signup h3{margin:0;font-size:28px}.sprint-signup p{display:block;margin:10px 0 20px;border:0;line-height:1.65}.sprint-signup nav{display:flex;justify-content:center;flex-wrap:wrap;gap:10px}@media(max-width:620px){.sprint-head{grid-template-columns:1fr}.sprint-head aside{justify-content:space-between}.sprint-options{grid-template-columns:1fr}.sprint-card>footer>*{width:100%}.sprint-flip-card{min-height:220px!important}}`}</style>
  </section>;
}
