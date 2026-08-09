"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function AdminMenuLink({lang,onNavigate}:{lang:"en"|"zh";onNavigate?:()=>void}){const[visible,setVisible]=useState(false);useEffect(()=>{fetch("/api/account-context",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>setVisible(Boolean(v?.isPermanentAdmin))).catch(()=>setVisible(false))},[]);return visible?<Link onClick={onNavigate} href={`/${lang}/admin`}><b>{lang==="zh"?"管理员面板":"Admin dashboard"}</b><small>→</small></Link>:null}
