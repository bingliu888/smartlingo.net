"use client";
/* eslint-disable @next/next/no-img-element -- authenticated media is served by the account API */

import { useEffect, useRef, useState } from "react";
import { deleteReferralMedia, listReferralMedia, type ReferralMediaItem } from "../lib/referral-media-library";

export function ReferralMediaDrawer({ open, onClose, lang, referralUrl, referralCode }: { open: boolean; onClose: () => void; lang: "en" | "zh"; referralUrl: string; referralCode: string }) {
  const zh = lang === "zh";
  const [items, setItems] = useState<ReferralMediaItem[]>([]);
  const [index, setIndex] = useState(0);
  const [confirmId, setConfirmId] = useState("");
  const [message, setMessage] = useState("");
  const touchX = useRef(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    listReferralMedia().then((media) => {
      if (!active) return;
      setItems(media);
      setIndex(0);
    }).catch(() => setMessage(zh ? "暂时无法读取作品历史。" : "Media history is temporarily unavailable."));
    return () => { active = false; setConfirmId(""); setMessage(""); };
  }, [open, zh]);

  if (!open) return null;
  const selected = items[index];
  const move = (direction: number) => setIndex((current) => (current + direction + items.length) % items.length);

  async function shareSelected() {
    if (!selected) return;
    try {
      const response = await fetch(selected.url);
      if (!response.ok) throw new Error("media-download-failed");
      const file = new File([await response.blob()], selected.name, { type: selected.mimeType });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        const text = zh
          ? `和我一起使用 SmartLingo 学语言。介绍人积分只在平台成功收取订阅费后产生，班级付款永不计入。介绍人代码：${referralCode}。\n${referralUrl}`
          : `Learn a language with me on SmartLingo. Introducer points apply only after a successful platform subscription charge; class payments never qualify. Referral code: ${referralCode}.\n${referralUrl}`;
        await navigator.share({ title: "SmartLingo.net", text, url: referralUrl, files: [file] });
        setMessage(zh ? "已把作品文件和推荐链接送到系统分享菜单。" : "The media file and referral link were sent to the system share sheet.");
      } else {
        await navigator.clipboard?.writeText(referralUrl).catch(() => undefined);
        const link = document.createElement("a"); link.href = selected.url; link.download = selected.name; link.click();
        setMessage(zh ? "作品已下载，推荐链接已复制。请在微信、Telegram、Messenger、X 或 Facebook 中附加作品并粘贴链接。" : "Media downloaded and referral link copied. Attach it in WeChat, Telegram, Messenger, X, or Facebook and paste the link.");
      }
    } catch (error) { if ((error as Error).name !== "AbortError") setMessage(zh ? "分享失败，请重试。" : "Sharing failed. Please try again."); }
  }

  async function removeSelected() {
    if (!confirmId) return;
    await deleteReferralMedia(confirmId);
    const next = items.filter((item) => item.id !== confirmId);
    setItems(next); setIndex((current) => Math.min(current, Math.max(next.length - 1, 0))); setConfirmId("");
  }

  return <div className="media-library-backdrop" onMouseDown={onClose}><section className="media-library-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="media-library-close" onClick={onClose} aria-label={zh ? "关闭" : "Close"}>×</button><p className="section-kicker">{zh ? "分享作品" : "SHARE MEDIA"}</p><h2>{zh ? "选择图片或短片" : "Choose an image or clip"}</h2>{items.length === 0 ? <div className="media-library-empty"><p>{zh ? "还没有保存的作品。生成邀请图或短片后会自动显示在这里。" : "No saved media yet. Generated images and clips appear here automatically."}</p><a href={`/${lang}/share`}>{zh ? "创建智能邀请作品" : "Create AI invitation media"}</a></div> : <><div className="media-slider" onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }} onTouchEnd={(event) => { const distance = event.changedTouches[0].clientX - touchX.current; if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1); }}>{selected.kind === "video" ? <video src={selected.url} controls playsInline preload="metadata"/> : <img src={selected.url} alt={zh ? "已生成邀请图" : "Generated invitation"}/>}<span>{selected.kind === "video" ? (zh ? "短片" : "Clip") : (zh ? "图片" : "Image")} · {new Date(selected.createdAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}</span></div><div className="media-slider-nav"><button onClick={() => move(-1)} aria-label={zh ? "上一个" : "Previous"}>‹</button><b>{index + 1} / {items.length}</b><button onClick={() => move(1)} aria-label={zh ? "下一个" : "Next"}>›</button></div><div className="media-thumbnails">{items.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? "active" : ""} onClick={() => setIndex(itemIndex)}>{item.kind === "video" ? <video src={item.url} muted playsInline/> : <img src={item.url} alt=""/>}<span>{item.kind === "video" ? "▶" : "▧"}</span></button>)}</div><div className="media-selected-actions"><button className="media-share-selected" onClick={shareSelected}>{zh ? "分享所选作品与推荐链接" : "Share selected media and referral link"}</button><button className="media-delete-selected" onClick={() => setConfirmId(selected.id)}>{zh ? "删除所选作品" : "Delete selected media"}</button></div><a className="media-create-more" href={`/${lang}/share`}>{zh ? "＋ 创建更多智能作品" : "+ Create more AI media"}</a></>}{message && <p className="media-library-message">{message}</p>}{confirmId && <div className="media-delete-confirm"><p>{zh ? "删除这项作品？删除后无法恢复。" : "Delete this media? This cannot be undone."}</p><div><button onClick={() => setConfirmId("")}>{zh ? "取消" : "Cancel"}</button><button onClick={removeSelected}>{zh ? "删除" : "Delete"}</button></div></div>}</section></div>;
}
