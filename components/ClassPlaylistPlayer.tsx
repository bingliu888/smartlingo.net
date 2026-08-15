"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PlaylistItem = { id: string; title: string; position: number };

export function ClassPlaylistPlayer({
  code,
  locale,
  enabled,
  apiBase = "/api/classes",
}: {
  code: string;
  locale: "en" | "zh";
  enabled: boolean;
  apiBase?: string;
}) {
  const zh = locale === "zh";
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [stoppedReason, setStoppedReason] = useState<"paused" | "limit" | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopsRef = useRef(0);
  const finishedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    videoRef.current?.pause();
    setActive(false);
    setStoppedReason("limit");
  }, []);

  const start = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    loopsRef.current = 0;
    finishedRef.current = false;
    setIndex(0);
    setStoppedReason(null);
    setError("");
    setActive(true);
    timerRef.current = window.setTimeout(finish, 300000);
  }, [finish]);

  const pause = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    videoRef.current?.pause();
    setActive(false);
    setStoppedReason("paused");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBase}/${code}/playlist`, { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data: { items?: PlaylistItem[] } | null) => {
        if (!cancelled) setItems(data?.items || []);
      })
      .catch(() => {
        if (!cancelled) setError(zh ? "无法读取播放列表。" : "Could not load the playlist.");
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, code, zh]);

  useEffect(() => {
    if (!enabled || !items.length) {
      videoRef.current?.pause();
      setActive(false);
      return;
    }
    start();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      videoRef.current?.pause();
    };
  }, [enabled, items.length, start]);

  useEffect(() => {
    if (!active || !items[index]) return;
    const video = videoRef.current;
    if (!video) return;
    video.src = `${apiBase}/${code}/playlist/${items[index].id}`;
    video.currentTime = 0;
    video.muted = false;
    setMuted(false);
    video.load();
    void video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      void video.play().catch(() =>
        setError(zh ? "点击播放以开始候场视频。" : "Tap play to start the waiting video."),
      );
    });
  }, [active, apiBase, code, index, items, zh]);

  const next = () => {
    if (!items.length || finishedRef.current) return;
    if (index === items.length - 1) {
      loopsRef.current += 1;
      if (loopsRef.current >= 5) return finish();
    }
    setIndex((index + 1) % items.length);
  };

  if (!enabled || !items.length) return null;
  return (
    <section className="class-local-playlist" data-local-playlist="true">
      <button
        type="button"
        className="playlist-waiting-toggle"
        onClick={active ? pause : start}
        aria-pressed={active}
      >
        <span className="playlist-live-dot" />
        <strong>
          {active
            ? zh
              ? "候场播放列表正在播放 · 点击暂停"
              : "Waiting playlist is playing · Pause"
            : stoppedReason === "limit"
              ? zh
                ? "候场播放列表已停止 · 点击重新播放"
                : "Waiting playlist stopped · Play again"
              : zh
                ? "候场播放列表已暂停 · 点击重新播放"
                : "Waiting playlist paused · Play again"}
        </strong>
        <small>{items[index]?.title}</small>
      </button>
      <div className="class-local-playlist-tile">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="auto"
          onEnded={next}
          onError={() => setError(zh ? "候场视频无法播放。" : "The waiting video could not play.")}
        />
        <span>{items[index]?.title}</span>
        {muted ? (
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.muted = false;
              setMuted(false);
              void video.play();
            }}
          >
            {zh ? "开启声音" : "Enable sound"}
          </button>
        ) : null}
        {error ? <em>{error}</em> : null}
      </div>
    </section>
  );
}
