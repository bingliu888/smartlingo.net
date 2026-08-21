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
const accessFields=(zh:boolean,tags:CollegeTag[])=><>
  <label>{zh?"访问类型":"Access type"}<select name="accessType" defaultValue="public"><option value="public">{zh?"公开学院":"Open college"}</option><option value="trial">{zh?"推荐学院":"Referred college"}</option><option value="private">{zh?"专属学院":"Private college"}</option></select></label>
  <label>{zh?"价格（美元）":"Price (USD)"}<input name="tuition" type="number" min="0" step="0.01" defaultValue="0"/></label>
  <label>{zh?"推荐试用天数":"Referral days"}<input name="trialDays" type="number" min="0" max="365" defaultValue="7"/></label>
  <label>{zh?"标签":"Tag"}<select name="tag">{tags.map(tag=><option key={tag.id} value={tag.slug}>{zh?tag.nameZh:tag.nameEn}</option>)}</select></label>
</>;

export function CollegeCreateForm({lang,tags}:{lang:"en"|"zh";tags:CollegeTag[]}){
  const zh=lang==="zh",router=useRouter(),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setNotice("");const response=await fetch("/api/colleges",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});const data=await response.json().catch(()=>({})) as{code?:string;error?:string};if(response.ok&&data.code){router.push(`/${lang}/college/${data.code}`);return;}setNotice(data.error||(zh?"无法创建学院":"Unable to create college"));setBusy(false);}
  return <form className="college-admin-form" onSubmit={submit}>{fields(zh)}{accessFields(zh,tags)}<button className="primary-button" disabled={busy}>{busy?"…":zh?"创建学院与导论课程":"Create college & introduction"}</button>{notice&&<p role="alert">{notice}</p>}</form>;
}

export function CollegeManageForm({lang,college,tags,courses}:{lang:"en"|"zh";college:CollegeRow;tags:CollegeTag[];courses:{id:string;title:string;targetLanguage:string;level:string}[]}){
  const zh=lang==="zh",router=useRouter(),[notice,setNotice]=useState("");
  async function update(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const response=await fetch(`/api/colleges/${college.code}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});setNotice(response.ok?(zh?"学院已更新":"College updated"):((await response.json().catch(()=>({}))).error||(zh?"更新失败":"Update failed")));if(response.ok)router.refresh();}
  async function add(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));const response=await fetch(`/api/colleges/${college.code}/courses`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});setNotice(response.ok?(zh?"课程已加入学院":"Course added to college"):((await response.json().catch(()=>({}))).error||(zh?"添加失败":"Add failed")));if(response.ok)router.refresh();}
  const assigned=collegeTagsSafe(college)[0]?.slug||"general";
  return <div className="college-management-grid"><form className="college-admin-form" onSubmit={update}>{fieldsWithDefaults(zh,college)}<label>{zh?"访问类型":"Access type"}<select name="accessType" defaultValue={college.accessType}><option value="public">{zh?"公开学院":"Open college"}</option><option value="trial">{zh?"推荐学院":"Referred college"}</option><option value="private">{zh?"专属学院":"Private college"}</option></select></label><label>{zh?"价格（美元）":"Price (USD)"}<input name="tuition" type="number" min="0" step="0.01" defaultValue={college.tuitionCents/100}/></label><label>{zh?"推荐试用天数":"Referral days"}<input name="trialDays" type="number" min="0" max="365" defaultValue={college.trialDays}/></label><label>{zh?"标签":"Tag"}<select name="tag" defaultValue={assigned}>{tags.map(tag=><option key={tag.id} value={tag.slug}>{zh?tag.nameZh:tag.nameEn}</option>)}</select></label><button>{zh?"保存学院":"Save college"}</button></form><form className="college-admin-form college-add-course" onSubmit={add}><h3>{zh?"添加现有课程":"Add an existing course"}</h3><p>{zh?"选择一门 SmartLingo 课程加入本学院课程表；导论课程始终保留在首位。":"Add a SmartLingo course to this college table; the introductory course always stays first."}</p><label>{zh?"课程":"Course"}<select name="courseId" required><option value="">{zh?"选择课程":"Choose course"}</option>{courses.map(course=><option key={course.id} value={course.id}>{course.targetLanguage.toUpperCase()} · {course.level} · {course.title}</option>)}</select></label><button disabled={!courses.length}>{zh?"添加课程":"Add course"}</button></form>{notice&&<p role="status">{notice}</p>}</div>;
}

function collegeTagsSafe(college:CollegeRow){return college.tagsText.split("|").filter(Boolean).map(value=>{const[id,slug]=value.split("~");return{id,slug};});}
function fieldsWithDefaults(zh:boolean,college:CollegeRow){return <><label>{zh?"学院英文名称":"College name (English)"}<input name="titleEn" defaultValue={college.titleEn} required/></label><label>{zh?"学院中文名称":"College name (Chinese)"}<input name="titleZh" defaultValue={college.titleZh} required/></label><label>{zh?"英文介绍":"English description"}<textarea name="descriptionEn" defaultValue={college.descriptionEn}/></label><label>{zh?"中文介绍":"中文介绍"}<textarea name="descriptionZh" defaultValue={college.descriptionZh}/></label></>;}

export function AdminCollegeTags({lang,tags}:{lang:"en"|"zh";tags:CollegeTag[]}){
  const zh=lang==="zh",router=useRouter(),[notice,setNotice]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const response=await fetch("/api/admin/college-tags",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});setNotice(response.ok?(zh?"标签已添加":"Tag added"):((await response.json().catch(()=>({}))).error||(zh?"添加失败":"Unable to add tag")));if(response.ok){event.currentTarget.reset();router.refresh();}}
  return <section className="admin-college-tags"><div><p className="section-kicker">COLLEGE TAGS</p><h2>{zh?"学院标签":"College tags"}</h2><p>{tags.map(tag=>zh?tag.nameZh:tag.nameEn).join(" · ")}</p></div><form onSubmit={submit}><label>English<input name="nameEn" required/></label><label>中文<input name="nameZh" required/></label><button>{zh?"添加标签":"Add tag"}</button></form>{notice&&<p role="status">{notice}</p>}</section>;
}
