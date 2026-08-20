"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

type Lang = "zh" | "en";
type Skill = "vocabulary" | "reading" | "writing" | "listening" | "dialogue";
type Card = { readonly stableId: string; readonly form: string; readonly pronunciation: string; readonly meaning: { readonly zh: string; readonly en: string } };
type Task = { readonly taskId: string; readonly skill: Skill; readonly prompt: string; readonly context?: string; readonly audioText?: string; readonly options?: readonly { readonly id: string; readonly label: string }[]; readonly direction?: "ltr" | "rtl" };

const SKILLS: Skill[] = ["vocabulary", "reading", "writing", "listening", "dialogue"];
const ACCENTS: Record<Skill, string> = { vocabulary: "#0a8e6f", reading: "#2f6fbb", writing: "#ad642d", listening: "#7a5aad", dialogue: "#c74455" };

export function AnonymousBeginnerTrial({ lang, language, languageName, speechLocale, direction, cards, tasks }: {
  lang: Lang;
  language: string;
  languageName: string;
  speechLocale: string;
  direction: "ltr" | "rtl";
  cards: readonly Card[];
  tasks: readonly Task[];
}) {
  const zh = lang === "zh";
  const [active, setActive] = useState<Skill>("vocabulary");
  const [completed, setCompleted] = useState<Skill[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const task = useMemo(() => tasks.find(item => item.skill === active), [active, tasks]);
  const card = cards[cardIndex];

  const labels: Record<Skill, [string, string, string]> = {
    vocabulary: ["词汇", "Vocabulary", "智慧卡与实用表达"],
    reading: ["阅读", "Reading", "理解真实语境"],
    writing: ["写作", "Writing", "组织简短表达"],
    listening: ["听力", "Listening", "听辨语音与含义"],
    dialogue: ["口语", "Speaking", "自然开口回应"],
  };

  function markComplete(skill: Skill) {
    setCompleted(current => current.includes(skill) ? current : [...current, skill]);
  }

  function play(text: string) {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale;
    window.speechSynthesis.speak(utterance);
  }

  function nextCard() {
    setRevealed(false);
    if (cardIndex + 1 >= cards.length) {
      markComplete("vocabulary");
      return;
    }
    setCardIndex(current => current + 1);
  }

  const answer = task ? answers[task.taskId] || "" : "";
  return <section className="trial-shell" data-layout-fill="anonymous-trial" data-layout-ready="true">
    <header className="trial-hero" data-layout-fill="anonymous-trial-hero">
      <div><p>FREE TRIAL · BEGINNER</p><h1 data-layout-text-fit="anonymous-trial-title">{languageName} · {zh ? "初级课程试学" : "Beginner course trial"}</h1><span data-readable-copy="anonymous-trial-intro">{zh ? "无需登录即可体验课程学习面板。所有操作只在当前页面内生效，刷新后重置，不会写入账户或数据库。" : "Try the course dashboard without signing in. Everything stays in this page's memory, resets on refresh, and is never written to an account or database."}</span></div>
      <aside><strong>{completed.length} / {SKILLS.length}</strong><span>{zh ? "本次试学进度" : "trial progress"}</span></aside>
    </header>

    <nav className="trial-tabs" aria-label={zh ? "试学训练项目" : "Trial activities"}>{SKILLS.map(skill => <button className={active === skill ? "active" : ""} onClick={() => setActive(skill)} key={skill}><i aria-hidden="true">{completed.includes(skill) ? "✓" : String(SKILLS.indexOf(skill) + 1).padStart(2, "0")}</i><span><strong>{zh ? labels[skill][0] : labels[skill][1]}</strong><small>{labels[skill][2]}</small></span></button>)}</nav>

    <article className="trial-activity" style={{ "--trial-accent": ACCENTS[active] } as CSSProperties} data-layout-fill="anonymous-trial-activity">
      <header><div><span>{String(SKILLS.indexOf(active) + 1).padStart(2, "0")}</span><h2>{zh ? labels[active][0] : labels[active][1]}</h2></div><small>{completed.includes(active) ? (zh ? "本次已完成" : "Completed this trial") : (zh ? "匿名演示" : "Anonymous demo")}</small></header>
      {active === "vocabulary" && card ? <div className="trial-card" dir={direction}>
        <p>{cardIndex + 1} / {cards.length}</p>
        <button type="button" onClick={() => setRevealed(value => !value)} aria-label={zh ? "翻转智慧卡" : "Flip SmartCard"}><strong>{revealed ? card.meaning[lang] : card.form}</strong>{!revealed && card.pronunciation ? <span>{card.pronunciation}</span> : null}<small>{revealed ? (zh ? "点一下返回单词" : "Tap to see the word") : (zh ? "点一下查看意思" : "Tap to see the meaning")}</small></button>
        <div><button type="button" onClick={() => play(card.form)}>▶ {zh ? "播放发音" : "Play sound"}</button><button type="button" disabled={!revealed} onClick={nextCard}>{cardIndex + 1 >= cards.length ? (zh ? "完成词汇试学" : "Finish vocabulary") : (zh ? "下一张" : "Next card")} →</button></div>
      </div> : null}
      {active !== "vocabulary" && task ? <div className="trial-task" dir={task.direction || direction}>
        <p>{zh ? "今日练习" : "TODAY'S PRACTICE"}</p><h3>{task.prompt}</h3>{task.context ? <blockquote>{task.context}</blockquote> : null}
        {task.audioText ? <button className="trial-audio" type="button" onClick={() => play(task.audioText || "")}>▶ {zh ? "播放练习音频" : "Play practice audio"}</button> : null}
        {task.options?.length ? <div className="trial-options">{task.options.map(option => <button className={answer === option.id ? "selected" : ""} type="button" onClick={() => setAnswers(current => ({ ...current, [task.taskId]: option.id }))} key={option.id}>{option.label}</button>)}</div> : <label><span>{zh ? "您的回答" : "Your response"}</span><textarea value={answer} onChange={event => setAnswers(current => ({ ...current, [task.taskId]: event.target.value }))} placeholder={zh ? "在这里试着回答……" : "Try your response here…"}/></label>}
        <button className="trial-complete" type="button" disabled={!answer.trim()} onClick={() => markComplete(active)}>{completed.includes(active) ? (zh ? "✓ 已完成本次练习" : "✓ Completed for this trial") : (zh ? "完成本项练习" : "Complete this activity")}</button>
      </div> : null}
    </article>

    <section className="trial-cta" data-layout-fill="anonymous-trial-cta"><div><p>{zh ? "喜欢这个学习方式？" : "Like this way of learning?"}</p><h2>{zh ? "免费注册，开启完整首月课程。" : "Create an account and start your full free month."}</h2><span>{zh ? "登录后才会保存进度、分数、21 天词汇记忆和证书记录。" : "Progress, scores, 21-day vocabulary memory, and certificates are saved only after sign-in."}</span></div><nav><Link href={`/${lang}/auth/sign-up?returnTo=${encodeURIComponent(`/${lang}/classes/course_${language}_basic`)}`}>{zh ? "免费注册" : "Create free account"} →</Link><Link href={`/${lang}/programs/${language}`}>{zh ? "返回课程详情" : "Back to course"}</Link></nav></section>
    <style>{`.trial-shell,.trial-shell *{box-sizing:border-box}.trial-shell{width:100%;min-width:0;padding:clamp(44px,7vw,88px) clamp(16px,4vw,58px) 100px;display:grid;gap:28px;color:var(--ink)}.trial-hero{width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:24px}.trial-hero>div{min-width:0}.trial-hero p,.trial-task>p,.trial-cta p{margin:0;color:#087d62;font-size:12px;font-weight:950;letter-spacing:.12em}.trial-hero h1{max-width:none;margin:10px 0 16px;font:850 clamp(40px,6vw,76px)/1.02 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.05em;overflow-wrap:anywhere}.trial-hero>div>span{display:block;max-width:76ch;color:#5a6d66;font-size:17px;line-height:1.7}.trial-hero aside{min-width:170px;padding:22px;border-radius:20px;background:#123f35;color:#fff}.trial-hero aside strong{display:block;font-size:38px}.trial-hero aside span{color:#bfdbd2}.trial-tabs{width:100%;min-width:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.trial-tabs button{min-width:0;padding:15px;display:flex;align-items:center;gap:10px;border:1px solid #cad8d2;border-radius:15px;background:#fff;text-align:left}.trial-tabs button.active{border-color:#087d62;background:#e7f7f0;box-shadow:inset 0 0 0 1px #087d62}.trial-tabs i{flex:0 0 32px;height:32px;display:grid;place-items:center;border-radius:50%;background:#123f35;color:#fff;font-style:normal;font-size:11px;font-weight:900}.trial-tabs span{min-width:0}.trial-tabs strong,.trial-tabs small{display:block;overflow-wrap:anywhere}.trial-tabs small{margin-top:3px;color:#65766f;line-height:1.35}.trial-activity{width:100%;min-width:0;padding:clamp(22px,4vw,44px);border:1px solid #d3dfda;border-left:6px solid var(--trial-accent);border-radius:24px;background:#fffdf8}.trial-activity>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}.trial-activity>header>div{display:flex;align-items:baseline;gap:12px}.trial-activity>header span{color:var(--trial-accent);font-weight:900}.trial-activity h2{margin:0;font-size:clamp(28px,4vw,44px)}.trial-activity>header>small{padding:7px 10px;border-radius:999px;background:#eef5f1;color:#557068}.trial-card{margin-top:24px}.trial-card>p{font-weight:900;color:#087d62}.trial-card>button{width:100%;min-height:300px;padding:30px;display:grid;place-items:center;align-content:center;gap:10px;border:0;border-radius:22px;background:linear-gradient(145deg,#0c5b4b,#123f35);color:#fff}.trial-card>button strong{max-width:100%;font-size:clamp(42px,7vw,76px);overflow-wrap:anywhere}.trial-card>button span,.trial-card>button small{color:#cce8df}.trial-card>div{margin-top:12px;display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}.trial-card>div button,.trial-audio,.trial-complete{min-height:46px;padding:10px 16px;border:1px solid #a8c9bd;border-radius:999px;background:#fff;color:#08745e;font-weight:850}.trial-card>div button:last-child,.trial-complete{background:#087d62;color:#fff}.trial-card button:disabled,.trial-complete:disabled{cursor:not-allowed;opacity:.45}.trial-task{margin-top:28px}.trial-task h3{max-width:100%;margin:9px 0;font-size:clamp(24px,3vw,38px);overflow-wrap:anywhere}.trial-task blockquote{max-width:76ch;margin:18px 0;padding:16px;border-left:4px solid var(--trial-accent);background:#f1f6f3;line-height:1.65}.trial-options{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.trial-options button{min-height:52px;padding:12px;border:1px solid #c8d6d0;border-radius:13px;background:#fff;text-align:left;font:750 16px/1.4 inherit}.trial-options button.selected{border-color:#087d62;background:#e5f6ef}.trial-task label{margin-top:18px;display:grid;gap:8px;font-weight:850}.trial-task textarea{width:100%;min-height:125px;padding:14px;border:1px solid #b9cbc3;border-radius:13px;font:16px/1.5 inherit;resize:vertical}.trial-complete{margin-top:18px}.trial-cta{width:100%;min-width:0;padding:clamp(24px,4vw,46px);display:flex;align-items:center;justify-content:space-between;gap:24px;border-radius:25px;background:#123f35;color:#fff}.trial-cta h2{margin:8px 0;font-size:clamp(28px,4vw,46px)}.trial-cta>div>span{color:#c7dbd4}.trial-cta nav{display:grid;gap:9px;min-width:210px}.trial-cta a{min-height:48px;padding:11px 17px;display:flex;align-items:center;justify-content:center;border:1px solid #72d4b4;border-radius:999px;color:#fff;font-weight:850;text-align:center}.trial-cta a:first-child{background:#69d6b1;color:#123f35}@media(max-width:980px){.trial-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.trial-hero{grid-template-columns:1fr}.trial-hero aside{width:100%}.trial-tabs{grid-template-columns:1fr 1fr}.trial-cta{display:grid}.trial-cta nav{width:100%}}@media(max-width:430px){.trial-shell{padding-inline:14px}.trial-tabs{grid-template-columns:1fr}.trial-activity{padding:20px 15px}.trial-options{grid-template-columns:1fr}.trial-card>button{min-height:250px;padding:22px 14px}.trial-card>div{display:grid}.trial-card>div button{width:100%}}`}</style>
  </section>;
}
