"use client";

import { useEffect } from "react";
import { homeInterfaceTranslations } from "../lib/home-interface-translations.generated";
import { interfaceLanguages, type InterfaceLanguage } from "../lib/interface-locale";

type ValueState = { source: string; rendered: string };
const textStates = new WeakMap<Text, ValueState>();
const attributeStates = new WeakMap<Element, Map<string, ValueState>>();
const attributeNames = ["aria-label", "title", "placeholder", "alt"];
const nativeLanguageNames = new Set<string>(interfaceLanguages.map(({ nativeName }) => nativeName));

function translate(value: string, dictionary: Record<string, string>) {
  if (!value.trim()) return value;
  const trimmed = value.trim();
  if (nativeLanguageNames.has(trimmed)) return value;
  const replacement = dictionary[value] ?? dictionary[trimmed];
  if (!replacement) return value;
  const start = value.indexOf(trimmed);
  return value.slice(0, start) + replacement + value.slice(start + trimmed.length);
}

function localize(root: Node, dictionary: Record<string, string>) {
  const start = root instanceof Document ? root.documentElement : root;
  if (start instanceof Element && start.closest("script,style,[data-no-translate],[data-no-auto-localize]")) return;
  const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null = start;
  while (node) {
    if (node instanceof Text && !node.parentElement?.closest("script,style,textarea,[data-no-translate],[data-no-auto-localize]")) {
      let state = textStates.get(node);
      if (!state) state = { source: node.data, rendered: node.data };
      else if (node.data !== state.rendered && node.data !== state.source) state = { source: node.data, rendered: node.data };
      const next = translate(state.source, dictionary);
      state.rendered = next;
      textStates.set(node, state);
      if (node.data !== next) node.data = next;
    } else if (node instanceof Element) {
      let originals = attributeStates.get(node);
      if (!originals) { originals = new Map(); attributeStates.set(node, originals); }
      for (const name of attributeNames) {
        const value = node.getAttribute(name);
        if (value === null) continue;
        let state = originals.get(name);
        if (!state) state = { source: value, rendered: value };
        else if (value !== state.rendered && value !== state.source) state = { source: value, rendered: value };
        const next = translate(state.source, dictionary);
        state.rendered = next;
        originals.set(name, state);
        if (value !== next) node.setAttribute(name, next);
      }
    }
    node = walker.nextNode();
  }
}

export function LocaleRuntime({ locale }: { locale: InterfaceLanguage }) {
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    const dictionary = homeInterfaceTranslations[locale];
    if (!dictionary || locale === "zh" || locale === "en") return;
    localize(document, dictionary);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const added of record.addedNodes) localize(added, dictionary);
        if (record.type === "characterData" || record.type === "attributes") localize(record.target, dictionary);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributeNames });
    return () => observer.disconnect();
  }, [locale]);
  return null;
}
