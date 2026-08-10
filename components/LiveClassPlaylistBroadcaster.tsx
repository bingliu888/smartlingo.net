"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type RTKClient from "@cloudflare/realtimekit";
type Locale = "en" | "zh";

type PlaylistItem = { id: string; title: string; position: number };
type PlaylistResponse = {
  items: PlaylistItem[];
  state: { active: number; currentItemId: string | null } | null;
};
type PlaylistWindow = Window & {
  __smartClassPlaylistActive?: boolean;
  __smartClassPlaylistVideoTrack?: MediaStreamTrack;
  __smartClassStopPlaylist?: () => Promise<void>;
};

export function LiveClassPlaylistBroadcaster({
  meeting,
  code,
  locale,
  enabled,
  onState,
  onTrack,
}: {
  meeting: RTKClient;
  code: string;
  locale: Locale;
  enabled: boolean;
  onState: (active: boolean) => void;
  onTrack: (track: MediaStreamTrack | undefined) => void;
}) {
  const zh = locale === "zh";
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"loading" | "publishing" | "live" | "error">("loading");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
    null,
  );
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioOutputConnectedRef = useRef(false);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const drawingRef = useRef<number | null>(null);
  const publishedRef = useRef(false);
  const publishingRef = useRef(false);
  const stoppingRef = useRef(false);
  const stopBridgeRef = useRef<() => Promise<void>>(async () => undefined);
  const publishBridgeRef = useRef<() => Promise<void>>(async () => undefined);
  const postMedia = useCallback(
    async (action: "audio" | "video", value: boolean) => {
      const response = await fetch(`/api/classrooms/${code}/media`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(detail.error || `MEDIA_STATE_${response.status}`);
      }
      return response;
    },
    [code],
  );
  const load = useCallback(async () => {
    const response = await fetch(`/api/classrooms/${code}/playlist`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as PlaylistResponse;
    const list = data.items || [];
    setItems(list);
    const selected = Math.max(
      0,
      list.findIndex((item) => item.id === data.state?.currentItemId),
    );
    setIndex(selected < 0 ? 0 : selected);
  }, [code]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const stop = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      publishedRef.current = false;
      (window as PlaylistWindow).__smartClassPlaylistActive = false;
      delete (window as PlaylistWindow).__smartClassPlaylistVideoTrack;
      window.dispatchEvent(
        new CustomEvent<MediaStreamTrack | undefined>(
          "smartclass:playlist-track",
          { detail: undefined },
        ),
      );
      onState(false);
      onTrack(undefined);
      if (drawingRef.current !== null) cancelAnimationFrame(drawingRef.current);
      drawingRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      canvasStreamRef.current?.getTracks().forEach((track) => track.stop());
      canvasStreamRef.current = null;
      audioDestinationRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
      audioDestinationRef.current = null;
      await audioRef.current?.suspend().catch(() => undefined);
      await Promise.allSettled([
        meeting.self.disableAudio(),
        meeting.self.disableVideo(),
        postMedia("audio", false),
        postMedia("video", false),
      ]);
    } finally {
      stoppingRef.current = false;
    }
  }, [meeting, onState, onTrack, postMedia]);
  useEffect(() => {
    stopBridgeRef.current = stop;
  }, [stop]);
  useEffect(() => {
    const target = window as PlaylistWindow;
    const bridge = () => stopBridgeRef.current();
    target.__smartClassStopPlaylist = bridge;
    return () => {
      if (target.__smartClassStopPlaylist === bridge)
        delete target.__smartClassStopPlaylist;
      void stopBridgeRef.current();
    };
  }, []);
  useEffect(
    () => () => {
      void audioRef.current?.close().catch(() => undefined);
      audioRef.current = null;
      audioSourceRef.current = null;
      audioOutputConnectedRef.current = false;
    },
    [],
  );
  const waitForProducer = useCallback(
    async (kind: "audio" | "video", expectedTrack: MediaStreamTrack) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const producer = meeting.self.producers.find(
          (candidate) =>
            candidate.kind === kind &&
            !candidate.closed &&
            candidate.track === expectedTrack &&
            candidate.track?.readyState === "live",
        );
        if (producer) return producer;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
      }
      throw new Error(`PLAYLIST_${kind.toUpperCase()}_PRODUCER_MISSING`);
    },
    [meeting],
  );
  const withTimeout = useCallback(
    async <T,>(label: string, operation: Promise<T>, timeout = 8000) => {
      let timer = 0;
      try {
        return await Promise.race([
          operation,
          new Promise<never>((_, reject) => {
            timer = window.setTimeout(
              () => reject(new Error(`PLAYLIST_${label}_TIMEOUT`)),
              timeout,
            );
          }),
        ]);
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    },
    [],
  );
  const publish = useCallback(async () => {
    const video = videoRef.current,
      canvas = canvasRef.current;
    if (
      !video ||
      !canvas ||
      !items[index] ||
      publishedRef.current ||
      publishingRef.current
    )
      return;
    publishingRef.current = true;
    try {
      setError("");
      setStatus("publishing");
      video.currentTime = 0;
      // Safari may defer all media loading for a hidden element when it is
      // considered audible. Keep the element itself muted so autoplay is
      // deterministic; its pre-mute audio is routed through Web Audio below
      // into the custom RealtimeKit track (and the teacher's local output).
      video.muted = true;
      // Safari can leave the promise returned by play() pending forever for a
      // hidden media element even after playback has actually started. Drive
      // the state machine from the element's real paused/error state instead
      // of blocking all RealtimeKit publication on that WebKit promise.
      let playFailure: unknown;
      void video.play().catch((cause) => {
        playFailure = cause;
      });
      const playDeadline = Date.now() + 5000;
      while (video.paused && !playFailure && Date.now() < playDeadline)
        await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
      if (playFailure) throw playFailure;
      if (video.paused) throw new Error("PLAYLIST_VIDEO_PLAY_TIMEOUT");
      const width = Math.max(640, video.videoWidth || 1280),
        height = Math.max(360, video.videoHeight || 720);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("CANVAS_UNAVAILABLE");
      const draw = () => {
        if (!video.paused && !video.ended)
          context.drawImage(video, 0, 0, width, height);
        drawingRef.current = requestAnimationFrame(draw);
      };
      draw();
      const canvasStream = canvas.captureStream(30);
      canvasStreamRef.current = canvasStream;
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) throw new Error("AUDIO_CONTEXT_UNAVAILABLE");
      const audioContext =
        audioRef.current && audioRef.current.state !== "closed"
          ? audioRef.current
          : new AudioContextClass();
      audioRef.current = audioContext;
      const source =
        audioSourceRef.current || audioContext.createMediaElementSource(video);
      audioSourceRef.current = source;
      let destination = audioDestinationRef.current;
      if (
        !destination ||
        destination.stream
          .getAudioTracks()
          .every((track) => track.readyState === "ended")
      ) {
        destination = audioContext.createMediaStreamDestination();
        audioDestinationRef.current = destination;
        source.connect(destination);
      }
      if (!audioOutputConnectedRef.current) {
        source.connect(audioContext.destination);
        audioOutputConnectedRef.current = true;
      }
      // WebKit may keep resume() pending (instead of rejecting) when a fresh
      // page has lost its transient user activation. Bound that wait so the
      // teacher receives the branded one-click start control rather than an
      // endless "preparing" banner.
      await withTimeout(
        "AUDIO_CONTEXT_RESUME",
        audioContext.resume(),
        5000,
      );
      const videoTrack = canvasStream.getVideoTracks()[0],
        audioTrack = destination.stream.getAudioTracks()[0];
      if (!videoTrack || !audioTrack)
        throw new Error("PLAYLIST_TRACK_UNAVAILABLE");
      videoTrack.contentHint = "motion";
      audioTrack.contentHint = "music";
      // A browser interruption, hot deployment, or WebKit page restore may
      // leave the previous local producers attached to this participant. End
      // those tracks before publishing the playlist so the SDK never reuses a
      // stale camera/microphone producer for the new canvas/audio tracks.
      await Promise.allSettled([
        meeting.self.disableAudio(),
        meeting.self.disableVideo(),
      ]);
      // The room join path normally prepares the publisher stage. Keep this
      // defensive check here as reconnects may return a staged publisher to
      // OFF_STAGE while this component remains mounted.
      const stageStatus = () => String(meeting.self.stageStatus);
      if (stageStatus() !== "ON_STAGE") {
        if (stageStatus() === "OFF_STAGE")
          await withTimeout("STAGE_REQUEST", meeting.stage.requestAccess());
        if (stageStatus() === "ACCEPTED_TO_JOIN_STAGE")
          await withTimeout("STAGE_JOIN", meeting.stage.join());
        if (stageStatus() !== "ON_STAGE")
          throw new Error(`PLAYLIST_STAGE_NOT_READY_${stageStatus()}`);
      }
      // RealtimeKit shares media producers serially. Publishing both custom
      // tracks concurrently can race inside the SDK, and v2 intentionally
      // swallows that internal producer error. Verify each track after the
      // SDK call so the UI never reports a broadcast that was not published.
      // RealtimeKit's self-managed media flow installs audio before video.
      // Installing audio second can rebuild WebKit's media handler and silently
      // discard the already-published canvas track, leaving viewers with an
      // active meeting but no video. Publish in the documented order and then
      // verify both final tracks after the second operation completes.
      await withTimeout("AUDIO_ENABLE", meeting.self.enableAudio(audioTrack));
      if (!meeting.self.audioEnabled || !meeting.self.audioTrack)
        throw new Error("PLAYLIST_AUDIO_NOT_PUBLISHED");
      await waitForProducer("audio", audioTrack);
      await withTimeout("VIDEO_ENABLE", meeting.self.enableVideo(videoTrack));
      if (!meeting.self.videoEnabled || !meeting.self.videoTrack)
        throw new Error("PLAYLIST_VIDEO_NOT_PUBLISHED");
      await waitForProducer("video", videoTrack);
      if (
        !meeting.self.audioEnabled ||
        meeting.self.audioTrack !== audioTrack ||
        !meeting.self.videoEnabled ||
        meeting.self.videoTrack !== videoTrack
      )
        throw new Error("PLAYLIST_FINAL_TRACKS_NOT_PUBLISHED");
      await Promise.all([postMedia("audio", true), postMedia("video", true)]);
      publishedRef.current = true;
      (window as PlaylistWindow).__smartClassPlaylistActive = true;
      const publishedVideoTrack = meeting.self.videoTrack || videoTrack;
      (window as PlaylistWindow).__smartClassPlaylistVideoTrack =
        publishedVideoTrack;
      window.dispatchEvent(
        new CustomEvent<MediaStreamTrack | undefined>(
          "smartclass:playlist-track",
          { detail: publishedVideoTrack },
        ),
      );
      onState(true);
      onTrack(publishedVideoTrack);
      setNeedsGesture(false);
      setStatus("live");
    } catch (cause) {
      setStatus("error");
      setNeedsGesture(true);
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? zh
            ? "Safari 需要教师点击一次才能开始有声播放。"
            : "Safari needs one teacher click to start playback with sound."
          : zh
            ? `无法将播放列表发布到 RealtimeKit（${detail}）。`
            : `Could not publish the playlist to RealtimeKit (${detail}).`,
      );
    } finally {
      publishingRef.current = false;
    }
  }, [index, items, meeting, onState, onTrack, postMedia, waitForProducer, withTimeout, zh]);
  // RealtimeKit updates its client facade as participants and stage state
  // change. Calling the latest publisher through a ref prevents those facade
  // updates from restarting the HTMLVideoElement load effect mid-buffer.
  useEffect(() => {
    publishBridgeRef.current = publish;
  }, [publish]);
  useEffect(() => {
    if (!enabled || !items.length) return;
    const video = videoRef.current;
    if (!video) return;
    let started = false;
    const ready = () => {
      if (started || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
        return;
      started = true;
      setStatus(publishedRef.current ? "live" : "publishing");
      video.currentTime = 0;
      if (publishedRef.current)
        void video.play().catch(() => setNeedsGesture(true));
      else void publishBridgeRef.current();
    };
    const failed = () => {
      const detail = video.error?.message || `MEDIA_ERROR_${video.error?.code || "UNKNOWN"}`;
      setStatus("error");
      setError(zh ? `无法读取播放列表视频（${detail}）。` : `Could not read playlist video (${detail}).`);
    };
    setStatus("loading");
    video.muted = true;
    video.addEventListener("loadedmetadata", ready);
    video.addEventListener("loadeddata", ready, { once: true });
    video.addEventListener("canplay", ready);
    video.addEventListener("error", failed, { once: true });
    video.src = `/api/classrooms/${code}/playlist/${items[index].id}`;
    video.load();
    // WebKit occasionally misses loadeddata for a visually hidden element,
    // even though readyState has advanced. Polling makes the publisher robust
    // across page restoration, tab interruption, and a fresh room join.
    const readyTimer = window.setInterval(ready, 250);
    const timeout = window.setTimeout(() => {
      if (started || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
        return ready();
      setStatus("error");
      setNeedsGesture(true);
      setError(
        zh
          ? `播放列表视频准备超时（状态 ${video.readyState}/${video.networkState}）。`
          : `Playlist video preparation timed out (${video.readyState}/${video.networkState}).`,
      );
    }, 15000);
    return () => {
      window.clearInterval(readyTimer);
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", ready);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("error", failed);
    };
  }, [code, cycle, enabled, index, items, zh]);
  useEffect(() => {
    if (!enabled) return;
    const sync = () => {
      if (!publishedRef.current) return;
      void Promise.all([postMedia("audio", true), postMedia("video", true)]).catch(
        () => undefined,
      );
    };
    sync();
    const timer = window.setInterval(sync, 5000);
    return () => window.clearInterval(timer);
  }, [enabled, postMedia]);
  async function next() {
    if (!items.length) return;
    const nextIndex = (index + 1) % items.length;
    setIndex(nextIndex);
    setCycle((current) => current + 1);
    void fetch(`/api/classrooms/${code}/playlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "select", itemId: items[nextIndex].id }),
    });
  }
  if (!enabled || !items.length) return null;
  return (
    <div className="playlist-broadcast-runtime" role="status">
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        onEnded={() => void next()}
      />
      <canvas ref={canvasRef} />
      <span className="playlist-live-dot" />
      <strong>
        {status === "live"
          ? zh
            ? "播放列表正在通过 RealtimeKit 循环播流"
            : "Playlist is looping through RealtimeKit"
          : status === "error"
            ? zh
              ? "播放列表播流失败"
              : "Playlist broadcast failed"
            : zh
              ? "正在准备播放列表播流…"
              : "Preparing playlist broadcast…"}
      </strong>
      <small>{items[index]?.title}</small>
      {needsGesture ? (
        <button type="button" onClick={() => void publish()}>
          {zh ? "开始有声播流" : "Start broadcast with sound"}
        </button>
      ) : null}
      {error ? <em>{error}</em> : null}
    </div>
  );
}
