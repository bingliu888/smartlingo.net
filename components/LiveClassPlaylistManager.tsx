"use client";

import { useCallback, useEffect, useRef, useState } from "react";
type Locale = "en" | "zh";

type PlaylistItem = {
  id: string;
  title: string;
  sourceType: "upload";
  contentType: string;
  fileSizeBytes: number;
  position: number;
  createdAt: number;
};
type PlaylistResponse = {
  items: PlaylistItem[];
  state: { active: number; currentItemId: string | null } | null;
  manager: boolean;
  error?: string;
};
type UploadInit = { itemId: string; key: string; uploadId: string };
const CHUNK = 8 * 1024 * 1024;

function sizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function LiveClassPlaylistManager({
  code,
  locale,
  realtimeMode,
}: {
  code: string;
  locale: Locale;
  realtimeMode: "group_call" | "webinar" | "livestream";
}) {
  const zh = locale === "zh";
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    name: string;
    value: number;
    size: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const albumRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/classrooms/${code}/playlist`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as PlaylistResponse;
    if (response.ok) {
      setItems(data.items || []);
      setEnabled(Boolean(data.state?.active));
    } else
      setMessage(
        data.error || (zh ? "无法读取播放列表。" : "Unable to load playlist."),
      );
    setLoading(false);
  }, [code, zh]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function upload(file: File) {
    if (!file.type.startsWith("video/")) {
      setMessage(zh ? "请选择视频文件。" : "Choose a video file.");
      return;
    }
    setBusy(true);
    setMessage(zh ? "正在准备上传…" : "Preparing upload…");
    setProgress({ name: file.name, value: 0, size: file.size });
    let init: UploadInit | null = null;
    try {
      const response = await fetch(`/api/classrooms/${code}/playlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "init-upload",
          fileName: file.name,
          size: file.size,
          contentType: file.type || "video/mp4",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<UploadInit> & {
        error?: string;
      };
      if (!response.ok || !data.itemId || !data.key || !data.uploadId)
        throw new Error(
          data.error || (zh ? "无法开始上传。" : "Could not start upload."),
        );
      init = { itemId: data.itemId, key: data.key, uploadId: data.uploadId };
      const parts: Array<{ partNumber: number; etag: string }> = [];
      for (
        let offset = 0, partNumber = 1;
        offset < file.size;
        offset += CHUNK, partNumber++
      ) {
        const partResponse = await fetch(`/api/classrooms/${code}/playlist`, {
          method: "POST",
          headers: {
            "x-playlist-key": data.key,
            "x-r2-upload-id": data.uploadId,
            "x-part-number": String(partNumber),
            "content-type": "application/octet-stream",
          },
          body: file.slice(offset, Math.min(file.size, offset + CHUNK)),
        });
        const part = (await partResponse.json().catch(() => ({}))) as {
          partNumber?: number;
          etag?: string;
          error?: string;
        };
        if (!partResponse.ok || !part.etag)
          throw new Error(
            part.error ||
              (zh ? "视频分片上传失败。" : "A video chunk failed to upload."),
          );
        parts.push({ partNumber, etag: part.etag });
        setProgress({
          name: file.name,
          value: Math.min(file.size, offset + CHUNK),
          size: file.size,
        });
      }
      const done = await fetch(`/api/classrooms/${code}/playlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "complete-upload",
          ...init,
          parts,
          size: file.size,
          contentType: file.type || "video/mp4",
          fileName: file.name,
          title: file.name.replace(/\.[^.]+$/, ""),
        }),
      });
      const result = (await done.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!done.ok)
        throw new Error(
          result.error ||
            (zh ? "无法完成上传。" : "Could not complete upload."),
        );
      setMessage(zh ? "视频已加入播放列表。" : "Video added to the playlist.");
      await load();
    } catch (error) {
      if (init?.key && init.uploadId)
        void fetch(`/api/classrooms/${code}/playlist`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "abort-upload",
            key: init.key,
            uploadId: init.uploadId,
          }),
        });
      setMessage(
        error instanceof Error
          ? error.message
          : zh
            ? "上传失败。"
            : "Upload failed.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
      if (albumRef.current) albumRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function save(next: PlaylistItem[]) {
    setBusy(true);
    const response = await fetch(`/api/classrooms/${code}/playlist`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: next.map((item) => ({ id: item.id, title: item.title })),
      }),
    });
    setBusy(false);
    if (response.ok) {
      setItems(next);
      setMessage(zh ? "播放顺序已保存。" : "Playlist order saved.");
    } else setMessage(zh ? "无法保存播放列表。" : "Could not save playlist.");
  }
  async function remove(item: PlaylistItem) {
    if (
      !window.confirm(
        zh
          ? `从播放列表删除“${item.title}”？`
          : `Remove “${item.title}” from the playlist?`,
      )
    )
      return;
    setBusy(true);
    const response = await fetch(
      `/api/classrooms/${code}/playlist?id=${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (response.ok) {
      setMessage(zh ? "视频已删除。" : "Video removed.");
      await load();
    } else setMessage(zh ? "无法删除视频。" : "Could not remove video.");
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    void save(next);
  }
  async function toggleEnabled() {
    if (!enabled && !items.length) {
      setMessage(
        zh ? "请先上传至少一个视频。" : "Upload at least one video first.",
      );
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/classrooms/${code}/playlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: enabled ? "disable" : "enable" }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);
    if (response.ok) {
      setEnabled(!enabled);
      setMessage(
        !enabled
          ? zh
            ? "自动播放已启用。教师进入课堂后会循环播流。"
            : "Auto-play enabled. The playlist will loop when the teacher enters the room."
          : zh
            ? "自动播放已关闭。"
            : "Auto-play disabled.",
      );
    } else
      setMessage(
        data.error ||
          (zh ? "无法更新播放设置。" : "Could not update playback settings."),
      );
  }
  if (realtimeMode === "group_call")
    return (
      <section className="class-playlist-manager">
        <h2>{zh ? "课堂播放列表" : "Class playlist"}</h2>
        <p>
          {zh
            ? "小组通话模式不使用播放列表。网络研讨会或直播模式可以上传自动播流视频。"
            : "Group calls do not use a playlist. Upload auto-broadcast videos in Webinar or Live streaming mode."}
        </p>
      </section>
    );
  return (
    <section className="class-playlist-manager">
      <header>
        <div>
          <p className="eyebrow">
            <span /> {zh ? "课前内容" : "PRE-CLASS CONTENT"}
          </p>
          <h2>{zh ? "课堂播放列表" : "Class playlist"}</h2>
          <p>
            {zh
              ? "仅支持从文件或相册上传的视频。启用后，教师进入课堂会作为课堂直播循环播放。"
              : "Upload videos from Files or Photos. When enabled, the playlist loops as live classroom media while the teacher is in the room."}
          </p>
          <label className="playlist-enable">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy}
              onChange={() => void toggleEnabled()}
            />
            <span>
              {enabled
                ? zh
                  ? "已启用自动循环播流"
                  : "Auto loop broadcast enabled"
                : zh
                  ? "启用自动循环播流"
                  : "Enable auto loop broadcast"}
            </span>
          </label>
        </div>
        <div>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => albumRef.current?.click()}
          >
            {zh ? "从相册选择" : "Choose from Photos"}
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {zh ? "从文件选择" : "Choose from Files"}
          </button>
        </div>
      </header>
      <input
        ref={albumRef}
        hidden
        type="file"
        accept="video/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <input
        ref={fileRef}
        hidden
        type="file"
        accept="video/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {progress ? (
        <div className="playlist-upload-progress" role="status">
          <strong>{progress.name}</strong>
          <span>
            {sizeLabel(progress.value)} / {sizeLabel(progress.size)}
          </span>
          <progress max={progress.size} value={progress.value} />
          <b>{Math.round((progress.value / progress.size) * 100)}%</b>
        </div>
      ) : null}
      {message ? (
        <p className="form-hint" role="status">
          {message}
        </p>
      ) : null}
      {loading ? (
        <p>{zh ? "正在读取…" : "Loading…"}</p>
      ) : items.length ? (
        <ol className="class-playlist-list">
          {items.map((item, index) => (
            <li key={item.id}>
              <video
                src={`/api/classrooms/${code}/playlist/${item.id}#t=0.1`}
                muted
                playsInline
                preload="metadata"
              />
              <div>
                <input
                  aria-label={zh ? "视频标题" : "Video title"}
                  value={item.title}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((value) =>
                        value.id === item.id
                          ? { ...value, title: event.target.value }
                          : value,
                      ),
                    )
                  }
                  onBlur={() => void save(items)}
                />
                <small>
                  {sizeLabel(item.fileSizeBytes)} · {item.contentType}
                </small>
              </div>
              <nav>
                <button
                  type="button"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={zh ? "上移" : "Move up"}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={zh ? "下移" : "Move down"}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(item)}
                  aria-label={zh ? "删除" : "Delete"}
                >
                  🗑
                </button>
              </nav>
            </li>
          ))}
        </ol>
      ) : (
        <div className="class-playlist-empty">
          <strong>{zh ? "还没有视频" : "No videos yet"}</strong>
          <p>
            {zh
              ? "上传第一个视频，为网络研讨会或直播课堂准备自动内容。"
              : "Upload the first video for an automated Webinar or Live stream."}
          </p>
        </div>
      )}
    </section>
  );
}
