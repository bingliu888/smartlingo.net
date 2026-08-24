import Link from "next/link";
import { collegeTags, type CollegeRow } from "../lib/smartlingo-colleges";
import type { InterfaceLanguage } from "../lib/interface-locale";

export function CollegeCard({college,lang}:{college:CollegeRow;lang:InterfaceLanguage}){
  const zh=lang==="zh",title=zh?college.titleZh:college.titleEn,description=zh?college.descriptionZh:college.descriptionEn;
  const access=college.accessType==="public"?(zh?"公开学院":"Open college"):college.accessType==="trial"?(zh?"推荐学院":"Referred college"):(zh?"专属学院":"Private college");
  const price=college.tuitionCents?new Intl.NumberFormat(lang,{style:"currency",currency:college.currency}).format(college.tuitionCents/100):(zh?"免费":"Free");
  return <article className="smartlingo-college-card"><header><span>⌂ {college.code}</span><b>{access}</b></header><div className="college-card-tags">{collegeTags(college).map(tag=><span key={tag.id}>{zh?tag.nameZh:tag.nameEn}</span>)}</div><h2>{title}</h2><p>{description}</p><small>{zh?"院长":"College owner"} · {college.ownerName} · {college.courseCount} {zh?"门课程":"courses"} · {price}</small><Link className="primary-button" href={`/${lang}/college/${college.code}`}>{zh?"进入学院":"Enter college"} →</Link></article>;
}
