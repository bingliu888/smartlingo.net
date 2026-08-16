"use client";

import { useEffect } from "react";

export default function GlobalError() {
  useEffect(() => { window.location.replace("/"); }, []);
  return <html><body><main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><a href="/">正在返回首页… / Returning home…</a></main></body></html>;
}
