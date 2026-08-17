"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SmartLingoPackageTier } from "../lib/smartlingo-course-packages";

export function CourseTrainingMenu({ lang, classId }: { lang: "zh" | "en"; classId: string }) {
  const zh = lang === "zh";
  const [tier, setTier] = useState<SmartLingoPackageTier>("basic");
  useEffect(() => {
    fetch(`/api/classes/${encodeURIComponent(classId)}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.class?.packageTier) setTier(data.class.packageTier); })
      .catch(() => undefined);
  }, [classId]);
  const base = `/${lang}/classes/${encodeURIComponent(classId)}/learn/session`;
  const items = [
    { key: "vocab", icon: "Aa", title: zh ? "词汇" : "Vocabulary", copy: zh ? "词卡 · 主动回忆 · 连续掌握" : "Flashcards · active recall · mastery", href: `${base}?training=vocabulary` },
    { key: "speaking", icon: "◉", title: zh ? "口语" : "Speaking", copy: zh ? "跟我说 · 回答我 · 即时纠正" : "Repeat · answer · instant correction", href: `${base}?training=dialogue` },
    { key: "listening", icon: "◒", title: zh ? "听力" : "Listening", copy: zh ? "听辨语音 · 理解语境" : "Sound recognition · context", href: `${base}?training=listening` },
    { key: "writing", icon: "✎", title: zh ? "写作" : "Writing", copy: zh ? "组织表达 · 修改建议" : "Structured writing · guided revision", href: `${base}?training=writing` },
    { key: "quiz", icon: "?", title: zh ? "测验" : "Quiz", copy: zh ? "词汇与情境题 · 即时判分" : "Vocabulary and scenarios · instant scoring", href: `${base}?training=quiz` },
    ...(tier === "advanced" ? [
      { key: "accent", icon: "◎", title: zh ? "口音校正" : "Accent correction", copy: zh ? "跟读比较 · 发音纠正" : "Speak and compare · correction", href: `${base}?training=dialogue&focus=accent` },
      { key: "speech", icon: "▰", title: zh ? "演讲训练" : "Speech training", copy: zh ? "演讲表达 · 人工智能反馈" : "Delivery practice · AI feedback", href: `${base}?training=dialogue&focus=speech` },
      { key: "draft", icon: "¶", title: zh ? "演讲稿修改" : "Speech-draft revision", copy: zh ? "结构、用词与表达润色" : "Structure, wording, and polish", href: `${base}?training=writing&focus=speech-draft` },
    ] : []),
  ];
  return <section className="course-training-menu" aria-labelledby="course-training-title">
    <header><p>{zh ? "每日练习" : "DAILY PRACTICE"}</p><h1 id="course-training-title">{zh ? "选择训练方式" : "Choose your training"}</h1><span>{zh ? "课程等级决定可用训练内容。" : "Your course level determines the available training."}</span></header>
    <div>{items.map(item => <Link href={item.href} key={item.key}><i aria-hidden="true">{item.icon}</i><strong>{item.title}</strong><small>{item.copy}</small><b>{zh ? "开始训练" : "Start training"} →</b></Link>)}</div>
    <style>{`.course-training-menu{width:min(1200px,calc(100% - 40px));margin:44px auto 18px;padding:28px;border-radius:24px;background:#123f35;color:#fff}.course-training-menu header p{margin:0;color:#63d4b0;font-size:12px;font-weight:900;letter-spacing:.12em}.course-training-menu h1{margin:10px 0;font-size:clamp(28px,3.5vw,44px)}.course-training-menu header span{color:#c5d8d1}.course-training-menu>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:24px}.course-training-menu a{padding:20px;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(255,255,255,.06);color:#fff}.course-training-menu i{width:48px;height:48px;display:grid;place-items:center;border-radius:13px;background:#62dab5;color:#123f35;font-style:normal;font-weight:900}.course-training-menu strong{margin-top:18px;font-size:24px}.course-training-menu small{margin:8px 0 20px;color:#bfd1cb;line-height:1.5}.course-training-menu b{margin-top:auto;color:#67dbb8;font-size:13px}@media(max-width:820px){.course-training-menu>div{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.course-training-menu{width:calc(100% - 28px);padding:18px}.course-training-menu>div{grid-template-columns:1fr}}`}</style>
  </section>;
}
