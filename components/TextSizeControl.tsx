"use client";

import { useEffect, useState } from "react";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";

type TextSize = "comfortable" | "large" | "extra-large";
const storageKey = "smartlingo-guru-text-size";
const values: TextSize[] = ["comfortable", "large", "extra-large"];

function apply(value: TextSize) {
  document.documentElement.dataset.textSize = value;
  window.localStorage.setItem(storageKey, value);
}

export function TextSizeInitializer() {
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey) as TextSize | null;
    apply(saved && values.includes(saved) ? saved : "comfortable");
  }, []);
  return null;
}

export function TextSizeControl({ lang }: { lang: InterfaceLanguage }) {
  const [value, setValue] = useState<TextSize>("comfortable");
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey) as TextSize | null;
    // Restore the browser-owned preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(saved && values.includes(saved) ? saved : "comfortable");
  }, []);
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const labels = [t("Comfortable (default)", "舒适（默认）"), t("Large", "大号"), t("Extra large", "特大号")];
  return <section className="text-size-setting" aria-labelledby="gg-text-size-title"><div><b id="gg-text-size-title">{t("Site-wide text size", "全站文字大小")}</b><span>{t("Applies to every page and stays saved in this browser.", "立即应用到所有页面，并在本浏览器持续保存。")}</span></div><div className="text-size-options">{values.map((option, index) => <button type="button" key={option} aria-pressed={value === option} onClick={() => { setValue(option); apply(option); }}><strong>{index === 0 ? "A" : index === 1 ? "A+" : "A++"}</strong><span>{labels[index]}</span></button>)}</div></section>;
}
