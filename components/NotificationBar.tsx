"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";

type Notice = { id: string; type: "live_request" | "message"; senderName: string; threadId: string; expiresAt: number };

export function NotificationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const zh = pathname.startsWith("/zh");
  const { isSignedIn } = useUser();
  const lang = zh ? "zh" : "en";
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSignedIn) {
      const resetTimer = window.setTimeout(() => {
        if (active) setNotice(null);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }

    const poll = async () => {
      try {
        const response = await fetch("/api/messages?notifications=1", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { notifications?: Notice[] };
        const next = data.notifications?.[0] || null;
        if (active && next) setNotice(current => current ?? next);
      } catch {}
    };
    void poll();
    const timer = window.setInterval(poll, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isSignedIn]);
  useEffect(() => { document.documentElement.style.setProperty("--site-notification-height", notice ? "52px" : "0px"); if (!notice) return; const timer = window.setTimeout(() => setNotice(null), Math.max(0, notice.expiresAt - Date.now())); return () => window.clearTimeout(timer); }, [notice]);
  async function close(response: "accepted" | "dismissed") { if (!notice) return; const current = notice; setNotice(null); await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "notification_response", notificationId: current.id, threadId: current.threadId, response }) }).catch(() => null); if (response === "accepted") router.push(current.type === "live_request" ? `/${lang}/messages/live/${current.threadId}` : `/${lang}/messages?thread=${current.threadId}`); }
  if (!notice) return null;
  const text = notice.type === "live_request" ? (zh ? `${notice.senderName} 想与您实时聊天` : `${notice.senderName} wants to live chat with you`) : (zh ? `${notice.senderName} 给您发来新消息` : `${notice.senderName} sent you a message`);
  return <aside className="site-notification-bar" aria-live="assertive"><span>{text}</span><button onClick={() => close("accepted")}>{zh ? "打开" : "Open"}</button><button className="site-notification-close" aria-label={zh ? "关闭" : "Dismiss"} onClick={() => close("dismissed")}>×</button></aside>;
}
