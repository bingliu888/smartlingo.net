"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CollegeRow, CollegeTag } from "../lib/smartlingo-colleges";

const fields=(zh:boolean)=><>
  <label>{zh?"学院英文名称":"College name (English)"}<input name="titleEn" required minLength={3}/></label>
  <label>{zh?"学院中文名称":"College name (Chinese)"}<input name="titleZh" required minLength={2}/></label>
  <label>{zh?"英文介绍":"English description"}<textarea name="descriptionEn"/></label>
  <label>{zh?"中文介绍":"中文介绍"}<textarea name="descriptionZh"/></label>
</>;
export function CollegeCreateForm({lang,tags}:{lang:"en"|"zh";tags:CollegeTag[]}){
  const zh=lang==="zh",router=useRouter(),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setNotice("");const response=await fetch("/api/colleges",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});const data=await response.json().catch(()=>({})) as{code?:string;error?:string};if(response.ok&&data.code){router.push(`/${lang}/college/${data.code}`);return;}setNotice(data.error||(zh?"无法创建学院":"Unable to create college"));setBusy(false);}
  return <form className="college-admin-form" onSubmit={submit}>{fields(zh)}<input type="hidden" name="accessType" value="public"/><input type="hidden" name="tuition" value="0"/><input type="hidden" name="trialDays" value="0"/><label>{zh?"标签":"Tag"}<select name="tag">{tags.map(tag=><option key={tag.id} value={tag.slug}>{zh?tag.nameZh:tag.nameEn}</option>)}</select></label><button className="primary-button" disabled={busy}>{busy?"…":zh?"创建招生学院":"Create enrollment college"}</button>{notice&&<p role="alert">{notice}</p>}</form>;
}

export function CollegeManageForm({lang,college,tags}:{lang:"en"|"zh";college:CollegeRow;tags:CollegeTag[];courses?:{id:string;title:string;targetLanguage:string;level:string}[]}){
  const zh=lang==="zh",router=useRouter(),[notice,setNotice]=useState("");
  async function update(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const response=await fetch(`/api/colleges/${college.code}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});setNotice(response.ok?(zh?"学院已更新":"College updated"):((await response.json().catch(()=>({}))).error||(zh?"更新失败":"Update failed")));if(response.ok)router.refresh();}
  const assigned=collegeTagsSafe(college)[0]?.slug||"general";
  return <div className="college-management-grid"><form className="college-admin-form" onSubmit={update}>{fieldsWithDefaults(zh,college)}<input type="hidden" name="accessType" value={college.accessType}/><input type="hidden" name="tuition" value={college.tuitionCents/100}/><input type="hidden" name="trialDays" value={college.trialDays}/><label>{zh?"标签":"Tag"}<select name="tag" defaultValue={assigned}>{tags.map(tag=><option key={tag.id} value={tag.slug}>{zh?tag.nameZh:tag.nameEn}</option>)}</select></label><button>{zh?"保存学院资料":"Save college profile"}</button></form>{notice&&<p role="status">{notice}</p>}</div>;
}

function collegeTagsSafe(college:CollegeRow){return college.tagsText.split("|").filter(Boolean).map(value=>{const[id,slug]=value.split("~");return{id,slug};});}
function fieldsWithDefaults(zh:boolean,college:CollegeRow){return <><label>{zh?"学院英文名称":"College name (English)"}<input name="titleEn" defaultValue={college.titleEn} required/></label><label>{zh?"学院中文名称":"College name (Chinese)"}<input name="titleZh" defaultValue={college.titleZh} required/></label><label>{zh?"英文介绍":"English description"}<textarea name="descriptionEn" defaultValue={college.descriptionEn}/></label><label>{zh?"中文介绍":"中文介绍"}<textarea name="descriptionZh" defaultValue={college.descriptionZh}/></label></>;}

export function AdminCollegeTags({lang,tags}:{lang:"en"|"zh";tags:CollegeTag[]}){
  const zh=lang==="zh",router=useRouter(),[notice,setNotice]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const response=await fetch("/api/admin/college-tags",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});setNotice(response.ok?(zh?"标签已添加":"Tag added"):((await response.json().catch(()=>({}))).error||(zh?"添加失败":"Unable to add tag")));if(response.ok){event.currentTarget.reset();router.refresh();}}
  return <section className="admin-college-tags"><div><p className="section-kicker">COLLEGE TAGS</p><h2>{zh?"学院标签":"College tags"}</h2><p>{tags.map(tag=>zh?tag.nameZh:tag.nameEn).join(" · ")}</p></div><form onSubmit={submit}><label>English<input name="nameEn" required/></label><label>中文<input name="nameZh" required/></label><button>{zh?"添加标签":"Add tag"}</button></form>{notice&&<p role="status">{notice}</p>}</section>;
}
