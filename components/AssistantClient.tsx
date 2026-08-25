"use client";

import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { assistantComposerCopy, type InterfaceLanguage } from "../lib/interface-locale";
import { smartLingoAiStudyPartner, type SmartLingoAiStudyPartnerId } from "../lib/smartlingo-ai-study-partners";

type ChatMessage = { role: "user" | "assistant"; content: string; imageUrl?: string };
type PendingImage = { file: File; dataUrl: string; previewUrl: string };
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } };
type RecognitionError = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionConstructor = new () => Recognition;

function ToolIcon({ name }: { name: "copy" | "listen" | "up" | "down" | "share" }) {
  const paths = {
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    listen: <><path d="M11 5 7 9H4v6h3l4 4z"/><path d="M15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/></>,
    up: <path d="M7 10v10M7 10l4-6a2 2 0 0 1 3 2v4h4a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H7m0-10H4v10h3"/>,
    down: <path d="M7 14V4M7 14l4 6a2 2 0 0 0 3-2v-4h4a2 2 0 0 0 2-2l-1-6a2 2 0 0 0-2-2H7m0 10H4V4h3"/>,
    share: <><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function PlaybackIcon({ name }: { name: "play" | "pause" | "close" }) {
  const paths = {
    play: <path d="m9 7 8 5-8 5z" fill="currentColor" stroke="none"/>,
    pause: <><path d="M9 7v10M15 7v10"/></>,
    close: <><path d="m7 7 10 10M17 7 7 17"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function recognitionConstructor(): RecognitionConstructor | undefined {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

export function AssistantClient({ lang, targetLanguage, speechLocale, mode, partner: partnerId }: { lang: InterfaceLanguage; targetLanguage?: string; speechLocale?: string; mode?: string; partner?: SmartLingoAiStudyPartnerId }) {
  const zh = lang === "zh";
  const composerCopy = assistantComposerCopy[lang];
  const partner = smartLingoAiStudyPartner(partnerId);
  const assistantLabel = partner ? `${partner.name} · AI` : (zh ? "智能导师" : "Guru");
  const partnerGreeting = partner
    ? (zh
      ? `我是 ${partner.name}，SmartLingo AI 学习伙伴，不是真人。${partner.bodyZh} 我们现在一问一答；您可以随时停下来或换题。`
      : `I’m ${partner.name}, a SmartLingo AI study partner—not a real person. ${partner.bodyEn} We’ll take turns, and you can pause or switch topics anytime.`)
    : "";
  const { isLoaded: identityLoaded, isSignedIn } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>(() => partnerGreeting ? [{ role: "assistant", content: partnerGreeting }] : []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [faqOpen, setFaqOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<number | null>(null);
  const [ratedMessage, setRatedMessage] = useState<{ index: number; value: "up" | "down" } | null>(null);
  const [speechMessage, setSpeechMessage] = useState<number | null>(null);
  const [speechPaused, setSpeechPaused] = useState(false);
  const [speechElapsed, setSpeechElapsed] = useState(0);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const chatLog = useRef<HTMLDivElement | null>(null);
  const composer = useRef<HTMLTextAreaElement | null>(null);
  const faqMenu = useRef<HTMLDivElement | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const recognitionBase = useRef("");
  const speechTimer = useRef<number | null>(null);
  const speechSession = useRef(0);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    composer.current?.setAttribute("placeholder", partner ? (zh ? `给 ${partner.name} 发消息…` : `Message ${partner.name}…`) : composerCopy.placeholder);
    composer.current?.setAttribute("aria-label", composerCopy.question);
  }, [composerCopy, partner, zh]);

  useEffect(() => {
    const updateViewportHeight = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--assistant-viewport-height", `${Math.round(height)}px`);
    };
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("scroll", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("scroll", updateViewportHeight);
      document.documentElement.style.removeProperty("--assistant-viewport-height");
    };
  }, []);

  useEffect(() => () => {
    recognition.current?.stop();
    speechSession.current += 1;
    if (speechTimer.current) window.clearInterval(speechTimer.current);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  useEffect(() => {
    const log = chatLog.current;
    if (!log) return;
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const field = composer.current;
    if (!field) return;
    field.style.height = "auto";
    const styles = window.getComputedStyle(field);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 28;
    const chrome = (Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0) + 2;
    const maxHeight = lineHeight * 5 + chrome;
    field.style.height = `${Math.min(field.scrollHeight, maxHeight)}px`;
    field.style.overflowY = field.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    if (!faqOpen) return;
    const close = (event: PointerEvent) => {
      if (!faqMenu.current?.contains(event.target as Node)) setFaqOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [faqOpen]);

  function chooseQuestion(question: string) {
    setDraft(question);
    setFaqOpen(false);
    requestAnimationFrame(() => composer.current?.focus());
  }

  async function copyAnswer(content: string, index: number) {
    await navigator.clipboard.writeText(content);
    setCopiedMessage(index);
    window.setTimeout(() => setCopiedMessage(current => current === index ? null : current), 1600);
  }

  function stopReading() {
    speechSession.current += 1;
    if (speechTimer.current) window.clearInterval(speechTimer.current);
    speechTimer.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeechMessage(null);
    setSpeechPaused(false);
    setSpeechElapsed(0);
  }

  function toggleReading() {
    if (!("speechSynthesis" in window)) return;
    if (speechPaused) window.speechSynthesis.resume();
    else window.speechSynthesis.pause();
    setSpeechPaused(value => !value);
  }

  function finishReading(session: number) {
    if (session !== speechSession.current) return;
    if (speechTimer.current) window.clearInterval(speechTimer.current);
    speechTimer.current = null;
    setSpeechMessage(null);
    setSpeechPaused(false);
  }

  function readAnswer(content: string, messageIndex: number) {
    if (!("speechSynthesis" in window)) { setError(zh ? "此浏览器不支持文字朗读。" : "Text-to-speech is not supported in this browser."); return; }
    stopReading();
    const synth = window.speechSynthesis;
    const session = ++speechSession.current;
    const isChinese = /[\u3400-\u9fff]/.test(content);
    setError("");
    setSpeechMessage(messageIndex);
    setSpeechPaused(false);
    setSpeechElapsed(0);
    speechTimer.current = window.setInterval(() => setSpeechElapsed(value => value + 1), 1000);
    const chunks: string[] = [];
    for (const paragraph of content.split(/\n+/).map(value => value.trim()).filter(Boolean)) {
      let remaining = paragraph;
      while (remaining.length > 180) {
        const windowText = remaining.slice(0, 180);
        const punctuation = Math.max(windowText.lastIndexOf("。"), windowText.lastIndexOf("！"), windowText.lastIndexOf("？"), windowText.lastIndexOf("."), windowText.lastIndexOf("!"), windowText.lastIndexOf("?"), windowText.lastIndexOf(" "));
        const cut = punctuation > 60 ? punctuation + 1 : 180;
        chunks.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
      }
      if (remaining) chunks.push(remaining);
    }
    const voices = synth.getVoices();
    const voice = voices.find(candidate => isChinese ? /^(zh|cmn)/i.test(candidate.lang) : /^en/i.test(candidate.lang)) || null;
    let index = 0;
    const speakNext = () => {
      if (session !== speechSession.current) return;
      if (index >= chunks.length) { finishReading(session); return; }
      const utterance = new SpeechSynthesisUtterance(chunks[index++]);
      utterance.lang = isChinese ? "zh-CN" : "en-US";
      utterance.rate = isChinese ? 0.92 : 1;
      utterance.voice = voice;
      utterance.onend = speakNext;
      utterance.onerror = event => {
        if (event.error !== "interrupted" && event.error !== "canceled") {
          setError(isChinese ? "无法启动中文朗读，请检查设备是否已安装中文语音。" : "Unable to start speech. Please check this device's voice settings.");
          stopReading();
        }
      };
      synth.speak(utterance);
      synth.resume();
    };
    window.setTimeout(speakNext, 80);
  }

  async function shareAnswer(content: string) {
    if (navigator.share) await navigator.share({ text: content });
    else await navigator.clipboard.writeText(content);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if ((!content && !pendingImage) || busy) return;
    if (listening) recognition.current?.stop();
    const visibleContent = content || (zh ? "请分析这张图片。" : "Please analyze this image.");
    const attachment = pendingImage;
    const next = [...messages, { role: "user" as const, content: visibleContent, imageUrl: attachment?.dataUrl }].slice(-12);
    setMessages(next); setDraft(""); setPendingImage(null); setAttachOpen(false); setComposerFocused(false); composer.current?.blur(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        feature: "public_guru",
        language: lang,
        targetLanguage,
        practiceMode: mode,
        partner: partner?.id,
        messages: next.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        image: attachment ? { dataUrl: attachment.dataUrl, mimeType: attachment.file.type, size: attachment.file.size, name: attachment.file.name } : undefined,
      }) });
      const data = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !data.reply) throw new Error(zh ? "助手暂时不可用，请稍后重试。" : data.error || "The assistant is temporarily unavailable.");
      setMessages(current => [...current, { role: "assistant", content: data.reply! }]);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(zh && !/[\u3400-\u9fff]/.test(detail) ? "助手暂时不可用，请稍后重试。" : detail);
    }
    finally { setBusy(false); }
  }

  function chooseImage(file?: File) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= 0 || file.size > 900 * 1024) {
      setError(zh ? "请选择小于 900 KB 的 JPEG、PNG 或 WebP 图片。" : "Choose a JPEG, PNG, or WebP image under 900 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setPendingImage(current => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return { file, dataUrl: reader.result as string, previewUrl: URL.createObjectURL(file) };
      });
      setAttachOpen(false);
      setError("");
      requestAnimationFrame(() => composer.current?.focus());
    };
    reader.onerror = () => setError(zh ? "无法读取这张图片。" : "The image could not be read.");
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setPendingImage(current => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  function toggleVoiceInput() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!identityLoaded) {
      setError(zh ? "正在检查登录状态，请稍候。" : "Checking your sign-in status. Please wait.");
      return;
    }
    if (!isSignedIn) {
      window.location.assign(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/assistant`)}`);
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError(zh ? "此浏览器不支持语音输入。" : "Voice input is not supported in this browser.");
      return;
    }
    const instance = new Constructor();
    recognitionBase.current = draft.trim() ? `${draft.trim()} ` : "";
    instance.lang = speechLocale || (zh ? "zh-CN" : "en-US");
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = event => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += `${result[0].transcript.trim()} `;
        else interimText += result[0].transcript;
      }
      recognitionBase.current += finalText;
      setDraft(`${recognitionBase.current}${interimText}`.trimStart());
    };
    instance.onerror = event => {
      if (event.error !== "aborted") {
        setError(event.error === "no-speech"
          ? (zh ? "未检测到语音，请重试。" : "No speech was detected. Please try again.")
          : (zh ? "麦克风出现错误，请重试。" : `Microphone error: ${event.error}.`));
      }
      setListening(false);
      setVoiceStatus("");
    };
    instance.onend = () => {
      recognition.current = null;
      setListening(false);
      setVoiceStatus("");
    };
    try {
      recognition.current = instance;
      instance.start();
      setError("");
      setListening(true);
      setVoiceStatus(zh ? "正在聆听…" : "Listening…");
      composer.current?.focus();
    } catch {
      recognition.current = null;
      setListening(false);
      setVoiceStatus("");
      setError(zh ? "无法启动麦克风。" : "Unable to start the microphone.");
    }
  }

  const questions = partner
    ? (zh
      ? ["我们从一个生活场景开始吧。", "用刚学过的词和我做一问一答。", "给我一个轻松的词句挑战。", "请纠正我的回答并让我重说一次。"]
      : ["Let’s start with a real-life scene.", "Take turns with me using words I just learned.", "Give me a friendly word-and-sentence challenge.", "Correct my answer and let me try once more."])
    : (zh
      ? ["我应该从哪个职业英语阶段开始？", "如何练习英语面试和客户沟通？", "专业英语与岗位技能证书有什么区别？", "雇主如何在人才库联系候选人？"]
      : ["Which Career English stage should I start with?", "How can I practice an English interview or customer conversation?", "How are Professional English and Job Skills certificates different?", "How do employers contact candidates in Talent?"]);

  return <>{speechMessage !== null && <div className="speech-player" role="region" aria-label={zh ? "朗读控制" : "Read-aloud controls"}><button type="button" onClick={toggleReading} aria-label={speechPaused ? (zh ? "继续朗读" : "Resume reading") : (zh ? "暂停朗读" : "Pause reading")} title={speechPaused ? (zh ? "继续" : "Resume") : (zh ? "暂停" : "Pause")}><PlaybackIcon name={speechPaused ? "play" : "pause"}/></button><time>{formatElapsed(speechElapsed)}</time><span>{zh ? "正在朗读" : "Reading aloud"}</span><button className="speech-player-close" type="button" onClick={stopReading} aria-label={zh ? "停止朗读" : "Stop reading"} title={zh ? "停止并关闭" : "Stop and close"}><PlaybackIcon name="close"/></button></div>}<section className="assistant-main assistant-chat-only"><section className="chat-panel" data-layout-fill="assistant-chat-panel"><div className="chat-log" data-layout-fill="assistant-chat-log" aria-live="polite" ref={chatLog}>{messages.map((message, index) => <article className={message.role} key={`${message.role}-${index}`}><strong>{message.role === "user" ? (zh ? "您" : "You") : assistantLabel}</strong>{message.imageUrl ? <Image className="assistant-message-image" src={message.imageUrl} alt={zh ? "用户提供给智能导师分析的图片" : "Image supplied by the user for Guru analysis"} width={1200} height={900} unoptimized/> : null}<p data-layout-text-fit={`assistant-message-${index}`}>{message.content}</p>{message.role === "assistant" && <div className="answer-tools" aria-label={zh ? "回答工具" : "Answer tools"}><button type="button" onClick={() => copyAnswer(message.content, index)} aria-label={zh ? "复制回答" : "Copy answer"} title={zh ? "复制" : "Copy"}><ToolIcon name="copy"/></button><button type="button" className={speechMessage === index ? "active" : ""} onClick={() => readAnswer(message.content, index)} aria-label={zh ? "朗读回答" : "Read answer aloud"} title={zh ? "朗读" : "Listen"}><ToolIcon name="listen"/></button><button className={ratedMessage?.index === index && ratedMessage.value === "up" ? "active" : ""} type="button" onClick={() => setRatedMessage({ index, value: "up" })} aria-label={zh ? "有帮助" : "Helpful"} title={zh ? "有帮助" : "Helpful"}><ToolIcon name="up"/></button><button className={ratedMessage?.index === index && ratedMessage.value === "down" ? "active" : ""} type="button" onClick={() => setRatedMessage({ index, value: "down" })} aria-label={zh ? "没有帮助" : "Not helpful"} title={zh ? "没有帮助" : "Not helpful"}><ToolIcon name="down"/></button><button type="button" onClick={() => shareAnswer(message.content)} aria-label={zh ? "分享回答" : "Share answer"} title={zh ? "分享" : "Share"}><ToolIcon name="share"/></button><span aria-live="polite">{copiedMessage === index ? (zh ? "已复制" : "Copied") : ""}</span></div>}</article>)}{busy && <article className="assistant"><strong>{assistantLabel}</strong><p>{zh ? "正在思考…" : "Thinking…"}</p></article>}</div><form className={`chat-compose chat-compose-stacked${composerFocused || draft || pendingImage ? " expanded" : " compact"}`} data-layout-fill="assistant-composer" onSubmit={submit} onFocus={() => setComposerFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerFocused(false); }}>{pendingImage ? <div className="assistant-image-preview"><Image src={pendingImage.previewUrl} alt={zh ? "待发送图片" : "Image ready to send"} width={1200} height={900} unoptimized/><span>{pendingImage.file.name}</span><button type="button" onClick={removeImage} aria-label={zh ? "移除图片" : "Remove image"}>×</button></div> : null}<label className="chat-compose-field" data-readable-copy="assistant-composer-copy"><span className="sr-only">{zh ? "输入问题" : "Your question"}</span><textarea ref={composer} value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={1} placeholder={partner ? (zh ? `给 ${partner.name} 发消息…` : `Message ${partner.name}…`) : (zh ? "给智能导师发消息…" : "Message Guru…")}/></label><div className="chat-toolbar"><div className="assistant-attach-control"><button className="icon-button assistant-add-button" type="button" aria-label={zh ? "添加图片" : "Add image"} aria-expanded={attachOpen} onClick={() => setAttachOpen(value => !value)}>+</button>{attachOpen ? <div className="assistant-attach-menu"><button type="button" onClick={() => cameraInput.current?.click()}>{zh ? "拍照" : "Camera"}</button><button type="button" onClick={() => photoInput.current?.click()}>{zh ? "照片" : "Photos"}</button></div> : null}<input ref={cameraInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }}/><input ref={photoInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }}/></div><div className="faq-control" ref={faqMenu}><button className="icon-button faq-button" type="button" aria-label={zh ? "常见问题" : "Frequently asked questions"} aria-expanded={faqOpen} onClick={() => setFaqOpen(value => !value)}>?</button>{faqOpen && <div className="faq-popover" role="menu"><strong>{zh ? "常见问题" : "Try asking"}</strong>{questions.map(question => <button type="button" role="menuitem" key={question} onClick={() => chooseQuestion(question)}>{question}</button>)}</div>}</div>{voiceStatus && <span className="composer-status" aria-live="polite">{voiceStatus}</span>}<div className="toolbar-actions"><button className={`icon-button mic-button${listening ? " active" : ""}`} type="button" aria-label={listening ? (zh ? "停止语音输入" : "Stop voice input") : (zh ? "开始语音输入" : "Start voice input")} title={listening ? (zh ? "停止语音输入" : "Stop voice input") : (zh ? "开始语音输入" : "Start voice input")} onClick={toggleVoiceInput}><span aria-hidden="true"/></button><button className="icon-button send-button" aria-label={zh ? "发送消息" : "Send message"} disabled={busy || (!draft.trim() && !pendingImage)}><span aria-hidden="true">↑</span></button></div></div></form></section>{error && <p className="assistant-error" role="alert">{error}</p>}</section></>;
}
