"use client";

import { useEffect } from "react";
import Link from "next/link";

// Broken shared links and unknown paths should return visitors to a usable
// starting point instead of exposing a framework 404 screen. API routes keep
// their explicit HTTP errors; this only handles browser page navigation.
export default function NotFound() {
  useEffect(() => { window.location.replace("/"); }, []);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Link href="/">正在返回首页…</Link></main>;
}
