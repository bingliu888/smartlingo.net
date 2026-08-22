"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { InterfaceLanguage } from "../lib/interface-locale";
export function AdminMenuLink({lang,onNavigate}:{lang:InterfaceLanguage;onNavigate?:()=>void}){const[visible,setVisible]=useState(false);useEffect(()=>{fetch("/api/account-context",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>setVisible(Boolean(v?.isPermanentAdmin))).catch(()=>setVisible(false))},[]);const label=lang==="zh"?"管理员面板":lang==="ja"?"管理者ダッシュボード":lang==="ko"?"관리자 대시보드":"Admin dashboard";return visible?<Link onClick={onNavigate} href={`/${lang}/admin`}><b>{label}</b><small>→</small></Link>:null}
