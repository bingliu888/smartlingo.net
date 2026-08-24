"use client";

import { SMARTLINGO_LEARNING_DAYS, learningDayTopic, safeLearningDay, type SmartLingoLearningLevel } from "../lib/smartlingo-learning-days";

export function LearningDayPicker({ day, level = "beginner", lang, onChange, compact = false, maxDay = SMARTLINGO_LEARNING_DAYS }: {
  day: number;
  level?: SmartLingoLearningLevel;
  lang: "zh" | "en";
  onChange(day: number): void;
  compact?: boolean;
  maxDay?: number;
}) {
  const limit=Math.max(1,Math.min(SMARTLINGO_LEARNING_DAYS,Math.round(maxDay))),value = Math.min(limit,safeLearningDay(day)), topic = learningDayTopic(level, value), zh = lang === "zh";
  return <section className={`learning-day-picker${compact ? " compact" : ""}`} aria-label={zh ? "选择学习日" : "Choose learning day"}>
    <div><small>{zh ? "从第几天开始" : "START FROM DAY"}</small><strong>{zh ? `第 ${value} 天` : `Day ${value}`}</strong><span>{zh ? topic.zh : topic.en}</span></div>
    <nav>
      <button type="button" onClick={() => onChange(1)} disabled={value === 1} aria-label={zh ? "第一天" : "Day 1"}>≪</button>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value === 1} aria-label={zh ? "前一天" : "Previous day"}>‹</button>
      <output>{value}<small>/ {limit}</small></output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value === limit} aria-label={zh ? "后一天" : "Next day"}>›</button>
      <button type="button" onClick={() => onChange(limit)} disabled={value === limit} aria-label={zh ? `第 ${limit} 天` : `Day ${limit}`}>≫</button>
    </nav>
    <style>{`.learning-day-picker{padding:15px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;border:1px solid #bdd3ca;border-radius:16px;background:#f5fbf8;color:#17342c}.learning-day-picker>div{display:grid;gap:2px}.learning-day-picker small{color:#087d62;font-size:10px;font-weight:950;letter-spacing:.08em}.learning-day-picker strong{font-size:21px}.learning-day-picker span{color:#5f736b;font-size:13px}.learning-day-picker nav{display:flex;align-items:center;gap:5px}.learning-day-picker button{width:38px;height:38px;padding:0;border:1px solid #b7ccc4;border-radius:10px;background:#fff;color:#0a6f57;font-size:22px;font-weight:900}.learning-day-picker button:disabled{opacity:.3}.learning-day-picker output{min-width:58px;text-align:center;color:#123f35;font-size:22px;font-weight:950}.learning-day-picker output small{display:block;color:#698078;letter-spacing:0}.learning-day-picker.compact{padding:11px}.learning-day-picker.compact span{display:none}@media(max-width:560px){.learning-day-picker{grid-template-columns:1fr}.learning-day-picker nav{justify-content:space-between}}`}</style>
  </section>;
}
