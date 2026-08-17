"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Card = { id: string; form: string; pronunciation: string; meaningEn: string; meaningZh: string; sceneKey: string; difficulty: number };
type Question = { id: string; mode: "recognition" | "listening" | "recall" | "typing"; promptEn: string; promptZh: string; audioText?: string; options?: { value: string; labelEn: string; labelZh: string }[] };
type Deck = { id: string; ownerUserId: string; ownerName: string; title: string; shareToken: string; itemCount: number; bestScore: number | null; cards: Card[]; challenge: Question[] };
type Payload = { decks?: Deck[]; balancePoints?: number; policy?: { pointsPerUsd: number; passScore: number; rewardPoints: number; dailyEarnCap: number; maxMonthlyRedemptionPercent: number }; error?: string };

export function SmartCardStudio({ lang, classId }: { lang: "en" | "zh"; classId: string }) {
  const zh = lang === "zh";
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/smartcards`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as Payload;
    if (!response.ok) throw new Error(payload.error || "LOAD_FAILED");
    setData(payload);
    setSelected(current => current || payload.decks?.[0]?.id || "");
  }, [classId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load().catch(() => setMessage(zh ? "暂时无法读取 SmartCard。" : "SmartCards are temporarily unavailable.")); }, 0); return () => window.clearTimeout(timer); }, [load, zh]);

  async function generate() {
    setBusy("generate"); setMessage("");
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/smartcards`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "generate", title: zh ? "我的智能词卡" : "My SmartCards" }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; deckId?: string };
    if (response.ok) { await load(); setSelected(payload.deckId || ""); setMessage(zh ? "已从本课程已审核词库生成并公开分享。" : "Generated from this course's reviewed vocabulary and ready to share."); }
    else setMessage(payload.error || (zh ? "无法生成词卡。" : "Unable to generate SmartCards."));
    setBusy("");
  }

  async function share(deck: Deck) {
    const url = `${window.location.origin}/${lang}/smartcards/${encodeURIComponent(deck.shareToken)}`;
    try { await navigator.clipboard.writeText(url); setMessage(zh ? "挑战链接已复制。" : "Challenge link copied."); }
    catch { setMessage(url); }
  }

  async function challenge(deck: Deck) {
    setBusy(`challenge:${deck.id}`); setMessage("");
    const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/smartcards`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "challenge", deckId: deck.id, answers, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; score?: number; rewardPoints?: number; balancePoints?: number };
    if (response.ok) {
      setMessage(zh ? `得分 ${payload.score}/100，获得 ${payload.rewardPoints || 0} 点；余额 ${payload.balancePoints || 0} 点。` : `Score ${payload.score}/100. Earned ${payload.rewardPoints || 0} points; balance ${payload.balancePoints || 0}.`);
      await load();
    } else setMessage(payload.error || (zh ? "无法提交挑战。" : "Unable to submit challenge."));
    setBusy("");
  }

  const deck = data?.decks?.find(item => item.id === selected) || null;
  return <section className="sl-smartcard-studio" aria-labelledby="sl-smartcard-title">
    <header><div><p>SMARTCARD · SOCIAL LEARNING</p><h4 id="sl-smartcard-title">{zh ? "学、分享、挑战，再用积分抵课程费" : "Learn, share, challenge, and offset course fees"}</h4><Link href={`/${lang}/smartcards/tutorial`}>{zh ? "打开课程教程" : "Open course tutorial"} →</Link></div><button type="button" onClick={() => void generate()} disabled={Boolean(busy)}>{busy === "generate" ? "…" : (zh ? "生成 SmartCard" : "Generate SmartCards")}</button></header>
    <p>{zh ? "词卡只取自已发布的审核词库。挑战首次达到 80 分可得 10 点，每日最多 50 点；100 点抵 1 美元，当月最多抵全额。自己挑战自己的词卡不发可抵扣积分。" : "Cards use published, reviewed vocabulary only. A first score of 80 earns 10 points, capped at 50 daily. 100 points offset $1, up to the full monthly fee. Self-challenges do not earn redeemable points."}</p>
    <div className="sl-smartcard-balance"><span>{zh ? "课程积分" : "Course credit"}</span><strong>{data?.balancePoints ?? 0}</strong><small>100 {zh ? "点" : "points"} = $1</small></div>
    {data?.decks?.length ? <div className="sl-smartcard-tabs">{data.decks.map(item => <button type="button" className={item.id === deck?.id ? "active" : ""} onClick={() => { setSelected(item.id); setAnswers({}); setRevealed({}); }} key={item.id}>{item.title}<small>{item.ownerName} · {item.itemCount}</small></button>)}</div> : <p className="sl-smartcard-empty">{zh ? "还没有词卡。生成第一套课程词卡，邀请同学挑战。" : "No decks yet. Generate the first course deck and invite classmates."}</p>}
    {deck ? <div className="sl-smartcard-deck"><div className="sl-smartcard-share"><strong>{deck.title}</strong><span>{deck.bestScore === null ? (zh ? "尚未挑战" : "Not challenged") : `${zh ? "最佳" : "Best"} ${deck.bestScore}/100`}</span><button type="button" onClick={() => void share(deck)}>{zh ? "复制分享链接" : "Copy share link"}</button></div>
      <div className="sl-smartcard-grid">{deck.cards.map((card, index) => <article key={card.id}>
        <small>{String(index + 1).padStart(2, "0")} · {card.sceneKey}</small><strong>{revealed[card.id] ? card.form : (zh ? card.meaningZh : card.meaningEn)}</strong>{revealed[card.id] && card.pronunciation ? <span>{card.pronunciation}</span> : null}
        <button type="button" onClick={() => setRevealed(current => ({ ...current, [card.id]: !current[card.id] }))}>{revealed[card.id] ? (zh ? "显示问题" : "Show prompt") : (zh ? "翻卡学习" : "Flip to learn")}</button>
      </article>)}</div>
      <div className="sl-smartcard-challenge"><h5>{zh ? "混合模式挑战" : "Mixed-mode challenge"}</h5>{deck.challenge.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {zh ? question.promptZh : question.promptEn}</legend>{question.audioText ? <button type="button" onClick={() => { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(question.audioText)); }}>▶ {zh ? "播放发音" : "Play audio"}</button> : null}{question.options ? <div>{question.options.map(option => <label key={option.value}><input type="radio" name={question.id} checked={answers[question.id] === option.value} onChange={() => setAnswers(current => ({ ...current, [question.id]: option.value }))}/><span>{zh ? option.labelZh : option.labelEn}</span></label>)}</div> : <input value={answers[question.id] || ""} maxLength={120} autoComplete="off" onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}/>}</fieldset>)}</div>
      <button className="sl-smartcard-submit" type="button" disabled={Boolean(busy) || deck.challenge.some(question => !answers[question.id]?.trim())} onClick={() => void challenge(deck)}>{busy === `challenge:${deck.id}` ? "…" : (zh ? "提交本版本挑战" : "Submit this version challenge")}</button>
    </div> : null}
    {message ? <p className="sl-smartcard-message" role="status">{message}</p> : null}
    <style>{`.sl-smartcard-studio{width:100%;min-width:0;margin-top:22px;padding:clamp(20px,4vw,34px);display:grid;gap:18px;border:1px solid #b9d9cc;border-radius:22px;background:linear-gradient(145deg,#f3fff9,#fffaf0)}.sl-smartcard-studio>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.sl-smartcard-studio h4{margin:5px 0 0;font-size:clamp(24px,3vw,35px)}.sl-smartcard-studio header p{margin:0;color:#087d62;font-size:11px;font-weight:950;letter-spacing:.08em}.sl-smartcard-studio>header button,.sl-smartcard-share button,.sl-smartcard-submit{min-height:44px;padding:10px 16px;border:0;border-radius:999px;background:#087d62;color:#fff;font-weight:850;cursor:pointer}.sl-smartcard-studio button:disabled{cursor:not-allowed;opacity:.45}.sl-smartcard-studio>p{max-width:78ch;margin:0;color:#536760;line-height:1.6}.sl-smartcard-balance{display:flex;align-items:baseline;gap:10px;padding:14px 17px;border-radius:14px;background:#123f35;color:#fff}.sl-smartcard-balance strong{font-size:30px}.sl-smartcard-balance small{margin-left:auto;color:#c7dfd7}.sl-smartcard-tabs{display:flex;gap:8px;overflow:auto}.sl-smartcard-tabs button{min-width:180px;padding:11px;border:1px solid #bad0c7;border-radius:12px;background:#fff;text-align:left;font-weight:850}.sl-smartcard-tabs button.active{border-color:#087d62;box-shadow:inset 0 0 0 1px #087d62}.sl-smartcard-tabs small{display:block;margin-top:5px;color:#62736d}.sl-smartcard-share{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.sl-smartcard-share>span{color:#60716b}.sl-smartcard-share>button{margin-left:auto}.sl-smartcard-grid{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sl-smartcard-grid article{padding:16px;display:grid;gap:10px;border:1px solid #cfddd7;border-radius:15px;background:#fff}.sl-smartcard-grid article>small{color:#71817b}.sl-smartcard-grid article>strong{font-size:21px}.sl-smartcard-grid article>button{justify-self:start;border:0;background:transparent;color:#087d62;font-weight:850}.sl-smartcard-challenge{margin-top:18px;display:grid;gap:9px}.sl-smartcard-challenge h5{margin:0;font-size:20px}.sl-smartcard-challenge fieldset{min-width:0;padding:13px;border:1px solid #c8d8d1;border-radius:12px;background:#fff}.sl-smartcard-challenge legend{font-weight:850}.sl-smartcard-challenge fieldset>button{margin:7px 0;padding:7px 11px;border:0;border-radius:999px;background:#e2f4ed;color:#08745e;font-weight:800}.sl-smartcard-challenge fieldset>div{display:grid;grid-template-columns:1fr 1fr;gap:6px}.sl-smartcard-challenge label{padding:9px;display:flex;gap:7px;border-radius:9px;background:#f0f6f3}.sl-smartcard-challenge fieldset>input{width:100%;padding:10px;border:1px solid #aebfb8;border-radius:9px;font:16px inherit}.sl-smartcard-submit{width:100%;margin-top:14px}.sl-smartcard-message{padding:12px!important;border-radius:10px;background:#e2f5ed;color:#08745e!important;font-weight:800}.sl-smartcard-empty{padding:20px;border:1px dashed #a9beb5;border-radius:13px}@media(max-width:700px){.sl-smartcard-studio>header{display:grid}.sl-smartcard-studio>header button{width:100%}.sl-smartcard-grid,.sl-smartcard-challenge fieldset>div{grid-template-columns:1fr}.sl-smartcard-share>button{width:100%;margin-left:0}.sl-smartcard-balance{flex-wrap:wrap}.sl-smartcard-balance small{width:100%;margin-left:0}}`}</style>
  </section>;
}
