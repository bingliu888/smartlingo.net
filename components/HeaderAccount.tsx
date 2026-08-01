"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./account-menu.module.css";

export function HeaderAccount({ lang, initialSignedIn = false }: { lang: "en" | "zh"; initialSignedIn?: boolean }) {
  const clerk = useClerk();
  const [session, setSession] = useState<{ loaded: boolean; signedIn: boolean; imageUrl?: string }>({ loaded: initialSignedIn, signedIn: initialSignedIn });
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(value => setSession({ loaded: true, signedIn: Boolean(value?.signedIn), imageUrl: value?.imageUrl }))
      .catch(() => setSession({ loaded: true, signedIn: initialSignedIn }));
  }, [initialSignedIn]);
  const signedIn = session.signedIn;
  useEffect(() => {
    if (!signedIn) return;
    const load = () => fetch("/api/messages?summary=1", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(value => value && setUnread(Number(value.unread || 0))).catch(() => undefined);
    load(); const timer = setInterval(load, 30000); return () => clearInterval(timer);
  }, [signedIn]);
  if (!session.loaded) return <span className="auth-placeholder" aria-hidden="true"/>;
  if (signedIn) {
    const label = lang === "zh" ? "我的账户" : "My account";
    const accountLabel = `${label}${unread ? (lang === "zh" ? ` · ${unread} 条未读消息` : ` · ${unread} unread`) : ""}`;
    return <div ref={menuRef} className={`${styles.menu} gg-account-menu`}><button className="user-icon" onClick={() => setOpen(value => !value)} aria-label={accountLabel} title={label} aria-expanded={open}>{session.imageUrl ? <img src={session.imageUrl} alt=""/> : <span className="avatar-glyph" aria-hidden="true"/>}{unread > 0 && <i className={`unread-avatar-badge${unread > 99 ? " dot" : ""}`}>{unread > 99 ? "" : unread}</i>}</button>{open && <nav aria-label={lang === "zh" ? "账户菜单" : "Account menu"}><Link onClick={() => setOpen(false)} href={`/${lang}/dashboard`}><b>{lang === "zh" ? "用户面板" : "Dashboard"}</b><small>→</small></Link><Link onClick={() => setOpen(false)} href={`/${lang}/account`}>{lang === "zh" ? "个人资料" : "Profile"}<small>→</small></Link><Link onClick={() => setOpen(false)} href={`/${lang}/classes?mine=1`}>{lang === "zh" ? "我的班级" : "My classes"}<small>→</small></Link><Link onClick={() => setOpen(false)} href={`/${lang}/messages`}><b>{lang === "zh" ? "消息" : "Messages"}</b>{unread > 0 ? <i className="menu-unread">{unread > 99 ? "99+" : unread}</i> : <small>→</small>}</Link><Link onClick={() => setOpen(false)} href={`/${lang}/community`}>{lang === "zh" ? "社区" : "Community"}<small>→</small></Link><Link onClick={() => setOpen(false)} href={`/${lang}/programs`}>{lang === "zh" ? "课程" : "Courses"}<small>→</small></Link><button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); await clerk.signOut(); window.location.assign(`/${lang}`); }}>{lang === "zh" ? "退出登录" : "Sign out"}<small>↗</small></button></nav>}</div>;
  }
  const label = lang === "zh" ? "登录" : "Sign in";
  return <Link className="user-icon" href={`/${lang}/auth/login`} aria-label={label} title={label}><span className="avatar-glyph" aria-hidden="true"/></Link>;
}
