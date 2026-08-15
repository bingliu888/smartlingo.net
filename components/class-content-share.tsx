"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
type Locale = "en" | "zh";

type Source = "file" | "web" | "whiteboard";
type Material = { id: string; fileName: string; contentType: string; fileSizeBytes: number };

export function ContentShareStudio({
  code,
  locale,
  enabled,
  activeSource,
  apiBase = "/api/classes",
  onPublish,
  onStop,
}: {
  code: string;
  locale: Locale;
  enabled: boolean;
  activeSource?: Source;
  apiBase?: string;
  onPublish: (track: MediaStreamTrack, label: Source) => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const zh = locale === "zh";
  const [open, setOpen] = useState<Source | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [textLines, setTextLines] = useState<string[]>([]);
  const [textOffset, setTextOffset] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const colorRef = useRef("#20d9aa");
  const frameTimerRef = useRef<number | null>(null);
  const framePulseRef = useRef(false);

  const drawBase = useCallback((title?: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#061f2a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#20d9aa";
    context.font = "700 28px system-ui";
    context.fillText("Classroom", 44, 52);
    if (title) {
      context.fillStyle = "#effaf7";
      context.font = "600 24px system-ui";
      context.fillText(title.slice(0, 74), 44, 92);
    }
  }, []);

  const drawText = useCallback((lines: string[], offset: number, title: string) => {
    drawBase(title);
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.fillStyle = "#eaf7f4";
    context.font = "22px ui-monospace, SFMono-Regular, Menlo, monospace";
    lines.slice(offset, offset + 24).forEach((line, index) =>
      context.fillText(line.slice(0, 96), 48, 140 + index * 31),
    );
  }, [drawBase]);

  useEffect(() => {
    if (open === "whiteboard") drawBase(zh ? "共享白板" : "Shared whiteboard");
  }, [drawBase, open, zh]);
  useEffect(() => {
    if (open === "file" && textLines.length) drawText(textLines, textOffset, fileName);
  }, [drawText, fileName, open, textLines, textOffset]);
  useEffect(() => () => {
    if (frameTimerRef.current !== null) window.clearInterval(frameTimerRef.current);
  }, []);

  async function loadMaterials() {
    const response = await fetch(`${apiBase}/${code}/materials`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { materials?: Material[] };
    setMaterials(data.materials || []);
  }

  async function openStudio(source: Source) {
    setMessage("");
    setOpen(source);
    if (source === "file") await loadMaterials();
  }

  async function renderBlob(blob: Blob, name: string) {
    setBusy(true);
    setMessage("");
    setFileName(name);
    try {
      if (blob.type.startsWith("image/")) {
        const bitmap = await createImageBitmap(blob);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        drawBase(name);
        const maxWidth = canvas.width - 88;
        const maxHeight = canvas.height - 150;
        const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height);
        const width = bitmap.width * scale;
        const height = bitmap.height * scale;
        context.drawImage(bitmap, (canvas.width - width) / 2, 120 + (maxHeight - height) / 2, width, height);
        bitmap.close();
        setTextLines([]);
      } else if (blob.type.startsWith("text/") || /\.(?:txt|md|csv|json)$/i.test(name)) {
        const lines = (await blob.text()).replace(/\r/g, "").split("\n");
        setTextLines(lines);
        setTextOffset(0);
        drawText(lines, 0, name);
      } else {
        throw new Error("UNSUPPORTED_FILE");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message === "UNSUPPORTED_FILE"
        ? (zh ? "当前可直接流式共享图片、照片和文本文件；PDF、演示文稿或其他文件请使用桌面屏幕共享。" : "Images, photos, and text files can stream directly. Use desktop screen sharing for PDFs, presentations, or other files.")
        : (zh ? "无法读取这个文件。" : "Could not read this file."));
    } finally {
      setBusy(false);
    }
  }

  async function selectMaterial(item: Material) {
    const response = await fetch(`${apiBase}/${code}/materials/${item.id}`, { cache: "no-store" });
    if (!response.ok) {
      setMessage(zh ? "无法打开附件。" : "Could not open the attachment.");
      return;
    }
    await renderBlob(await response.blob(), item.fileName);
  }

  async function publish(source: Source) {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.captureStream !== "function") {
      setMessage(zh ? "此浏览器不支持画布共享。" : "This browser does not support canvas sharing.");
      return;
    }
    setBusy(true);
    try {
      const track = canvas.captureStream(15).getVideoTracks()[0];
      if (!track) throw new Error("CANVAS_TRACK_UNAVAILABLE");
      if (frameTimerRef.current !== null) window.clearInterval(frameTimerRef.current);
      const canvasTrack = track as MediaStreamTrack & { requestFrame?: () => void };
      canvasTrack.requestFrame?.();
      frameTimerRef.current = window.setInterval(() => {
        // Safari can suppress a static canvas even when requestFrame() is called.
        // Mutating one nearly transparent edge pixel keeps the captured track live
        // without changing the visible shared content.
        const context = canvas.getContext("2d");
        if (context) {
          framePulseRef.current = !framePulseRef.current;
          context.save();
          context.globalAlpha = 1;
          context.fillStyle = framePulseRef.current ? "#061f2a" : "#071f2a";
          context.fillRect(canvas.width - 4, canvas.height - 4, 4, 4);
          context.restore();
        }
        canvasTrack.requestFrame?.();
      }, 250);
      track.addEventListener("ended", () => {
        if (frameTimerRef.current !== null) window.clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }, { once: true });
      await onPublish(track, source);
      setMessage("");
    } catch {
      setMessage(zh ? "无法开始内容共享。" : "Could not start content sharing.");
    } finally {
      setBusy(false);
    }
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (open !== "whiteboard") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point(event);
  }
  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || open !== "whiteboard") return;
    const next = point(event);
    const previous = lastPointRef.current || next;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.strokeStyle = colorRef.current;
    context.lineWidth = 6;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPointRef.current = next;
  }
  function stopDraw() { drawingRef.current = false; lastPointRef.current = null; }

  if (!enabled) return null;
  const icon = (source: Source, label: string, path: React.ReactNode) =>
    <button className={`media-toggle content-share-toggle${activeSource === source ? " is-on" : ""}`} type="button" aria-label={label} title={label} onClick={() => activeSource === source ? void onStop() : void openStudio(source)}>{path}</button>;
  return <>
    {icon("file", zh ? "共享文件" : "Share file", <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/></svg>)}
    {icon("web", zh ? "共享网页" : "Share web", <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>)}
    {icon("whiteboard", zh ? "共享白板" : "Share whiteboard", <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m8 14 7-7 2 2-7 7H8zM9 18v3M15 18v3"/></svg>)}
    {open && typeof document !== "undefined" ? createPortal(<div className="content-share-backdrop" role="dialog" aria-modal="true" aria-label={zh ? "共享内容" : "Share content"}><section className="content-share-studio"><header><div><small>{zh ? "共享内容" : "CONTENT SHARE"}</small><h2>{open === "file" ? (zh ? "文件或照片" : "File or photo") : open === "web" ? (zh ? "网页" : "Web page") : (zh ? "白板" : "Whiteboard")}</h2></div><button type="button" onClick={() => setOpen(null)} aria-label={zh ? "关闭" : "Close"}>×</button></header>
      {open === "web" ? <div className="content-share-web"><label><span>{zh ? "网页地址" : "Web address"}</span><input type="url" value={webUrl} onChange={(event) => setWebUrl(event.target.value)} placeholder="https://"/></label><p>{zh ? "外部网站可能禁止嵌入。桌面端可先打开网页，再使用屏幕共享选择该窗口或标签页。" : "External sites may block embedding. On desktop, open the page and then share that window or tab."}</p><button type="button" onClick={() => { try { const url = new URL(webUrl); window.open(url.toString(), "_blank", "noopener,noreferrer"); setMessage(zh ? "网页已打开；返回会议后点击屏幕共享。" : "Page opened. Return to the meeting and choose screen share."); } catch { setMessage(zh ? "请输入有效的网址。" : "Enter a valid URL."); } }}>{zh ? "打开网页" : "Open page"}</button></div> : <>
        {open === "file" ? <div className="content-share-file-picker"><input ref={inputRef} type="file" accept="image/*,text/plain,.md,.csv,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void renderBlob(file, file.name); }}/><button type="button" onClick={() => inputRef.current?.click()}>{zh ? "选择照片或文件" : "Choose photo or file"}</button>{materials.length ? <div><strong>{zh ? "房间附件" : "Room attachments"}</strong>{materials.map((item) => <button type="button" key={item.id} onClick={() => void selectMaterial(item)}>{item.fileName}</button>)}</div> : null}</div> : <div className="whiteboard-tools"><label>{zh ? "画笔颜色" : "Pen color"}<input type="color" defaultValue="#20d9aa" onChange={(event) => { colorRef.current = event.target.value; }}/></label><button type="button" onClick={() => drawBase(zh ? "共享白板" : "Shared whiteboard")}>{zh ? "清空" : "Clear"}</button></div>}
        <canvas ref={canvasRef} width={1280} height={720} onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onWheel={(event) => { if (!textLines.length) return; event.preventDefault(); setTextOffset((value) => Math.max(0, Math.min(Math.max(0, textLines.length - 24), value + (event.deltaY > 0 ? 3 : -3)))); }}/>
        {open === "file" && textLines.length ? <div className="content-scroll-controls"><button type="button" onClick={() => setTextOffset((value) => Math.max(0, value - 6))}>↑</button><span>{textOffset + 1} / {textLines.length}</span><button type="button" onClick={() => setTextOffset((value) => Math.min(Math.max(0, textLines.length - 24), value + 6))}>↓</button></div> : null}
        <footer>{activeSource === open ? <button type="button" className="danger" onClick={() => void onStop()}>{zh ? "停止共享" : "Stop sharing"}</button> : <button type="button" disabled={busy || (open === "file" && !fileName)} onClick={() => void publish(open)}>{busy ? (zh ? "正在连接…" : "Connecting…") : (zh ? "开始共享" : "Start sharing")}</button>}</footer>
      </>}
      {message ? <p className="form-error" role="status">{message}</p> : null}
    </section></div>, document.body) : null}
  </>;
}
