"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Lang = "zh" | "en";
type Skill = "vocabulary" | "reading" | "writing" | "listening" | "dialogue";
type Level = "beginner" | "intermediate" | "advanced";
type Question = {
  id: string;
  skill: Skill;
  difficulty: number;
  responseKind: "choice" | "text";
  prompt: string;
  targetText?: string;
  audioText?: string;
  options?: Array<{ value: string; label: string }>;
  speechLocale: string;
  direction: "ltr" | "rtl";
};
type Attempt = {
  id: string;
  status: "in_progress" | "paused" | "completed";
  entryMode: string;
  currentIndex: number;
  totalItems: number;
  activeSeconds: number;
  answeredCount: number;
  skippedCount: number;
  overallScore: number | null;
  recommendedLevel: Level | null;
  selfSelected: boolean;
  skillScores: Partial<Record<Skill, number | null>>;
};
type PlacementState = {
  class: { id: string; title: string; targetLanguage: string };
  attempt: Attempt | null;
  question: Question | null;
};

const SKILLS: Skill[] = ["vocabulary", "reading", "writing", "listening", "dialogue"];
const COPY = {
  zh: {
    kicker: "官方语言社区 · 入班起点",
    title: "先确定适合您的学习起点。",
    intro: "您可以直接选择初级、中级或高级，也可以完成约 30 分钟的自适应分级。测试从中等难度开始，按表现升降，并覆盖五项技能。",
    choose: "选择学习起点",
    beginner: "初级",
    intermediate: "中级",
    advanced: "高级",
    test: "测试我",
    testNote: "约 30 分钟 · 可暂停 · 可跳过 · 从中等难度开始",
    skills: { vocabulary: "词汇", reading: "阅读", writing: "写作", listening: "听力", dialogue: "对话" },
    pause: "暂停",
    resume: "继续测试",
    skip: "跳过本题",
    submit: "提交答案",
    listen: "播放听力",
    microphone: "语音输入",
    stop: "停止听写",
    answer: "输入您的回答",
    paused: "测试已安全暂停。您的进度已经保存，可以稍后继续。",
    result: "您的学习起点",
    score: "综合分",
    self: "这是您自选的起点，未生成五项测试分数。您可以稍后重新参加自适应分级。",
    provisional: "写作与对话使用透明的学习量表；智能导师反馈只作练习参考。此结果不是官方考试、学历或语言证书。",
    learn: "进入每日学习",
    calendar: "查看学习日历",
    class: "返回班级",
    retry: "重新自适应测试",
    aiThinking: "智能导师正在回应您的对话…",
    aiLabel: "智能导师对话反馈",
    loadError: "暂时无法读取分级状态，请刷新后重试。",
    saveError: "暂时无法保存答案，请重试。",
    progress: "测试进度",
    item: "题",
  },
  en: {
    kicker: "OFFICIAL LANGUAGE COMMUNITY · STARTING POINT",
    title: "Find the learning level that fits you.",
    intro: "Choose Beginner, Intermediate, or Advanced directly, or take an adaptive placement of about 30 minutes. It starts in the middle, moves up or down with your responses, and covers all five skills.",
    choose: "Choose your starting point",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    test: "Test me",
    testNote: "About 30 minutes · pause anytime · skip any item · starts at medium difficulty",
    skills: { vocabulary: "Vocabulary", reading: "Reading", writing: "Writing", listening: "Listening", dialogue: "Dialogue" },
    pause: "Pause",
    resume: "Resume placement",
    skip: "Skip this item",
    submit: "Submit answer",
    listen: "Play listening prompt",
    microphone: "Voice input",
    stop: "Stop dictation",
    answer: "Enter your response",
    paused: "Your placement is safely paused. Progress is saved so you can continue later.",
    result: "Your learning starting point",
    score: "Overall score",
    self: "This is your self-selected starting point, so no five-skill test scores were generated. You can take adaptive placement later.",
    provisional: "Writing and dialogue use a transparent learning rubric; AI Guru feedback is practice guidance only. This result is not an official exam, academic credential, or language certificate.",
    learn: "Enter daily learning",
    calendar: "View learning calendar",
    class: "Back to class",
    retry: "Retake adaptive placement",
    aiThinking: "AI Guru is responding to your dialogue…",
    aiLabel: "AI Guru dialogue feedback",
    loadError: "Placement status is temporarily unavailable. Refresh and try again.",
    saveError: "Your response could not be saved yet. Please retry.",
    progress: "Placement progress",
    item: "items",
  },
} as const;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function PlacementAssessment({ lang, classId }: { lang: Lang; classId: string }) {
  const t = COPY[lang];
  const [state, setState] = useState<PlacementState | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/placement`, { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as PlacementState & { error?: string };
    if (!response.ok) throw new Error(result.error || t.loadError);
    setState(result);
  }, [classId, t.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { load().catch(() => setError(t.loadError)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, t.loadError]);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/placement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as PlacementState & { error?: string };
      if (!response.ok) throw new Error(result.error || t.saveError);
      if (result.question?.id !== state?.question?.id) {
        setAnswer("");
        setAiFeedback("");
      }
      setState(result);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.saveError);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit(skip = false) {
    const question = state?.question;
    if (!question || (!skip && !answer.trim())) return;
    const responseText = answer.trim();
    const result = await action({ action: skip ? "skip" : "answer", attemptId: state?.attempt?.id, itemId: question.id, answer: responseText });
    if (result && !skip && question.skill === "dialogue" && responseText) {
      setAiFeedback(t.aiThinking);
      const ai = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feature: "chat_guru",
          language: lang,
          messages: [{ role: "user", content: `${question.prompt}\n\nLearner response: ${responseText}\n\nGive one brief, encouraging dialogue reply and one practical correction. Do not assign or change the placement score.` }],
        }),
      }).then(value => value.json()).catch(() => ({})) as { reply?: string };
      setAiFeedback(ai.reply || "");
    }
  }

  function playAudio() {
    const question = state?.question;
    if (!question?.audioText || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.audioText);
    utterance.lang = question.speechLocale;
    utterance.rate = .82;
    window.speechSynthesis.speak(utterance);
  }

  function dictate() {
    const browser = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = state?.question?.speechLocale || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => setAnswer(current => `${current}${current ? " " : ""}${event.results[0]?.[0]?.transcript || ""}`);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  const percent = useMemo(() => state?.attempt
    ? Math.round((state.attempt.currentIndex / Math.max(1, state.attempt.totalItems)) * 100)
    : 0, [state]);

  if (!state && !error) return <section className="placement-shell placement-loading" aria-live="polite">SmartLingo…<PlacementStyles /></section>;

  return (
    <section className="placement-shell" data-layout-fill="placement-shell" data-layout-ready={state ? "true" : undefined} data-layout-text-fit="placement-shell">
      <header className="placement-heading" data-layout-fill="placement-heading">
        <p className="section-kicker">{t.kicker}</p>
        <h1>{t.title}</h1>
        <p data-readable-copy="placement-intro">{t.intro}</p>
      </header>

      {state && !state.attempt && (
        <section className="placement-choice" aria-labelledby="placement-choice-title" data-layout-fill="placement-choice">
          <div><h2 id="placement-choice-title">{t.choose}</h2><p>{t.testNote}</p></div>
          <div className="placement-levels">
            {(["beginner", "intermediate", "advanced"] as Level[]).map(level => (
              <button key={level} type="button" disabled={busy} onClick={() => action({ action: "start", mode: level })}>
                <span>{level === "beginner" ? "A1" : level === "intermediate" ? "B1" : "B2+"}</span>
                <b>{t[level]}</b>
              </button>
            ))}
            <button className="adaptive" type="button" disabled={busy} onClick={() => action({ action: "start", mode: "adaptive" })}>
              <span>≈ 30</span><b>{t.test}</b><small>{t.testNote}</small>
            </button>
          </div>
        </section>
      )}

      {state?.attempt?.status === "paused" && (
        <section className="placement-paused" data-layout-fill="placement-paused">
          <h2>{t.pause}</h2><p>{t.paused}</p>
          <button className="primary-button" type="button" disabled={busy} onClick={() => action({ action: "resume", attemptId: state.attempt?.id })}>{t.resume} →</button>
        </section>
      )}

      {state?.attempt?.status === "in_progress" && state.question && (
        <section className="placement-active" data-layout-fill="placement-active">
          <div className="placement-progress">
            <div><span>{t.progress}</span><b>{state.attempt.currentIndex + 1} / {state.attempt.totalItems} {t.item}</b></div>
            <progress max="100" value={percent}>{percent}%</progress>
            <div className="placement-skill-strip">
              {SKILLS.map((skill, index) => <span className={state.question?.skill === skill ? "active" : ""} key={skill}><i>{Math.min(3, Math.floor(state.attempt!.currentIndex / 5) + Number(index <= (state.attempt!.currentIndex % 5)))}/3</i>{t.skills[skill]}</span>)}
            </div>
          </div>
          <article className="placement-question" data-layout-fill="placement-question">
            <div className="question-meta"><span>{t.skills[state.question.skill]}</span><span>{"●".repeat(state.question.difficulty)}{"○".repeat(Math.max(0, 3 - state.question.difficulty))}</span></div>
            <h2>{state.question.prompt}</h2>
            {state.question.targetText && <p className="question-target" dir={state.question.direction}>{state.question.targetText}</p>}
            {state.question.audioText && <button className="audio-button" type="button" onClick={playAudio}>▶ {t.listen}</button>}
            {state.question.responseKind === "choice" ? (
              <div className="question-options">
                {(state.question.options || []).map(option => <button className={answer === option.value ? "selected" : ""} key={option.value} type="button" onClick={() => setAnswer(option.value)}>{option.label}</button>)}
              </div>
            ) : (
              <label className="question-response"><span>{t.answer}</span><textarea dir={state.question.direction} value={answer} maxLength={800} onChange={event => setAnswer(event.target.value)} /></label>
            )}
            {state.question.skill === "dialogue" && state.question.responseKind === "text" && (
              <button className="dictation-button" type="button" onClick={dictate} disabled={listening}>{listening ? t.stop : `◉ ${t.microphone}`}</button>
            )}
            <div className="question-actions">
              <button type="button" onClick={() => action({ action: "pause", attemptId: state.attempt?.id })} disabled={busy}>{t.pause}</button>
              <button type="button" onClick={() => submit(true)} disabled={busy}>{t.skip}</button>
              <button className="primary-button" type="button" onClick={() => submit(false)} disabled={busy || !answer.trim()}>{t.submit} →</button>
            </div>
          </article>
          {aiFeedback && <aside className="placement-ai-feedback" aria-live="polite"><b>{t.aiLabel}</b><p>{aiFeedback}</p></aside>}
        </section>
      )}

      {state?.attempt?.status === "completed" && (
        <section className="placement-result" data-layout-fill="placement-result">
          <div className="result-summary">
            <p className="section-kicker">{t.result}</p>
            <h2>{state.attempt.recommendedLevel ? t[state.attempt.recommendedLevel] : t.beginner}</h2>
            {state.attempt.overallScore !== null && <strong>{state.attempt.overallScore}<small>/ 100 · {t.score}</small></strong>}
            <p>{state.attempt.selfSelected ? t.self : t.provisional}</p>
          </div>
          {!state.attempt.selfSelected && <div className="result-skills">{SKILLS.map(skill => <div key={skill}><span>{t.skills[skill]}</span><b>{state.attempt?.skillScores?.[skill] ?? 0}</b><progress max="100" value={state.attempt?.skillScores?.[skill] ?? 0} /></div>)}</div>}
          <div className="result-actions">
            <Link className="primary-button" href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>{t.learn} →</Link>
            <Link className="secondary-button" href={`/${lang}/learning-log?classId=${encodeURIComponent(classId)}`}>{t.calendar}</Link>
            <Link className="text-link" href={`/${lang}/classes/${encodeURIComponent(classId)}`}>{t.class}</Link>
            <button className="text-link" type="button" disabled={busy} onClick={() => action({ action: "restart", mode: "adaptive" })}>{t.retry}</button>
          </div>
          <p className="placement-disclaimer">{t.provisional}</p>
        </section>
      )}
      {error && <p className="placement-error" role="alert">{error}</p>}
      <PlacementStyles />
    </section>
  );
}

function PlacementStyles() {
  return <style>{`
    .placement-shell{width:100%;max-width:none;min-width:0;margin:0;padding:72px clamp(20px,4vw,56px) 112px;color:var(--ink)}.placement-shell *{min-width:0;max-width:100%;overflow-wrap:anywhere}.placement-heading{width:100%}.placement-heading h1{margin:8px 0 20px;font:850 clamp(42px,6vw,76px)/1.03 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.055em}.placement-heading>p:last-child{max-width:76ch;color:var(--muted);font-size:17px;line-height:1.72}.placement-choice,.placement-paused,.placement-result{width:100%;margin-top:54px;padding:clamp(26px,4.4vw,56px);border-radius:26px;background:#e9f4ee}.placement-choice>div:first-child{width:100%}.placement-choice h2,.placement-paused h2,.placement-result h2{margin:0 0 12px;font:800 clamp(30px,4vw,50px)/1.08 Inter,"Noto Sans SC",sans-serif}.placement-choice>div:first-child p,.placement-paused p{max-width:72ch;color:#58706a;line-height:1.65}.placement-levels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:32px}.placement-levels button{min-height:150px;padding:22px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;border:1px solid #bed8cc;border-radius:19px;background:#fff;color:var(--ink);text-align:left;cursor:pointer}.placement-levels button:hover{border-color:#169776;transform:translateY(-2px)}.placement-levels button span{margin-bottom:auto;color:var(--lingo-green);font-size:13px;font-weight:900}.placement-levels button b{font-size:23px}.placement-levels button small{margin-top:8px;color:#60746f;line-height:1.45}.placement-levels .adaptive{background:#123f35;color:#fff}.placement-levels .adaptive small{color:#c8ded5}.placement-active{width:100%;margin-top:44px}.placement-progress{width:100%;padding:20px;border:1px solid #d8e3dc;border-radius:18px;background:#fff}.placement-progress>div:first-child{display:flex;justify-content:space-between;gap:20px}.placement-progress progress,.result-skills progress{width:100%;height:9px;margin-top:12px;accent-color:#149779}.placement-skill-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:18px}.placement-skill-strip span{padding:10px;display:grid;gap:3px;border-radius:10px;background:#f1f4f1;color:#60706b;font-size:12px}.placement-skill-strip span.active{background:#dff7ec;color:#08745e}.placement-skill-strip i{font-style:normal;font-weight:900}.placement-question{width:100%;margin-top:18px;padding:clamp(24px,4vw,48px);border:1px solid #d6dfda;border-radius:24px;background:#fffdf8}.question-meta{display:flex;justify-content:space-between;gap:16px;color:#087f67;font-size:12px;font-weight:900;letter-spacing:.08em}.placement-question h2{width:100%;margin:22px 0;font:800 clamp(28px,3.8vw,48px)/1.1 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.035em}.question-target{width:100%;padding:24px;border-radius:16px;background:#eef7f2;font-size:clamp(23px,3.3vw,39px);line-height:1.45}.audio-button,.dictation-button{min-height:46px;margin:8px 0;padding:0 17px;border:1px solid #9acabb;border-radius:999px;background:#eef9f4;color:#0a765f;font-weight:850}.question-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}.question-options button{min-height:62px;padding:13px 16px;border:1px solid #cfdad4;border-radius:13px;background:#fff;color:var(--ink);font-size:16px;text-align:left}.question-options button.selected{border-color:#0c8e70;background:#e3f7ee;box-shadow:0 0 0 2px rgba(12,142,112,.15)}.question-response{display:grid;gap:8px;margin-top:22px;font-weight:850}.question-response textarea{width:100%;min-height:150px;padding:16px;border:1px solid #bdccc5;border-radius:13px;background:#fff;color:var(--ink);font:16px/1.55 inherit;resize:vertical}.question-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:24px}.question-actions button{min-height:46px;padding:0 18px;border:1px solid #bfccc5;border-radius:999px;background:#fff;color:var(--ink);font-weight:850}.question-actions .primary-button{background:var(--lingo-green);color:#fff}.placement-ai-feedback{width:100%;margin-top:16px;padding:20px;border-left:4px solid #d4a23f;background:#fff7dd}.placement-ai-feedback p{margin:7px 0 0;white-space:pre-wrap;line-height:1.6}.placement-paused{background:#fff3d6}.placement-result{background:#123f35;color:#fff}.result-summary{width:100%}.result-summary>p:not(.section-kicker){max-width:74ch;color:#cadbd5;line-height:1.7}.result-summary strong{display:flex;align-items:baseline;gap:10px;font-size:64px}.result-summary strong small{font-size:14px}.result-skills{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:30px}.result-skills>div{padding:17px;border-radius:13px;background:rgba(255,255,255,.09)}.result-skills span,.result-skills b{display:block}.result-skills b{margin-top:8px;font-size:27px}.result-skills progress{accent-color:#5ee0b8}.result-actions{display:flex;flex-wrap:wrap;align-items:center;gap:11px;margin-top:34px}.result-actions .secondary-button{background:#fff;color:#123f35}.result-actions .text-link{min-height:44px;padding:0 8px;display:inline-flex;align-items:center;border:0;background:transparent;color:#fff;font-weight:850}.placement-disclaimer{margin:24px 0 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.15);color:#c3d5cf;font-size:13px;line-height:1.6}.placement-error{position:sticky;z-index:5;bottom:20px;margin:22px 0 0;padding:14px 17px;border-radius:10px;background:#a43830;color:#fff}.placement-loading{min-height:60vh;display:grid;place-items:center;color:#087f67;font-weight:900}
    @media(max-width:900px){.placement-levels{grid-template-columns:1fr 1fr}.result-skills{grid-template-columns:1fr 1fr}.result-skills>div:last-child{grid-column:1/-1}.placement-skill-strip{grid-template-columns:repeat(auto-fit,minmax(118px,1fr))}}
    @media(max-width:560px){.placement-shell{padding-top:48px}.placement-levels,.question-options,.result-skills{grid-template-columns:1fr}.placement-levels button{min-height:118px}.result-skills>div:last-child{grid-column:auto}.question-actions{display:grid}.question-actions button,.result-actions>a,.result-actions>button{width:100%;justify-content:center}.placement-skill-strip{grid-template-columns:1fr 1fr;overflow:visible}.placement-skill-strip span:last-child{grid-column:1/-1}.result-summary strong{font-size:52px}}
  `}</style>;
}
