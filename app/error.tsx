"use client";

import { useEffect } from "react";

export default function AppError() {
  useEffect(() => { window.location.replace("/"); }, []);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><a href="/">正在返回首页…</a></main>;
}
