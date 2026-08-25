"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError() {
  useEffect(() => { window.location.replace("/"); }, []);
  return <html><body><main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Link href="/">正在返回首页…</Link></main></body></html>;
}
