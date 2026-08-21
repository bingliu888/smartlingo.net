"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinCollegeByCode({lang}:{lang:"en"|"zh"}){
  const zh=lang==="zh",router=useRouter(),[code,setCode]=useState("");
  function submit(event:React.FormEvent){event.preventDefault();const value=code.replace(/\D/g,"").slice(0,6);if(value.length===6)router.push(`/${lang}/college/${value}`);}
  return <form className="college-code-entry" onSubmit={submit}><label><span className="sr-only">{zh?"输入 6 位学院编号":"Enter 6-digit college number"}</span><input inputMode="numeric" autoComplete="off" value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder={zh?"输入 6 位学院编号":"Enter 6-digit college number"} aria-label={zh?"学院编号":"College number"}/></label><button type="submit" disabled={code.length!==6}>{zh?"进入":"Enter"}</button></form>;
}
