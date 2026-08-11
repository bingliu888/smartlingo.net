"use client";

declare global {
  interface Window {
    __classPlaylistAudioContext?: AudioContext;
  }
}

export function playlistAudioContext() {
  if (typeof window === "undefined") return null;
  const existing = window.__classPlaylistAudioContext;
  if (existing && existing.state !== "closed") return existing;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  window.__classPlaylistAudioContext = context;
  return context;
}

export async function unlockPlaylistAudio() {
  const context = playlistAudioContext();
  if (context && context.state !== "running") await context.resume();
  return context;
}
