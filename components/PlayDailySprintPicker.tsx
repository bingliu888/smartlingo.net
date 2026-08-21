"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";
import { rememberTargetLanguage } from "./InterfaceLanguageMenu";

const DURATIONS = [5, 10, 15, 20] as const;

export function PlayDailySprintPicker({ lang, initialLanguage, triggerClassName, triggerLabel, children }: { lang: "zh" | "en"; initialLanguage?: string; triggerClassName?: string; triggerLabel?: string; children?: ReactNode }) {
  const zh = lang === "zh";
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(initialLanguage || "");
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
        <strong>{zh ? "今日速成" : "Today’s Sprint"}</strong>
        <em>{zh ? "选择语言和时长，完成一轮五技能学习" : "Choose a language and time for one mixed five-skill session"}</em>
        <b>{zh ? "选择语言与时长" : "Choose language and time"} →</b></>}
    </button>
    {open ? <div className="play-sprint-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="play-sprint-picker" role="dialog" aria-modal="true" aria-labelledby="play-sprint-title">
        <button className="play-sprint-close" type="button" onClick={() => setOpen(false)} aria-label={zh ? "关闭" : "Close"}>×</button>
        <p>DAILY SPRINT</p>
        <h2 id="play-sprint-title">{zh ? "选择语言和今天的学习时间" : "Choose a language and today’s learning time"}</h2>
        <span>{zh ? "默认 10 分钟；每 5 分钟完成一轮词汇、阅读、听力、写作和口语。" : "Ten minutes is selected by default. Every five minutes completes one vocabulary, reading, listening, writing, and speaking round."}</span>
        <h3>{zh ? "1. 选择语言" : "1. Choose a language"}</h3>
        <div className="play-sprint-languages">{SMARTLINGO_LANGUAGE_COMMUNITIES.map(item => <button type="button" aria-pressed={language === item.code} className={language === item.code ? "selected" : ""} onClick={() => { setLanguage(item.code); rememberTargetLanguage(item.code); }} key={item.code}><small>{item.code.toUpperCase()}</small><strong>{zh ? item.nameZh : item.nameEn}</strong><span>{item.nativeName}</span></button>)}</div>
        <h3>{zh ? "2. 选择时长" : "2. Choose a time"}</h3>
        <div className="play-sprint-times">{DURATIONS.map(value => <button type="button" aria-pressed={minutes === value} className={minutes === value ? "selected" : ""} onClick={() => setMinutes(value)} key={value}><strong>{value}</strong><span>{zh ? "分钟" : "min"}</span><small>{value / 5} {zh ? "回合" : value === 5 ? "round" : "rounds"}</small></button>)}</div>
        {language ? <Link className="play-sprint-start" href={`/${lang}/classes/course_${language}_basic/sprint?minutes=${minutes}&source=play`}>{zh ? `开始 ${minutes} 分钟今日速成` : `Start today’s ${minutes}-minute Sprint`} →</Link> : <button className="play-sprint-start" type="button" disabled>{zh ? "请先选择语言" : "Choose a language first"}</button>}
      </section>
    </div> : null}
    <style>{`.play-sprint-backdrop{position:fixed;z-index:1000;inset:0;padding:18px;display:grid;place-items:center;background:#071c17c2}.play-sprint-picker{position:relative;width:min(880px,100%);max-height:calc(100dvh - 36px);padding:clamp(24px,5vw,44px);overflow:auto;border-radius:28px;background:#f7f3ea;color:#153129;box-shadow:0 32px 100px #041a1455}.play-sprint-close{position:absolute;right:18px;top:18px;width:44px;height:44px;border:0;border-radius:12px;background:#123f35;color:#fff;font-size:27px}.play-sprint-picker>p{margin:0;color:#087d62;font-size:12px;font-weight:950;letter-spacing:.14em}.play-sprint-picker>h2{max-width:720px;margin:9px 0 12px;font-size:clamp(34px,5vw,55px);line-height:1.03}.play-sprint-picker>span{display:block;max-width:70ch;color:#60726b;line-height:1.65}.play-sprint-picker>h3{margin:28px 0 12px;font-size:18px}.play-sprint-languages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.play-sprint-languages button{min-width:0;min-height:82px;padding:12px;display:grid;gap:3px;border:1px solid #c8d8d1;border-radius:14px;background:#fff;color:#153129;text-align:left}.play-sprint-languages button.selected,.play-sprint-times button.selected{border:2px solid #087d62;background:#e2f6ed}.play-sprint-languages small{color:#087d62;font-weight:950}.play-sprint-languages span{color:#6b7a75;font-size:12px;overflow-wrap:anywhere}.play-sprint-times{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.play-sprint-times button{min-width:0;padding:14px;display:grid;grid-template-columns:auto 1fr;align-items:end;gap:2px 7px;border:1px solid #c8d8d1;border-radius:15px;background:#fff;color:#153129;text-align:left}.play-sprint-times strong{font-size:31px}.play-sprint-times small{grid-column:1/-1;color:#087d62}.play-sprint-start{min-height:56px;margin-top:25px;padding:13px 18px;display:flex;align-items:center;justify-content:center;border:0;border-radius:15px;background:#087d62;color:#fff;font-weight:900;text-align:center}.play-sprint-start:disabled{opacity:.45}@media(max-width:720px){.play-sprint-languages{grid-template-columns:repeat(2,minmax(0,1fr))}.play-sprint-times{grid-template-columns:repeat(2,minmax(0,1fr))}}`}</style>
  </>;
}
