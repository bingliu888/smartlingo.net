/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
type Locale = "en" | "zh";
import {
  nextPlaylistSoundEnabled,
  PLAYLIST_CONTINUE_SECONDS,
  PLAYLIST_MAX_ACTIVE_MS,
  playlistLimitReached,
  playlistLimitResolution,
} from "@/lib/class-playlist-playback";

type PlaylistItem = { id: string; title: string; position: number };

export function ClassPlaylistPlayer({
  code,
  locale,
  enabled,
  onState = () => undefined,
  apiBase = "/api/classes",
}: {
  code: string;
  locale: Locale;
  enabled: boolean;
  onState?: (active: boolean) => void;
  apiBase?: string;
}) {
  const zh = locale === "zh";
  const [target, setTarget] = useState<Element | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [limitPromptOpen, setLimitPromptOpen] = useState(false);
  const [limitSeconds, setLimitSeconds] = useState(PLAYLIST_CONTINUE_SECONDS);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const soundEnabledRef = useRef(true);
  const roundsRef = useRef(0);
  const playedMsRef = useRef(0);
  const playingSinceRef = useRef<number | null>(null);
  const limitTimerRef = useRef<number | null>(null);
  const limitStoppedRef = useRef(false);

  const clearLimitTimer = () => {
    if (limitTimerRef.current !== null)
      window.clearTimeout(limitTimerRef.current);
    limitTimerRef.current = null;
  };

  const recordPlayedTime = () => {
    if (playingSinceRef.current === null) return;
    playedMsRef.current += Date.now() - playingSinceRef.current;
    playingSinceRef.current = null;
  };

  const stopAtLimit = () => {
    recordPlayedTime();
    clearLimitTimer();
    limitStoppedRef.current = true;
    videoRef.current?.pause();
    setLimitSeconds(PLAYLIST_CONTINUE_SECONDS);
    setLimitPromptOpen(true);
  };

  const restartLimitCycle = () => {
    roundsRef.current = 0;
    playedMsRef.current = 0;
    playingSinceRef.current = null;
    limitStoppedRef.current = false;
    setLimitPromptOpen(false);
    setLimitSeconds(PLAYLIST_CONTINUE_SECONDS);
    setIndex(0);
    window.setTimeout(() => void videoRef.current?.play().catch(() => undefined), 0);
  };

  const declineLimit = () => {
    if (playlistLimitResolution(limitSeconds, true) !== "stop") return;
    setLimitPromptOpen(false);
    setLimitSeconds(PLAYLIST_CONTINUE_SECONDS);
  };

  const startLimitTimer = () => {
    if (limitStoppedRef.current) {
      roundsRef.current = 0;
      playedMsRef.current = 0;
      limitStoppedRef.current = false;
      setIndex(0);
    }
    if (playingSinceRef.current !== null) return;
    playingSinceRef.current = Date.now();
    clearLimitTimer();
    const remaining = Math.max(0, PLAYLIST_MAX_ACTIVE_MS - playedMsRef.current);
    limitTimerRef.current = window.setTimeout(stopAtLimit, remaining);
  };

  const pauseLimitTimer = () => {
    recordPlayedTime();
    clearLimitTimer();
  };

  useEffect(() => {
    const updateTarget = () =>
      setTarget(document.querySelector(".class-waiting")?.parentElement || null);
    updateTarget();
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
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
      onState(false);
      return;
    }
    setIndex(0);
    setError("");
    roundsRef.current = 0;
    playedMsRef.current = 0;
    playingSinceRef.current = null;
    limitStoppedRef.current = false;
    setLimitPromptOpen(false);
    onState(true);
    return () => {
      recordPlayedTime();
      clearLimitTimer();
      videoRef.current?.pause();
      onState(false);
    };
  }, [enabled, items.length, onState]);

  useEffect(() => {
    if (!limitPromptOpen) return;
    const resolution = playlistLimitResolution(limitSeconds, false);
    if (resolution === "continue") {
      restartLimitCycle();
      return;
    }
    const timer = window.setTimeout(
      () => setLimitSeconds((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [limitPromptOpen, limitSeconds]);

  useEffect(() => {
    const stopPlaylist = () => {
      videoRef.current?.pause();
      setLimitPromptOpen(false);
    };
    window.__smartClassStopPlaylist = stopPlaylist;
    return () => {
      if (window.__smartClassStopPlaylist === stopPlaylist)
        window.__smartClassStopPlaylist = undefined;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !items[index]) return;
    const video = videoRef.current;
    if (!video) return;
    video.src = `${apiBase}/${code}/playlist/${items[index].id}`;
    video.currentTime = 0;
    video.defaultMuted = false;
    video.muted = !soundEnabledRef.current;
    video.load();
    void video.play().catch(() => {
      soundEnabledRef.current = nextPlaylistSoundEnabled(
        soundEnabledRef.current,
        "play-failed",
      );
      setError(
        zh
          ? "浏览器已暂停自动播放。点击播放器的播放按钮即可继续，声音保持开启。"
          : "The browser paused autoplay. Press play in the player to continue with sound on.",
      );
    });
  }, [apiBase, code, enabled, index, items, zh]);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const video = videoRef.current;
      if (!video) return;
      setProgress({
        current: Math.max(0, video.currentTime || 0),
        duration: Math.max(0, video.duration || 0),
      });
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [enabled]);

  const next = () => {
    if (!items.length) return;
    if (index === items.length - 1) {
      roundsRef.current += 1;
      if (playlistLimitReached(roundsRef.current, playedMsRef.current)) {
        stopAtLimit();
        return;
      }
    }
    setIndex((index + 1) % items.length);
  };

  if (!enabled || !items.length) return null;
  const tile = target ? createPortal(
    <div
      className="class-local-playlist"
      data-count="1"
      data-layout="solo"
      data-local-playlist="true"
      aria-label={zh ? "本机候场播放列表" : "Local waiting playlist"}
    >
      <div className="class-local-playlist-tile">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="auto"
          onEnded={next}
          onPlay={startLimitTimer}
          onPause={pauseLimitTimer}
          onPlaying={() => setError("")}
          onVolumeChange={(event) => {
            const video = event.currentTarget;
            soundEnabledRef.current = nextPlaylistSoundEnabled(
              soundEnabledRef.current,
              video.muted || video.volume === 0
                ? "user-muted"
                : "user-unmuted",
            );
          }}
          onError={() => setError(zh ? "候场视频无法播放。" : "The waiting video could not play.")}
        />
        <div
          className="playlist-view-timeline"
          aria-label={zh ? "播放列表进度" : "Playlist progress"}
        >
          <progress
            aria-label={zh ? "当前项目播放进度" : "Current item progress"}
            max={Math.max(1, progress.duration || 1)}
            value={Math.min(progress.current, progress.duration || 1)}
          />
        </div>
        {error ? <em>{error}</em> : null}
      </div>
    </div>,
    target,
  ) : null;
  const prompt = limitPromptOpen && typeof document !== "undefined" ? createPortal(
    <div className="media-idle-backdrop" role="presentation">
      <section className="media-idle-dialog" role="dialog" aria-modal="true" aria-live="assertive" aria-label={zh ? "播放列表继续确认" : "Playlist continuation confirmation"}>
        <p className="eyebrow"><span /> {zh ? "候场播放" : "WAITING PLAYLIST"}</p>
        <h2>{zh ? "是否继续播放？" : "Do you want the playlist to continue?"}</h2>
        <p>{zh ? `已完成 5 轮或播放满 5 分钟。如未选择“否”，${limitSeconds} 秒后将自动开始新的 5 轮或 5 分钟。` : `Five rounds or five minutes are complete. Unless you choose “No”, a new five-round or five-minute cycle starts in ${limitSeconds} seconds.`}</p>
        <div className="media-idle-actions">
          <button type="button" onClick={restartLimitCycle}>{zh ? "是，继续" : "Yes, continue"}</button>
          <button type="button" className="danger" onClick={declineLimit}>{zh ? "否，停止" : "No, stop"}</button>
        </div>
      </section>
    </div>,
    document.body,
  ) : null;
  return <>{tile}{prompt}</>;
}

declare global {
  interface Window {
    __smartClassStopPlaylist?: () => void | Promise<void>;
  }
}
