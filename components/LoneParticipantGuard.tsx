/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";

const PROMPT_MS = 45_000;
const CONFIRM_SECONDS = 15;

export function LoneParticipantGuard({ active, locale, confirmStillAlone, onExpire }: {
  active: boolean;
  locale: string;
  confirmStillAlone: () => Promise<boolean>;
  onExpire: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [seconds, setSeconds] = useState(CONFIRM_SECONDS);
  const [cycle, setCycle] = useState(0);
  const expiring = useRef(false);
  const confirmRef = useRef(confirmStillAlone);
  const expireRef = useRef(onExpire);
  useEffect(() => { confirmRef.current = confirmStillAlone; }, [confirmStillAlone]);
  useEffect(() => { expireRef.current = onExpire; }, [onExpire]);

  const leave = () => {
    if (expiring.current) return;
    expiring.current = true;
    setConfirming(false);
    expireRef.current();
  };

  useEffect(() => {
    if (!active) {
      expiring.current = false;
      setConfirming(false);
      setSeconds(CONFIRM_SECONDS);
      setCycle(0);
      return;
    }
    const timer = window.setTimeout(async () => {
      if (await confirmRef.current()) {
        setSeconds(CONFIRM_SECONDS);
        setConfirming(true);
      }
    }, cycle === 0 ? PROMPT_MS : 60_000);
    return () => window.clearTimeout(timer);
  }, [active, cycle]);

  useEffect(() => {
    if (!confirming) return;
    if (seconds <= 0) return leave();
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [confirming, seconds]);

  if (!confirming) return null;
  const zh = locale === "zh";
  return <div className="media-idle-backdrop" role="presentation">
    <section className="media-idle-dialog" role="dialog" aria-modal="true">
      <p className="eyebrow"><span />{zh ? "连接确认" : "CONNECTION CHECK"}</p>
      <h2>{zh ? "是否继续？" : "Do you want to continue?"}</h2>
      <p>{zh ? `当前只有您一人在线。${seconds} 秒后将自动选择“否”并离开。` : `You are the only person connected. No response means “No”; the room will close in ${seconds} seconds.`}</p>
      <div className="media-idle-actions">
        <button type="button" onClick={() => { setConfirming(false); setSeconds(CONFIRM_SECONDS); setCycle((value) => value + 1); }}>{zh ? "是，继续" : "Yes, continue"}</button>
        <button type="button" className="danger" onClick={leave}>{zh ? "否，离开" : "No, leave"}</button>
      </div>
    </section>
  </div>;
}
