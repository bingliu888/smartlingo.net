"use client";

// The visual ticker, resize travel, reduced-motion behavior, and queued
// animation-iteration delivery follow Mahj.Guru's PlayingActionNarrator.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./RoomPresenceTicker.module.css";

export type RoomPresenceEvent = { sequence: number; text: string };

export function RoomPresenceTicker({ scope, events, fallback }: {
  scope: string;
  events: RoomPresenceEvent[];
  fallback: string;
}) {
  const [liveTicker, setLiveTicker] = useState<RoomPresenceEvent>({ sequence: -1, text: fallback });
  const [tickerEpoch, setTickerEpoch] = useState(0);
  const pendingTicker = useRef<RoomPresenceEvent[]>([]);
  const tickerSeen = useRef({ scope, sequence: -1 });
  const active = useRef(false);
  useEffect(() => {
    if (tickerSeen.current.scope !== scope) {
      pendingTicker.current = [];
      tickerSeen.current = { scope, sequence: -1 };
      active.current = false;
    }
    for (const event of events) {
      if (event.sequence > tickerSeen.current.sequence) {
        pendingTicker.current.push(event);
        tickerSeen.current.sequence = event.sequence;
      }
    }
    if (pendingTicker.current.length > 20)
      pendingTicker.current = pendingTicker.current.slice(-20);
    if (!active.current && pendingTicker.current.length) {
      active.current = true;
      const next = pendingTicker.current.shift()!;
      let delivered = false;
      const timer = window.setTimeout(() => {
        delivered = true;
        setLiveTicker(next);
      }, 0);
      return () => {
        window.clearTimeout(timer);
        if (!delivered) {
          active.current = false;
          pendingTicker.current.unshift(next);
        }
      };
    }
  }, [events, scope]);
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pendingTicker.current = [];
    tickerSeen.current = { scope, sequence: events.at(-1)?.sequence ?? -1 };
    active.current = false;
    const timer = window.setTimeout(() => setLiveTicker(events.at(-1) || { sequence: -1, text: fallback }), 0);
    return () => window.clearTimeout(timer);
  }, [events, fallback, scope]);
  return <div className={styles.ticker} role="status" aria-live="polite">
    <span key={`${scope}:${liveTicker.sequence}:${tickerEpoch}`}
      onAnimationIteration={() => {
        const next = pendingTicker.current.shift();
        if (next) { setLiveTicker(next); setTickerEpoch(value => value + 1); }
      }}
      className={styles.visualTicker}
      ref={element => {
        if (!element?.parentElement) return;
        const parent = element.parentElement;
        const resize = () => element.style.setProperty("--ticker-travel", `${parent.clientWidth}px`);
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(parent);
        return () => observer.disconnect();
      }}
      style={{ "--ticker-duration": "7000ms" } as CSSProperties}
      aria-hidden="true">{liveTicker.text}</span>
    <span className={styles.srOnly}>{events.at(-1)?.text || fallback}</span>
  </div>;
}
