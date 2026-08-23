import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { getProjectRuntime } from "../../../../../lib/project-runtime";

export default async function ReportPage({ params }: { params: Promise<{ lang: string; date: string }> }) {
  const { lang, date } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const report = (await getProjectRuntime()).reports.find(item => item.date === date);
  if (!report) notFound();
  const zh = lang === "zh";
  return <main className="gg-project-page" data-layout-page="project"><SiteHeader lang={lang}/><article className="gg-detail" data-readable-copy="project-report-copy"><Link href={`/${lang}/project`}>← {zh ? "项目日历" : "Project calendar"}</Link><p className="section-kicker">{zh ? "每日报告" : "DAILY REPORT"} · {date}</p><h1 data-layout-text-fit="project-report-title">{report.title[lang]}</h1><div className="gg-detail-summary" data-layout-fill="project-report-summary"><span>{report.beta[lang]}</span><b>{report.completed} {zh ? "项里程碑" : "milestones"}</b></div><section data-layout-track="project-report-completed"><h2>{zh ? "今日完成" : "Completed today"}</h2><p>{report.summary[lang]}</p></section><section data-layout-track="project-report-validation"><h2>{zh ? "验证记录" : "Validation record"}</h2><ul>{report.validation[lang].map(item => <li key={item}>{item}</li>)}</ul></section><section data-layout-fill="project-report-rollback"><h2>{zh ? "回滚边界" : "Rollback boundary"}</h2><p>{report.rollback[lang]}</p></section><section><h2>{zh ? "下一日计划" : "Next delivery day"}</h2><p>{report.next[lang]}</p></section><Link className="gg-detail-link" href={`/${lang}/project`}>{zh ? "返回项目日历" : "Back to project calendar"} →</Link></article><SiteFooter lang={lang}/></main>;
}
