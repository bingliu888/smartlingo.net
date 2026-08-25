"use client";

import { useClerk } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { AdminMenuLink } from "./AdminMenuLink";
import { useEffect, useRef, useState } from "react";
import styles from "./account-menu.module.css";
import { interfaceCopyFor, type InterfaceLanguage } from "../lib/interface-locale";

export function HeaderAccount({ lang, initialSignedIn = false, mobile = false, onNavigate }: { lang: InterfaceLanguage; initialSignedIn?: boolean; mobile?: boolean; onNavigate?: () => void }) {
  const interfaceUi = interfaceCopyFor(lang);
  const clerk = useClerk();
  const [session, setSession] = useState<{ loaded: boolean; signedIn: boolean; imageUrl?: string }>({ loaded: initialSignedIn, signedIn: initialSignedIn });
  const [open, setOpen] = useState(mobile);
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
  const close = () => { setOpen(false); onNavigate?.(); };
  useEffect(() => {
    if (!signedIn) return;
    const load = () => fetch("/api/messages?summary=1", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(value => value && setUnread(Number(value.unread || 0))).catch(() => undefined);
    load(); const timer = setInterval(load, 30000); return () => clearInterval(timer);
  }, [signedIn]);
  if (!session.loaded) return <span className="auth-placeholder" aria-hidden="true"/>;
  if (signedIn) {
    const label = interfaceUi.me;
    const accountLabel = `${label}${unread ? (lang === "zh" ? ` · ${unread} 条未读消息` : ` · ${unread} unread`) : ""}`;
    return <div ref={menuRef} className={`${styles.menu} gg-account-menu`}>{!mobile ? <button className="user-icon" onClick={() => setOpen(value => !value)} aria-label={accountLabel} title={label} aria-expanded={open}>{session.imageUrl ? <Image src={session.imageUrl} alt="" width={96} height={96} unoptimized/> : <span className="avatar-glyph" aria-hidden="true"/>}{unread > 0 && <i className={`unread-avatar-badge${unread > 99 ? " dot" : ""}`}>{unread > 99 ? "" : unread}</i>}</button> : null}{(open || mobile) && <nav aria-label={lang === "zh" ? "账户菜单" : "Account menu"}><Link onClick={close} href={`/${lang}/dashboard`}><b>{lang === "zh" ? "用户面板" : "Dashboard"}</b><small>→</small></Link><Link onClick={close} href={`/${lang}/classes?mine=1`}><b>{lang === "zh" ? "我的课程" : "My Courses"}</b><small>→</small></Link><Link onClick={close} href={`/${lang}/colleges/mine`}><b>{lang === "zh" ? "我的学院" : "My colleges"}</b><small>→</small></Link><Link onClick={close} href={`/${lang}/account`}>{lang === "zh" ? "个人资料" : "Profile"}<small>→</small></Link><AdminMenuLink lang={lang} onNavigate={close}/><Link onClick={close} href={`/${lang}/messages`}><b>{lang === "zh" ? "消息" : "Messages"}</b>{unread > 0 ? <i className="menu-unread">{unread > 99 ? "99+" : unread}</i> : <small>→</small>}</Link><Link onClick={close} href={`/${lang}/programs`}>{lang === "zh" ? "选择课程" : "Choose course"}<small>→</small></Link><button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); await clerk.signOut(); window.location.assign(`/${lang}`); }}>{lang === "zh" ? "退出登录" : "Sign out"}<small>↗</small></button></nav>}</div>;
  }
  const label = interfaceUi.signIn;
  return mobile ? <nav className={styles.mobileSignIn} aria-label={interfaceUi.account}><Link href={`/${lang}/auth/login`} onClick={onNavigate}>{label}<small>→</small></Link></nav> : <Link className="user-icon" href={`/${lang}/auth/login`} aria-label={label} title={label}><span className="avatar-glyph" aria-hidden="true"/></Link>;
}
