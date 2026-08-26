import Link from "next/link";
import { collegeTags, type CollegeRow } from "../lib/smartlingo-colleges";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";

export function CollegeCard({college,lang}:{college:CollegeRow;lang:InterfaceLanguage}){
  const t=(english:string,chinese:string)=>interfaceText(lang,english,chinese),zh=lang==="zh",title=zh?college.titleZh:college.titleEn,description=zh?college.descriptionZh:college.descriptionEn;
  const access=college.accessType==="public"?t("Open college","公开学院"):college.accessType==="trial"?t("Referred college","推荐学院"):t("Private college","专属学院");
  const price=college.tuitionCents?new Intl.NumberFormat(lang,{style:"currency",currency:college.currency}).format(college.tuitionCents/100):t("Free","免费");
  return <article className="smartlingo-college-card"><header><span>⌂ {college.code}</span><b>{access}</b></header><div className="college-card-tags">{collegeTags(college).map(tag=><span key={tag.id}>{zh?tag.nameZh:tag.nameEn}</span>)}</div><h2>{title}</h2><p>{description}</p><small>{t("College owner","院长")} · {college.ownerName} · {college.courseCount} {t("courses","门课程")} · {price}</small><Link className="primary-button" href={`/${lang}/college/${college.code}`}>{t("Enter college","进入学院")} →</Link></article>;
}
