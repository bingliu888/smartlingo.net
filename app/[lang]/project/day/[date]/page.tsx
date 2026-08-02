import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { tasksByDate } from "../../../../../lib/project-status";
import { getProjectRuntime } from "../../../../../lib/project-runtime";

export default async function ProjectDay({ params }: { params: Promise<{ lang: string; date: string }> }) {
  const { lang, date } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const zh = lang === "zh";
  const tasks = tasksByDate(date);
  const runtime = await getProjectRuntime();
  const report = runtime.reports.find(item => item.date === date);
  const builds = runtime.builds.filter(item => item.date === date);
  if (!tasks.length && !report && !builds.length) notFound();
  return <main className="gg-project-page" data-layout-page="project"><SiteHeader lang={lang}/><article className="gg-detail" data-readable-copy="project-day-copy"><Link href={`/${lang}/project?month=${date.slice(0, 7)}`}>← {zh ? "项目日历" : "Project calendar"}</Link><p className="section-kicker">{zh ? `交付日期 · ${date}` : `DELIVERY DATE · ${date}`}</p><h1 data-layout-text-fit="project-day-title">{zh ? "当天任务与部署" : "Schedule and deployments"}</h1>{tasks.length > 0 && <><h2 className="gg-day-section-title">{zh ? "计划任务" : "Scheduled tasks"}</h2><section className="gg-day-list" data-layout-fill="project-day-list">{tasks.map(task => <Link href={`/${lang}/project/task/${task.id}`} data-layout-track={`project-task-${task.id}`} key={task.id}><span>{zh ? task.status === "done" ? "已完成" : task.status === "blocked" ? "受阻" : "已计划" : task.status}</span><div><h2>{task.title[lang]}</h2><p>{task.summary[lang]}</p><small>{task.category[lang]} · {task.owner[lang]} · {task.progress}%</small></div><b>→</b></Link>)}</section></>}{builds.length > 0 && <section className="gg-day-builds" data-layout-fill="project-day-builds"><h2>{zh ? "当天部署" : "Deployments on this day"}</h2>{[...builds].reverse().map(build => <Link href={`/${lang}/project/build/${build.version}`} key={build.version}><b>v{build.version}</b><span>{build.title[lang]}</span><i>→</i></Link>)}</section>}{report && <Link className="gg-detail-link" href={`/${lang}/project/report/${date}`}>{zh ? "打开完整日报与回滚记录" : "Open daily report and rollback trail"} →</Link>}</article><SiteFooter lang={lang}/></main>;
}
