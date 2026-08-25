"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError() {
  useEffect(() => { window.location.replace("/"); }, []);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Link href="/">正在返回首页…</Link></main>;
}
