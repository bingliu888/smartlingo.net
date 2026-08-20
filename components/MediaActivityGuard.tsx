/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, react-hooks/purity */
"use client";

import { useEffect, useRef, useState } from "react";
import type RTKClient from "@cloudflare/realtimekit";

export const MEDIA_IDLE_LIMIT_MS = 3 * 60 * 1000;
export const MEDIA_IDLE_CONFIRM_SECONDS = 15;

type Props = {
  active: boolean;
  mode: "audio" | "video";
  room?: RTKClient;
  locale: string;
  confirmStillAlone: () => Promise<boolean>;
  onExpire: () => void;
};

// Stops abandoned publisher connections without treating a quiet audience as
// a ghost speaker. Audio activity is measured from the local microphone track;
// video activity is measured from small, off-screen frame samples so no image
// data is stored or sent anywhere.
export function MediaActivityGuard({ active, mode, room, locale, confirmStillAlone, onExpire }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [seconds, setSeconds] = useState(MEDIA_IDLE_CONFIRM_SECONDS);
  const lastActivityRef = useRef(Date.now());
  const lastVideoFrameRef = useRef<Uint8ClampedArray | undefined>(undefined);
  const expiringRef = useRef(false);
  const checkingAloneRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const confirmStillAloneRef = useRef(confirmStillAlone);
  onExpireRef.current = onExpire;
  confirmStillAloneRef.current = confirmStillAlone;

  const continueSession = () => {
    lastActivityRef.current = Date.now();
    lastVideoFrameRef.current = undefined;
    setSeconds(MEDIA_IDLE_CONFIRM_SECONDS);
    setConfirming(false);
  };

  const leaveSession = () => {
    if (expiringRef.current) return;
    expiringRef.current = true;
    setConfirming(false);
    onExpireRef.current();
  };

  useEffect(() => {
    if (!active) {
      expiringRef.current = false;
      lastActivityRef.current = Date.now();
      lastVideoFrameRef.current = undefined;
      setConfirming(false);
      setSeconds(MEDIA_IDLE_CONFIRM_SECONDS);
      return;
    }

    lastActivityRef.current = Date.now();
    let disposed = false;
    let audioContext: AudioContext | undefined;
    let analyser: AnalyserNode | undefined;
    let audioSource: MediaStreamAudioSourceNode | undefined;
    let attachedAudioTrack: MediaStreamTrack | undefined;
    const audioSamples = new Uint8Array(128);
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    video.muted = true;
    video.playsInline = true;

    const closeAudioGraph = () => {
      try { audioSource?.disconnect(); } catch { /* already disconnected */ }
      analyser?.disconnect();
      audioSource = undefined;
      analyser = undefined;
      attachedAudioTrack = undefined;
      if (audioContext) void audioContext.close().catch(() => undefined);
      audioContext = undefined;
    };

    const sampleAudio = () => {
      const track = room?.self.audioTrack;
      if (track !== attachedAudioTrack) {
        closeAudioGraph();
        if (track?.readyState === "live") {
          try {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            audioSource = audioContext.createMediaStreamSource(new MediaStream([track]));
            audioSource.connect(analyser);
            attachedAudioTrack = track;
            lastActivityRef.current = Date.now();
          } catch {
            closeAudioGraph();
          }
        }
      }
      if (!analyser) return;
      analyser.getByteTimeDomainData(audioSamples);
      let energy = 0;
      for (const value of audioSamples) {
        const centered = (value - 128) / 128;
        energy += centered * centered;
      }
      // Roughly -46 dBFS: high enough to ignore device noise, low enough to
      // recognise normal speech on laptop and mobile microphones.
      if (Math.sqrt(energy / audioSamples.length) > 0.005)
        lastActivityRef.current = Date.now();
    };

    const sampleVideo = () => {
      const track = room?.self.videoTrack;
      if (!track || track.readyState !== "live" || !context) return;
      const currentStream = video.srcObject as MediaStream | null;
      if (currentStream?.getVideoTracks()[0] !== track) {
        video.srcObject = new MediaStream([track]);
        lastVideoFrameRef.current = undefined;
        lastActivityRef.current = Date.now();
        void video.play().catch(() => undefined);
        return;
      }
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const previous = lastVideoFrameRef.current;
      lastVideoFrameRef.current = new Uint8ClampedArray(frame);
      if (!previous || previous.length !== frame.length) return;
      let changed = 0;
      // Sample RGB values only. A mean channel delta above 1.6 reliably catches
      // a person moving while ignoring compression and sensor shimmer.
      for (let index = 0; index < frame.length; index += 4)
        changed += Math.abs(frame[index] - previous[index]) + Math.abs(frame[index + 1] - previous[index + 1]) + Math.abs(frame[index + 2] - previous[index + 2]);
      if (changed / (frame.length * 0.75) > 1.6)
        lastActivityRef.current = Date.now();
    };

    const timer = window.setInterval(() => {
      if (disposed || confirming || expiringRef.current) return;
      if (mode === "audio") sampleAudio();
      else sampleVideo();
      if (Date.now() - lastActivityRef.current >= MEDIA_IDLE_LIMIT_MS) {
        if (checkingAloneRef.current) return;
        checkingAloneRef.current = true;
        void confirmStillAloneRef.current().then((stillAlone) => {
          checkingAloneRef.current = false;
          if (disposed || !stillAlone) {
            lastActivityRef.current = Date.now();
            return;
          }
          setSeconds(MEDIA_IDLE_CONFIRM_SECONDS);
          setConfirming(true);
        }).catch(() => {
          checkingAloneRef.current = false;
          lastActivityRef.current = Date.now();
        });
      }
    }, 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      closeAudioGraph();
      video.pause();
      video.srcObject = null;
    };
  }, [active, confirming, mode, room]);

  useEffect(() => {
    if (!confirming) return;
    if (seconds <= 0) {
      if (!expiringRef.current) {
        expiringRef.current = true;
        onExpireRef.current();
      }
      return;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [confirming, seconds]);

  if (!confirming) return null;
  const zh = locale === "zh";
  return (
    <div className="media-idle-backdrop" role="presentation">
      <section className="media-idle-dialog" role="dialog" aria-modal="true" aria-live="assertive" aria-label={zh ? "媒体活动确认" : "Media activity confirmation"}>
        <p className="eyebrow"><span /> {zh ? "连接保护" : "CONNECTION GUARD"}</p>
        <h2>{zh ? "是否继续？" : "Do you want to continue?"}</h2>
        <p>{zh ? `${mode === "video" ? "画面" : "麦克风"}已 3 分钟没有检测到活动。${seconds} 秒后将断开连接并离开会议室。` : `No ${mode === "video" ? "camera motion" : "microphone activity"} was detected for 3 minutes. The connection will close and leave the room in ${seconds} seconds.`}</p>
        <div className="media-idle-actions">
          <button type="button" onClick={continueSession}>{zh ? "是，继续" : "Yes, continue"}</button>
          <button type="button" className="danger" onClick={leaveSession}>{zh ? "否，离开" : "No, leave"}</button>
        </div>
      </section>
    </div>
  );
}
