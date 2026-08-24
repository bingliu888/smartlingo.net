"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { rememberTargetLanguage } from "./InterfaceLanguageMenu";
import type { InterfaceLanguage } from "../lib/interface-locale";

const DURATIONS = [5, 10, 15, 20] as const;

const sprintCopy = {
  en:{title:"Today’s Sprint",body:"Choose a language and time for one mixed five-skill session",choose:"Choose language and time",close:"Close",heading:"Choose a language and today’s learning time",intro:"Ten minutes is selected by default. Every five minutes completes one vocabulary, reading, listening, writing, and speaking round.",stepLanguage:"1. Choose a language",stepTime:"2. Choose a time",minute:"min",round:"round",rounds:"rounds",start:"Start today’s {minutes}-minute Sprint",first:"Choose a language first"},
  zh:{title:"今日速成",body:"选择语言和时长，完成一轮五技能学习",choose:"选择语言与时长",close:"关闭",heading:"选择语言和今天的学习时间",intro:"默认 10 分钟；每 5 分钟完成一轮词汇、阅读、听力、写作和口语。",stepLanguage:"1. 选择语言",stepTime:"2. 选择时长",minute:"分钟",round:"回合",rounds:"回合",start:"开始 {minutes} 分钟今日速成",first:"请先选择语言"},
  ja:{title:"今日の速習",body:"言語と時間を選び、5技能の総合学習を1ラウンド完了します",choose:"言語と時間を選ぶ",close:"閉じる",heading:"言語と今日の学習時間を選択",intro:"初期設定は10分です。5分ごとに語彙・読解・リスニング・作文・会話を1ラウンド学習します。",stepLanguage:"1. 言語を選択",stepTime:"2. 時間を選択",minute:"分",round:"ラウンド",rounds:"ラウンド",start:"{minutes}分の今日の速習を開始",first:"先に言語を選択してください"},
  ko:{title:"오늘의 속성 학습",body:"언어와 시간을 선택해 5가지 기술 종합 학습을 한 라운드 완료합니다",choose:"언어와 시간 선택",close:"닫기",heading:"언어와 오늘의 학습 시간 선택",intro:"기본값은 10분입니다. 5분마다 어휘·읽기·듣기·쓰기·말하기 한 라운드를 완료합니다.",stepLanguage:"1. 언어 선택",stepTime:"2. 시간 선택",minute:"분",round:"라운드",rounds:"라운드",start:"{minutes}분 오늘의 속성 학습 시작",first:"먼저 언어를 선택하세요"},
} as const;

export function PlayDailySprintPicker({ lang, initialLanguage, triggerClassName, triggerLabel, children }: { lang: InterfaceLanguage; initialLanguage?: string; triggerClassName?: string; triggerLabel?: string; children?: ReactNode }) {
  const t = sprintCopy[lang as keyof typeof sprintCopy] ?? sprintCopy.en;
  const [open, setOpen] = useState(false);
  const initialTarget = initialLanguage || "";
  const [selection, setSelection] = useState({ source: initialTarget, value: initialTarget });
  const language = selection.source === initialTarget ? selection.value : initialTarget;
  const [minutes, setMinutes] = useState<(typeof DURATIONS)[number]>(10);

  useEffect(() => {
    if (!open) return;
    function close(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return <>
    <button className={triggerClassName || "game-tile daily-sprint-tile"} type="button" onClick={() => setOpen(true)} aria-label={triggerLabel}>
      {children || <><small>01 · DAILY SPRINT</small>
        <strong>{t.title}</strong><em>{t.body}</em><b>{t.choose} →</b></>}
    </button>
    {open ? <div className="play-sprint-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="play-sprint-picker" role="dialog" aria-modal="true" aria-labelledby="play-sprint-title">
        <button className="play-sprint-close" type="button" onClick={() => setOpen(false)} aria-label={t.close}>×</button>
        <p>DAILY SPRINT</p>
        <h2 id="play-sprint-title">{t.heading}</h2><span>{t.intro}</span><h3>{t.stepLanguage}</h3>
        <div className="play-sprint-languages">{SMARTLINGO_LANGUAGE_COMMUNITIES.map(item => <button type="button" aria-pressed={language === item.code} className={language === item.code ? "selected" : ""} onClick={() => { setSelection({ source: initialTarget, value: item.code }); rememberTargetLanguage(item.code); }} key={item.code}><small>{item.code.toUpperCase()}</small><strong>{item.nativeName}</strong><span>{item.nameEn}</span></button>)}</div>
        <h3>{t.stepTime}</h3><div className="play-sprint-times">{DURATIONS.map(value => <button type="button" aria-pressed={minutes === value} className={minutes === value ? "selected" : ""} onClick={() => setMinutes(value)} key={value}><strong>{value}</strong><span>{t.minute}</span><small>{value / 5} {value === 5 ? t.round : t.rounds}</small></button>)}</div>
        {language ? <Link className="play-sprint-start" href={`/${lang}/classes/course_${language}_basic/sprint?minutes=${minutes}&source=play&fresh=1`}>{t.start.replace("{minutes}", String(minutes))} →</Link> : <button className="play-sprint-start" type="button" disabled>{t.first}</button>}
      </section>
    </div> : null}
    <style>{`.play-sprint-backdrop{position:fixed;z-index:1000;inset:0;padding:18px;display:grid;place-items:center;background:#071c17c2}.play-sprint-picker{position:relative;width:min(880px,100%);max-height:calc(100dvh - 36px);padding:clamp(24px,5vw,44px);overflow:auto;border-radius:28px;background:#f7f3ea;color:#153129;box-shadow:0 32px 100px #041a1455}.play-sprint-close{position:absolute;right:18px;top:18px;width:44px;height:44px;border:0;border-radius:12px;background:#123f35;color:#fff;font-size:27px}.play-sprint-picker>p{margin:0;color:#087d62;font-size:12px;font-weight:950;letter-spacing:.14em}.play-sprint-picker>h2{max-width:720px;margin:9px 0 12px;font-size:clamp(34px,5vw,55px);line-height:1.03}.play-sprint-picker>span{display:block;max-width:70ch;color:#60726b;line-height:1.65}.play-sprint-picker>h3{margin:28px 0 12px;font-size:18px}.play-sprint-languages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.play-sprint-languages button{min-width:0;min-height:82px;padding:12px;display:grid;gap:3px;border:1px solid #c8d8d1;border-radius:14px;background:#fff;color:#153129;text-align:left}.play-sprint-languages button.selected,.play-sprint-times button.selected{border:2px solid #087d62;background:#e2f6ed}.play-sprint-languages small{color:#087d62;font-weight:950}.play-sprint-languages span{color:#6b7a75;font-size:12px;overflow-wrap:anywhere}.play-sprint-times{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.play-sprint-times button{min-width:0;padding:14px;display:grid;grid-template-columns:auto 1fr;align-items:end;gap:2px 7px;border:1px solid #c8d8d1;border-radius:15px;background:#fff;color:#153129;text-align:left}.play-sprint-times strong{font-size:31px}.play-sprint-times small{grid-column:1/-1;color:#087d62}.play-sprint-start{min-height:56px;margin-top:25px;padding:13px 18px;display:flex;align-items:center;justify-content:center;border:0;border-radius:15px;background:#087d62;color:#fff;font-weight:900;text-align:center}.play-sprint-start:disabled{opacity:.45}@media(max-width:720px){.play-sprint-languages{grid-template-columns:repeat(2,minmax(0,1fr))}.play-sprint-times{grid-template-columns:repeat(2,minmax(0,1fr))}}`}</style>
  </>;
}
