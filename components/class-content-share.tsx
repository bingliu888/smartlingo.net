"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
type Locale = "en" | "zh";

type Source = "file" | "web" | "whiteboard";
type WhiteboardTool = "pen" | "line" | "circle" | "rectangle" | "text";
type Material = { id: string; fileName: string; contentType: string; fileSizeBytes: number };
type DocumentKind = "pdf" | "docx" | "xlsx" | "pptx" | null;

export function ContentShareStudio({
  code,
  locale,
  enabled,
  activeSource,
  onPublish,
  onStop,
  apiBase = "/api/classes",
  onWebShare,
}: {
  code: string;
  locale: Locale;
  enabled: boolean;
  activeSource?: Source;
  onPublish: (track: MediaStreamTrack, label: Source) => Promise<void>;
  onStop: () => Promise<void>;
  apiBase?: string;
  onWebShare?: (url: string) => Promise<void>;
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
  const [documentKind, setDocumentKind] = useState<DocumentKind>(null);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [whiteboardTool, setWhiteboardTool] = useState<WhiteboardTool>("pen");
  const [textEditor, setTextEditor] = useState<{ x: number; y: number; left: number; top: number; value: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeSnapshotRef = useRef<ImageData | null>(null);
  const colorRef = useRef("#20d9aa");
  const frameTimerRef = useRef<number | null>(null);
  const framePulseRef = useRef(false);
  const pdfDocumentRef = useRef<{ getPage: (page: number) => Promise<{ getViewport: (options: { scale: number }) => { width: number; height: number }; render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> } | null>(null);

  const drawBase = useCallback((title?: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#061f2a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#20d9aa";
    context.font = "700 28px system-ui";
    context.fillText("SmartMeeting.club", 44, 52);
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

  const drawPdfPage = useCallback(async (pageNumber: number, title: string) => {
    const document = pdfDocumentRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!document || !canvas || !context) return;
    setBusy(true);
    try {
      const page = await document.getPage(pageNumber);
      const raw = page.getViewport({ scale: 1 });
      const scale = Math.min((canvas.width - 56) / raw.width, (canvas.height - 94) / raw.height);
      const viewport = page.getViewport({ scale });
      const pageCanvas = window.document.createElement("canvas");
      pageCanvas.width = Math.ceil(viewport.width);
      pageCanvas.height = Math.ceil(viewport.height);
      const pageContext = pageCanvas.getContext("2d");
      if (!pageContext) throw new Error("PDF_CANVAS_UNAVAILABLE");
      await page.render({ canvasContext: pageContext, viewport }).promise;
      drawBase(title);
      context.drawImage(pageCanvas, (canvas.width - pageCanvas.width) / 2, 104, pageCanvas.width, pageCanvas.height);
      context.fillStyle = "#eaf7f4";
      context.font = "600 20px system-ui";
      context.fillText(`${pageNumber} / ${pdfPages || pageNumber}`, 44, canvas.height - 28);
      setPdfPage(pageNumber);
    } catch {
      setMessage(zh ? "无法渲染 PDF 页面。" : "Could not render this PDF page.");
    } finally {
      setBusy(false);
    }
  }, [drawBase, pdfPages, zh]);

  useEffect(() => {
    if (open === "whiteboard") drawBase(zh ? "共享白板" : "Shared whiteboard");
  }, [drawBase, open, zh]);
  useEffect(() => {
    if ((open === "file" || open === "web") && textLines.length)
      drawText(textLines, textOffset, fileName);
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
    if (activeSource && activeSource !== source) await onStop();
    setTextLines([]);
    setTextOffset(0);
    setFileName("");
    setDocumentKind(null);
    setPdfPages(0);
    setPdfPage(1);
    pdfDocumentRef.current = null;
    setOpen(source);
    if (source === "file") await loadMaterials();
  }

  async function toggleSource(source: Source) {
    if (activeSource === source) {
      await onStop();
      setOpen(null);
      return;
    }
    await openStudio(source);
    if (source === "whiteboard") {
      // The toolbar button is the whiteboard start/stop control. Wait for the
      // editor canvas to mount, then publish it without a second Start button.
      window.requestAnimationFrame(() => void publish("whiteboard"));
    }
  }

  async function closeStudio() {
    if (open && activeSource === open) {
      setBusy(true);
      try {
        await onStop();
      } finally {
        setBusy(false);
      }
    }
    setOpen(null);
  }

  async function loadWebPreview() {
    setBusy(true);
    setMessage("");
    try {
      const url = new URL(webUrl);
      if (url.protocol !== "https:") throw new Error("HTTPS_REQUIRED");
      const response = await fetch(url.toString(), {
        headers: { accept: "text/html,text/plain;q=0.9" },
      });
      if (!response.ok) throw new Error("WEB_PREVIEW_FAILED");
      const contentType = response.headers.get("content-type") || "";
      if (!/text\/(?:html|plain)/i.test(contentType))
        throw new Error("UNSUPPORTED_WEB_CONTENT");
      const html = (await response.text()).slice(0, 512 * 1024);
      const documentPreview = new DOMParser().parseFromString(html, "text/html");
      documentPreview
        .querySelectorAll("script,style,svg,noscript,template")
        .forEach((node) => node.remove());
      const title = (documentPreview.title || url.hostname).trim().slice(0, 120);
      const text = (documentPreview.body?.innerText || documentPreview.body?.textContent || "")
        .replace(/\r/g, "")
        .replace(/[\t ]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const lines: string[] = [];
      for (const paragraph of text.split("\n")) {
        const clean = paragraph.trim();
        if (!clean) continue;
        for (let offset = 0; offset < clean.length && lines.length < 240; offset += 90)
          lines.push(clean.slice(offset, offset + 90));
        if (lines.length >= 240) break;
      }
      if (!lines.length) throw new Error("EMPTY_WEB_PREVIEW");
      setFileName(title);
      setTextLines(lines);
      setTextOffset(0);
      drawText(lines, 0, title);
    } catch (error) {
      setTextLines([]);
      setMessage(
        error instanceof Error && error.message === "HTTPS_REQUIRED"
          ? zh
            ? "请输入有效的安全网页地址。"
            : "Enter a valid HTTPS web address."
          : zh
            ? "此网站不允许浏览器直接读取。请改用屏幕共享。"
            : "This site blocks direct browser access. Use screen sharing instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function renderBlob(blob: Blob, name: string) {
    setBusy(true);
    setMessage("");
    setFileName(name);
    setDocumentKind(null);
    setPdfPages(0);
    setPdfPage(1);
    pdfDocumentRef.current = null;
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
      } else if (blob.type === "application/pdf" || /\.pdf$/i.test(name)) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as {
          GlobalWorkerOptions: { workerSrc: string };
          getDocument: (input: { data: Uint8Array }) => { promise: Promise<typeof pdfDocumentRef.current> };
        };
        // PDF.js 5 no longer honors the former `disableWorker` document
        // option. Give it an explicitly deployed same-origin worker so Safari
        // does not fail every PDF attachment with a missing worker URL.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const document = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (!document) throw new Error("PDF_LOAD_FAILED");
        pdfDocumentRef.current = document;
        setDocumentKind("pdf");
        setPdfPages((document as unknown as { numPages: number }).numPages);
        await drawPdfPage(1, name);
      } else if (/\.docx$/i.test(name) || /wordprocessingml\.document/i.test(blob.type)) {
        const mammoth = await import("mammoth") as unknown as { extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
        const result = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
        const lines = result.value.replace(/\r/g, "").split("\n");
        if (!lines.some((line) => line.trim())) throw new Error("EMPTY_DOCUMENT");
        setDocumentKind("docx");
        setTextLines(lines);
        setTextOffset(0);
        drawText(lines, 0, name);
      } else if (/\.(?:xlsx|xls)$/i.test(name) || /spreadsheetml|ms-excel/i.test(blob.type)) {
        const xlsx = await import("xlsx") as unknown as { read: (data: ArrayBuffer, options: { type: "array" }) => { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_csv: (sheet: unknown, options: { blankrows: boolean }) => string } };
        const workbook = xlsx.read(await blob.arrayBuffer(), { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const csv = sheetName ? xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false }) : "";
        const lines = csv.replace(/\r/g, "").split("\n");
        if (!lines.some((line) => line.trim())) throw new Error("EMPTY_DOCUMENT");
        setDocumentKind("xlsx");
        setTextLines(lines);
        setTextOffset(0);
        drawText(lines, 0, `${name}${sheetName ? ` · ${sheetName}` : ""}`);
      } else if (/\.pptx$/i.test(name) || /presentationml/i.test(blob.type)) {
        const JSZip = (await import("jszip")).default;
        const archive = await JSZip.loadAsync(await blob.arrayBuffer());
        const slidePaths = Object.keys(archive.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
        const lines: string[] = [];
        for (const [index, path] of slidePaths.entries()) {
          const xml = await archive.file(path)?.async("text");
          const texts = xml ? [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")) : [];
          lines.push(`— ${zh ? "幻灯片" : "Slide"} ${index + 1} —`, ...(texts.length ? texts : [zh ? "（无文字）" : "(No text)"]));
        }
        if (!lines.length) throw new Error("EMPTY_DOCUMENT");
        setDocumentKind("pptx");
        setTextLines(lines);
        setTextOffset(0);
        drawText(lines, 0, name);
      } else {
        throw new Error("UNSUPPORTED_FILE");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message === "UNSUPPORTED_FILE"
        ? (zh ? "可直接共享照片、PDF、DOCX、XLSX、PPTX 和文本文件。音频或视频文件请加入播放列表后共享播放。" : "Photos, PDFs, DOCX, XLSX, PPTX, and text files can be shared directly. Add audio or video files to the playlist for synchronized playback.")
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
    if (source === "web" && onWebShare) {
      if (!webUrl) return;
      setBusy(true);
      try {
        await onWebShare(webUrl);
        setMessage("");
      } catch {
        setMessage(zh ? "无法共享此网页。" : "Could not share this web page.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const canvas = canvasRef.current;
    const captureCanvas = captureCanvasRef.current;
    if (!canvas || !captureCanvas || typeof captureCanvas.captureStream !== "function") {
      setMessage(zh ? "此浏览器不支持画布共享。" : "This browser does not support canvas sharing.");
      return;
    }
    setBusy(true);
    try {
      const captureContext = captureCanvas.getContext("2d");
      if (!captureContext) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
      captureContext.drawImage(canvas, 0, 0, captureCanvas.width, captureCanvas.height);
      const track = captureCanvas.captureStream(15).getVideoTracks()[0];
      if (!track) throw new Error("CANVAS_TRACK_UNAVAILABLE");
      if (frameTimerRef.current !== null) window.clearInterval(frameTimerRef.current);
      const canvasTrack = track as MediaStreamTrack & { requestFrame?: () => void };
      canvasTrack.requestFrame?.();
      frameTimerRef.current = window.setInterval(() => {
        // Safari can suppress a static canvas even when requestFrame() is called.
        // Mutating one nearly transparent edge pixel keeps the captured track live
        // without changing the visible shared content.
        const context = captureCanvas.getContext("2d");
        if (context) {
          // The editor canvas lives inside a modal and may be unmounted when
          // publishing changes the room state. Keep an always-mounted capture
          // canvas alive so Safari does not replace the stream with black frames.
          if (canvasRef.current)
            context.drawImage(canvasRef.current, 0, 0, captureCanvas.width, captureCanvas.height);
          framePulseRef.current = !framePulseRef.current;
          context.save();
          context.globalAlpha = 1;
          context.fillStyle = framePulseRef.current ? "#061f2a" : "#071f2a";
          context.fillRect(captureCanvas.width - 4, captureCanvas.height - 4, 4, 4);
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
  function drawShape(context: CanvasRenderingContext2D, tool: WhiteboardTool, start: { x: number; y: number }, end: { x: number; y: number }) {
    context.strokeStyle = colorRef.current;
    context.lineWidth = 6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    if (tool === "line") {
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
    } else if (tool === "rectangle") {
      context.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (tool === "circle") {
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      context.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
    }
    context.stroke();
  }
  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (open !== "whiteboard") return;
    event.preventDefault();
    const next = point(event);
    if (whiteboardTool === "text") {
      const rect = event.currentTarget.getBoundingClientRect();
      setTextEditor({
        x: next.x,
        y: next.y,
        left: (event.clientX - rect.left) / rect.width * 100,
        top: (event.clientY - rect.top) / rect.height * 100,
        value: "",
      });
      return;
    }
    drawingRef.current = true;
    lastPointRef.current = next;
    startPointRef.current = next;
    if (whiteboardTool !== "pen") {
      const context = canvasRef.current?.getContext("2d");
      if (context) shapeSnapshotRef.current = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    }
    // Safari may reject pointer capture for some trackpad gestures. Drawing must
    // still continue through normal pointer events in that case.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* no-op */ }
  }
  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || open !== "whiteboard") return;
    event.preventDefault();
    const next = point(event);
    const previous = lastPointRef.current || next;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    if (whiteboardTool !== "pen") {
      const start = startPointRef.current;
      const snapshot = shapeSnapshotRef.current;
      if (start && snapshot) {
        context.putImageData(snapshot, 0, 0);
        drawShape(context, whiteboardTool, start, next);
      }
      lastPointRef.current = next;
      return;
    }
    context.strokeStyle = colorRef.current;
    context.lineWidth = 6;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPointRef.current = next;
  }
  function stopDraw(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event && drawingRef.current && whiteboardTool !== "pen") moveDraw(event);
    drawingRef.current = false;
    lastPointRef.current = null;
    startPointRef.current = null;
    shapeSnapshotRef.current = null;
  }
  function commitText() {
    if (!textEditor) return;
    const value = textEditor.value.trim();
    if (value) {
      const context = canvasRef.current?.getContext("2d");
      if (context) {
        context.fillStyle = colorRef.current;
        context.font = "600 34px system-ui";
        context.textBaseline = "top";
        context.fillText(value.slice(0, 80), textEditor.x, textEditor.y);
      }
    }
    setTextEditor(null);
  }

  if (!enabled) return null;
  const icon = (source: Source, label: string, path: React.ReactNode) =>
    <button className={`media-toggle content-share-toggle${activeSource === source ? " is-on" : ""}`} type="button" aria-label={label} title={label} onClick={() => void toggleSource(source)}>{path}</button>;
  return <>
    <canvas ref={captureCanvasRef} className="content-share-capture-canvas" width={1280} height={720} aria-hidden="true" />
    {icon("file", zh ? "共享文件" : "Share file", <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/></svg>)}
    {icon("web", zh ? "共享网页" : "Share web", <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>)}
    {icon("whiteboard", zh ? "共享白板" : "Share whiteboard", <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m8 14 7-7 2 2-7 7H8zM9 18v3M15 18v3"/></svg>)}
    {open && typeof document !== "undefined" ? createPortal(<div className="content-share-backdrop" role="dialog" aria-modal="true" aria-label={zh ? "共享内容" : "Share content"}><section className="content-share-studio"><header><div><small>{zh ? "共享内容" : "CONTENT SHARE"}</small><h2>{open === "file" ? (zh ? "文件或照片" : "File or photo") : open === "web" ? (zh ? "网页" : "Web page") : (zh ? "白板" : "Whiteboard")}</h2></div><button type="button" disabled={busy} onClick={() => void closeStudio()} aria-label={zh ? "关闭并停止共享" : "Close and stop sharing"}>×</button></header>
      {open === "web" ? <><div className="content-share-web"><label><span>{zh ? "网页地址" : "Web address"}</span><input type="url" value={webUrl} onChange={(event) => setWebUrl(event.target.value)} placeholder="https://"/></label><p>{zh ? "网页会作为安全的只读预览留在会议内，可滚动并直接共享到内容画面。" : "The page stays inside the meeting as a safe read-only preview that you can scroll and share directly."}</p><button type="button" disabled={busy || !webUrl.trim()} onClick={() => void loadWebPreview()}>{busy ? (zh ? "正在载入…" : "Loading…") : (zh ? "载入网页" : "Load page")}</button></div>{textLines.length ? <><div className="content-share-canvas-wrap"><canvas ref={canvasRef} width={1280} height={720} onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onLostPointerCapture={stopDraw} onWheel={(event) => { event.preventDefault(); setTextOffset((value) => Math.max(0, Math.min(Math.max(0, textLines.length - 24), value + (event.deltaY > 0 ? 3 : -3)))); }}/></div><div className="content-scroll-controls"><button type="button" onClick={() => setTextOffset((value) => Math.max(0, value - 6))}>↑</button><span>{Math.min(textLines.length, textOffset + 1)} / {textLines.length}</span><button type="button" onClick={() => setTextOffset((value) => Math.min(Math.max(0, textLines.length - 24), value + 6))}>↓</button></div><footer>{activeSource === open ? <button type="button" className="danger" onClick={() => void onStop()}>{zh ? "停止共享" : "Stop sharing"}</button> : <button type="button" disabled={busy} onClick={() => void publish(open)}>{busy ? (zh ? "正在连接…" : "Connecting…") : (zh ? "开始共享" : "Start sharing")}</button>}</footer></> : null}</> : <>
        {open === "file" ? <div className="content-share-file-picker"><input ref={inputRef} type="file" accept="image/*,text/plain,.md,.csv,.json,.pdf,.docx,.xlsx,.xls,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void renderBlob(file, file.name); }}/><button type="button" onClick={() => inputRef.current?.click()}>{zh ? "选择照片或文件" : "Choose photo or file"}</button>{materials.length ? <div><strong>{zh ? "房间附件" : "Room attachments"}</strong>{materials.map((item) => <button type="button" key={item.id} onClick={() => void selectMaterial(item)}>{item.fileName}</button>)}</div> : null}</div> : <div className="whiteboard-tools" role="toolbar" aria-label={zh ? "白板工具" : "Whiteboard tools"}>
          <label>{zh ? "颜色" : "Color"}<input type="color" defaultValue="#20d9aa" onChange={(event) => { colorRef.current = event.target.value; }}/></label>
          {([
            ["pen", zh ? "自由笔" : "Pen", <path key="pen" d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5"/>],
            ["line", zh ? "直线" : "Line", <path key="line" d="M5 19 19 5"/>],
            ["circle", zh ? "圆形" : "Circle", <circle key="circle" cx="12" cy="12" r="8"/>],
            ["rectangle", zh ? "矩形" : "Rectangle", <rect key="rectangle" x="4" y="6" width="16" height="12" rx="1"/>],
            ["text", zh ? "文字" : "Text", <path key="text" d="M5 5h14M12 5v14M8 19h8"/>],
          ] as [WhiteboardTool, string, React.ReactNode][]).map(([tool, label, path]) => <button key={tool} className={`whiteboard-tool${whiteboardTool === tool ? " is-active" : ""}`} type="button" onClick={() => { setWhiteboardTool(tool); setTextEditor(null); }} aria-label={label} title={label}><svg viewBox="0 0 24 24" aria-hidden="true">{path}</svg></button>)}
          <button type="button" onClick={() => { drawBase(zh ? "共享白板" : "Shared whiteboard"); setTextEditor(null); }}>{zh ? "清空" : "Clear"}</button>
        </div>}
        <div className="content-share-canvas-wrap">
          <canvas ref={canvasRef} width={1280} height={720} onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onLostPointerCapture={stopDraw} onWheel={(event) => { if (!textLines.length) return; event.preventDefault(); setTextOffset((value) => Math.max(0, Math.min(Math.max(0, textLines.length - 24), value + (event.deltaY > 0 ? 3 : -3)))); }}/>
          {open === "whiteboard" && textEditor ? <input className="whiteboard-text-input" style={{ left: `${textEditor.left}%`, top: `${textEditor.top}%` }} value={textEditor.value} autoFocus onChange={(event) => setTextEditor({ ...textEditor, value: event.target.value })} onBlur={commitText} onKeyDown={(event) => { if (event.key === "Enter") commitText(); else if (event.key === "Escape") setTextEditor(null); }} aria-label={zh ? "输入白板文字" : "Whiteboard text"} placeholder={zh ? "输入文字" : "Type text"}/> : null}
        </div>
        {open === "file" && documentKind === "pdf" && pdfPages ? <div className="content-scroll-controls"><button type="button" disabled={busy || pdfPage <= 1} onClick={() => void drawPdfPage(pdfPage - 1, fileName)}>←</button><span>{zh ? "第" : "Page "}{pdfPage} / {pdfPages}{zh ? " 页" : ""}</span><button type="button" disabled={busy || pdfPage >= pdfPages} onClick={() => void drawPdfPage(pdfPage + 1, fileName)}>→</button></div> : null}
        {open === "file" && textLines.length ? <div className="content-scroll-controls"><button type="button" onClick={() => setTextOffset((value) => Math.max(0, value - 6))}>↑</button><span>{textOffset + 1} / {textLines.length}</span><button type="button" onClick={() => setTextOffset((value) => Math.min(Math.max(0, textLines.length - 24), value + 6))}>↓</button></div> : null}
        {open === "whiteboard" ? null : <footer>{activeSource === open ? <button type="button" className="danger" onClick={() => void onStop()}>{zh ? "停止共享" : "Stop sharing"}</button> : <button type="button" disabled={busy || (open === "file" && !fileName)} onClick={() => void publish(open)}>{busy ? (zh ? "正在连接…" : "Connecting…") : (zh ? "开始共享" : "Start sharing")}</button>}</footer>}
      </>}
      {message ? <p className="form-error" role="status">{message}</p> : null}
    </section></div>, document.body) : null}
  </>;
}
