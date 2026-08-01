"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function ClerkSessionBridge({
  lang,
  returnTo,
}: {
  lang: "en" | "zh";
  returnTo: string;
}) {
  const zh = lang === "zh";
  const { getToken, isLoaded, userId } = useAuth();
  const running = useRef(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const inactiveError = isLoaded && !userId
    ? (zh
        ? "Clerk 会话尚未生效，请返回登录页重试。"
        : "Your Clerk session is not active yet. Return to sign-in and try again.")
    : "";
  const visibleError = error || inactiveError;

  useEffect(() => {
    if (!isLoaded || running.current) return;
    if (!userId) return;

    running.current = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("missing_token");
        const response = await fetch("/api/auth/clerk-session", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ language: lang }),
        });
        if (!response.ok) throw new Error(`bridge_${response.status}`);
        window.location.replace(returnTo);
      } catch {
        running.current = false;
        setError(zh
          ? "无法建立站内安全会话，请重试。"
          : "Unable to establish the secure app session. Please try again.");
      }
    })();
  }, [getToken, isLoaded, lang, retry, returnTo, userId, zh]);

  return <div className="auth-box">
    <p className="eyebrow">{zh ? "安全会话同步" : "SECURE SESSION SYNC"}</p>
    <h1>{zh ? "正在完成登录" : "Completing sign-in"}</h1>
    <p role="status">{visibleError || (zh ? "正在验证 Clerk 身份并连接站内账户…" : "Verifying your Clerk identity and connecting your app account…")}</p>
    {visibleError && <div className="auth-form">
      {userId && <button className="primary-button full" type="button" onClick={() => { setError(""); setRetry(value => value + 1); }}>
        {zh ? "重试安全连接" : "Retry secure connection"}
      </button>}
      <Link className="form-link" href={`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>
        {zh ? "返回登录页" : "Back to sign-in"}
      </Link>
    </div>}
  </div>;
}
