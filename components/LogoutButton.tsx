"use client";

import { useClerk } from "@clerk/nextjs";
import type { InterfaceLanguage } from "../lib/interface-locale";

export function LogoutButton({ lang, label }: { lang: InterfaceLanguage; label: string }) {
  const clerk = useClerk();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await clerk.signOut();
    window.location.assign(`/${lang}`);
  }
  return <button className="secondary-button" onClick={logout}>{label}</button>;
}
