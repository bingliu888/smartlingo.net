"use client";

import { useClerk } from "@clerk/nextjs";

export function LogoutButton({ lang, label }: { lang: "en" | "zh"; label: string }) {
  const clerk = useClerk();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await clerk.signOut();
    window.location.assign(`/${lang}`);
  }
  return <button className="secondary-button" onClick={logout}>{label}</button>;
}
