"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FloatingAssistant() {
  const pathname = usePathname();
  const lang = pathname.startsWith("/en") ? "en" : "zh";
  const route = pathname.replace(/^\/(en|zh)/, "") || "/";
  if (route === "/assistant" || route.startsWith("/auth/")) return null;
  const label = lang === "zh" ? "打开智能助手" : "Open AI assistant";
  return <Link className="floating-assistant" href={`/${lang}/assistant`} aria-label={label} title={label}><span aria-hidden="true"/></Link>;
}
