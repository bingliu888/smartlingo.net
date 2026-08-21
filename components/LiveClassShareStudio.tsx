"use client";

import { useCallback, useEffect, useRef, useState } from "react";
type Locale = "en" | "zh";

type ShareMeeting = { code: string; title: string; description: string; startsAt: number; durationMinutes: number; hostName: string };

export function LiveClassShareStudio({ meeting, locale, shareUrl, onClose, embedded=false }: { meeting: ShareMeeting; locale: Locale; shareUrl: string; onClose?: () => void; embedded?: boolean }) {
  const zh = locale === "zh";
  const canvas = useRef<HTMLCanvasElement>(null);
  const [background, setBackground] = useState("");
  const [style, setStyle] = useState("global");
  const [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const wrapText = useCallback((context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
    const characters = [...text];
    const lines: string[] = [];
    let line = "";
    for (const character of characters) {
      const trial = line + character;
      if (context.measureText(trial).width > maxWidth && line) { lines.push(line); line = character; }
      else line = trial;
      if (lines.length === maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (characters.join("") !== lines.join("")) lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
    lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }, []);

  const draw = useCallback(async (source?: string) => {
    const node = canvas.current;
    const context = node?.getContext("2d");
    if (!node || !context) return;
    context.clearRect(0, 0, 1024, 1024);
    if (source) {
      const image = new Image(); image.src = source; await image.decode();
      const scale = Math.max(1024 / image.width, 1024 / image.height);
      context.drawImage(image, (1024 - image.width * scale) / 2, (1024 - image.height * scale) / 2, image.width * scale, image.height * scale);
    } else {
      const base = context.createLinearGradient(0, 0, 1024, 1024); base.addColorStop(0, "#075c54"); base.addColorStop(.52, "#073b48"); base.addColorStop(1, "#041f2a"); context.fillStyle = base; context.fillRect(0, 0, 1024, 1024);
      context.fillStyle = "rgba(45,227,170,.18)"; context.beginPath(); context.arc(815, 190, 260, 0, Math.PI * 2); context.fill();
    }
    const overlay = context.createLinearGradient(0, 260, 0, 1024); overlay.addColorStop(0, "rgba(2,25,33,.12)"); overlay.addColorStop(.45, "rgba(2,25,33,.70)"); overlay.addColorStop(1, "rgba(2,25,33,.97)"); context.fillStyle = overlay; context.fillRect(0, 0, 1024, 1024);
    context.fillStyle = "#2de3aa"; context.font = "800 30px system-ui"; context.fillText("COURSE STUDIO", 68, 88);
    context.fillStyle = "#ffffff"; context.font = "900 84px system-ui"; const titleBottom = wrapText(context, meeting.title, 68, 500, 880, 92, 3);
    context.fillStyle = "#b9d4d6"; context.font = "500 30px system-ui"; const description = meeting.description || (zh ? "欢迎加入这门课程。" : "You are invited to this class."); const descBottom = wrapText(context, description, 70, Math.min(titleBottom + 22, 770), 875, 43, 2);
    const date = new Date(meeting.startsAt * 1000).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
    context.fillStyle = "#ffffff"; context.font = "700 30px system-ui"; context.fillText(`${date}  ·  ${meeting.durationMinutes} ${zh ? "分钟" : "min"}`, 70, Math.min(descBottom + 32, 888));
    context.fillStyle = "#2de3aa"; context.font = "900 46px ui-monospace, monospace"; context.fillText(`${zh ? "课程号" : "COURSE ID"}  ${meeting.code}`, 70, 942);
    context.fillStyle = "#ffffff"; context.font = "700 24px system-ui"; context.textAlign = "right"; context.fillText(shareUrl.replace(/^https?:\/\//, ""), 956, 986); context.textAlign = "left";
  }, [locale, meeting, shareUrl, wrapText, zh]);

  useEffect(() => { void draw(background || undefined); }, [background, draw]);

  async function generate() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/classrooms/${meeting.code}/share-image`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ style, direction, locale }) });
      const result = await response.json().catch(() => ({})) as { image?: string; error?: string };
      if (!response.ok || !result.image) throw new Error(result.error || "generation_failed");
      setBackground(result.image);
      setNotice(zh ? "人工智能背景已生成，课程资料已准确合成。" : "AI background created; course details were added accurately.");
    } catch { setNotice(zh ? "人工智能图片暂时无法生成，请重试。" : "AI image generation is temporarily unavailable. Please retry."); }
    finally { setBusy(false); }
  }
  function canvasBlob() { return new Promise<Blob | null>(resolve => canvas.current?.toBlob(resolve, "image/png")); }
  function download(blob: Blob) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `smartclass-${meeting.code}.png`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function shareImage() {
    const blob = await canvasBlob(); if (!blob) return;
    const file = new File([blob], `smartclass-${meeting.code}.png`, { type: "image/png" });
    const text = zh ? `${meeting.title} · 课程号 ${meeting.code}\n${shareUrl}` : `${meeting.title} · Course ID ${meeting.code}\n${shareUrl}`;
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: meeting.title, text, url: shareUrl, files: [file] });
      else { await navigator.clipboard?.writeText(shareUrl).catch(() => undefined); download(blob); setNotice(zh ? "图片已下载，课程链接已复制。" : "Image downloaded and course link copied."); }
    } catch (error) { if ((error as Error).name !== "AbortError") setNotice(zh ? "分享失败，请使用下载。" : "Sharing failed. Please use download."); }
  }

  return <div className={embedded?"meeting-share-page":"meeting-share-backdrop"} onMouseDown={onClose}><style>{`.meeting-share-page{display:grid;place-items:center;padding:48px 5%;background:#eef7f4}.meeting-share-studio{width:min(1120px,100%);padding:clamp(20px,3vw,38px);display:grid;grid-template-columns:minmax(280px,.8fr) minmax(360px,1fr);gap:clamp(24px,4vw,52px);border-radius:26px;background:#f5faf8;box-shadow:0 22px 70px rgba(0,35,45,.16)}.meeting-share-controls h2{margin:0 0 14px;font-size:clamp(30px,4vw,48px)}.meeting-share-controls label{margin:20px 0;display:grid;gap:8px;font-weight:750}.meeting-share-controls select,.meeting-share-controls textarea{width:100%;padding:13px 14px;border:1px solid #cfe0df;border-radius:12px;background:#fff;font:inherit}.meeting-share-controls button,.meeting-share-preview button{min-height:46px;padding:0 18px;border:1px solid #042b38;border-radius:12px;color:#fff;background:#042b38;font-weight:760}.meeting-share-preview{padding:14px;align-self:center;border:1px solid #cfe0df;border-radius:20px;background:#fff}.meeting-share-preview canvas{width:100%;aspect-ratio:1;display:block;border-radius:12px;background:#042b38}.meeting-share-preview>div{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.meeting-share-preview button+button{color:#042b38;background:#fff}@media(max-width:760px){.meeting-share-studio{grid-template-columns:1fr}.meeting-share-preview>div{grid-template-columns:1fr}}`}</style><section className="meeting-share-studio" onMouseDown={event => event.stopPropagation()} aria-label={zh ? "课程分享图工作室" : "Course share image studio"}>
    {onClose?<button className="meeting-share-close" type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}>×</button>:null}
    <div className="meeting-share-controls"><p className="eyebrow"><span/> AI COURSE STUDIO</p><h2>{zh ? "生成课程分享图" : "Create a course share image"}</h2><p>{zh ? "人工智能生成无文字背景，课程名称、时间、简介、网址和 6 位课程号由网站准确合成。" : "AI creates a text-free background. The site adds the exact course title, time, description, URL, and six-digit ID."}</p>
      <label>{zh ? "图片风格" : "Image style"}<select value={style} onChange={event => setStyle(event.target.value)}><option value="global">{zh ? "全球商务（推荐）" : "Global business (recommended)"}</option><option value="creative">{zh ? "创意交流" : "Creative gathering"}</option><option value="technology">{zh ? "未来科技" : "Future technology"}</option><option value="warm">{zh ? "温暖社区" : "Warm community"}</option></select></label>
      <label>{zh ? "画面提示（可选）" : "Art direction (optional)"}<textarea rows={3} maxLength={240} value={direction} onChange={event => setDirection(event.target.value)} placeholder={zh ? "例如：旧金山日落、现代课程空间；不要文字" : "Example: San Francisco sunset, modern course space; no text"}/><small>{direction.length}/240</small></label>
      <button className="button primary" type="button" disabled={busy} onClick={() => void generate()}>{busy ? (zh ? "人工智能生成中…" : "Generating…") : (zh ? "人工智能生成分享图" : "Generate AI share image")}</button>{notice ? <p className="meeting-share-notice" role="status">{notice}</p> : null}
    </div>
    <div className="meeting-share-preview"><canvas ref={canvas} width="1024" height="1024"/><div><button type="button" onClick={() => void shareImage()}>{zh ? "分享图片" : "Share image"}</button><button type="button" onClick={async () => { const blob = await canvasBlob(); if (blob) download(blob); }}>{zh ? "下载图片" : "Download"}</button></div></div>
  </section></div>;
}
