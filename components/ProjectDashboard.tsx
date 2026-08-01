import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { projectTasks } from "../lib/project-status";
import { getProjectRuntime } from "../lib/project-runtime";

export async function ProjectDashboard({ lang, month }: { lang: "en" | "zh"; month?: string }) {
  const runtime = await getProjectRuntime();
  const projectReports = runtime.reports;
  const latestReport = projectReports.at(-1)!;
  const zh = lang === "zh";
  const done = projectTasks.filter(task => task.status === "done").length;
  const blocked = projectTasks.filter(task => task.status === "blocked").length;
  const planned = projectTasks.length - done - blocked;
  const reports = new Map(projectReports.map(report => [report.date, report]));
  const buildDates = new Map<string, number>();
  runtime.builds.forEach(build => buildDates.set(build.date, (buildDates.get(build.date) ?? 0) + 1));
  const calendarMonths = [
    ...new Set(
      [
        ...projectTasks.map(item => item.date),
        ...projectReports.map(item => item.date),
        ...runtime.builds.map(item => item.date),
      ].map(date => date.slice(0, 7)),
    ),
  ].sort();
  const selectedMonth = month && calendarMonths.includes(month) ? month : latestReport.date.slice(0, 7);
  const selectedIndex = calendarMonths.indexOf(selectedMonth);
  const previousMonth = selectedIndex > 0 ? calendarMonths[selectedIndex - 1] : undefined;
  const nextMonth = selectedIndex < calendarMonths.length - 1 ? calendarMonths[selectedIndex + 1] : undefined;

  const calendar = (year: number, calendarMonth: number) => {
    const leading = new Date(Date.UTC(year, calendarMonth - 1, 1, 12)).getUTCDay();
    const count = new Date(Date.UTC(year, calendarMonth, 0, 12)).getUTCDate();
    const weekdays = zh ? ["日", "一", "二", "三", "四", "五", "六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return <section className="gg-calendar">
      <div className="gg-calendar-head">
        <div style={{ minWidth: 0 }}>
          <h2>{zh ? `${year} 年 ${calendarMonth} 月` : new Date(Date.UTC(year, calendarMonth - 1)).toLocaleString("en", { month: "long", year: "numeric" })}</h2>
          <span>{zh ? "选择日期查看当天五项任务与真实证据" : "Select a date to review its five tasks and recorded evidence"}</span>
        </div>
        <nav className="gg-calendar-nav" aria-label={zh ? "项目月份" : "Project months"}>
          {previousMonth ? <Link href={`/${lang}/project?month=${previousMonth}`}>← {zh ? "上个月" : "Previous"}</Link> : <span>← {zh ? "上个月" : "Previous"}</span>}
          {nextMonth ? <Link href={`/${lang}/project?month=${nextMonth}`}>{zh ? "下个月" : "Next"} →</Link> : <span>{zh ? "下个月" : "Next"} →</span>}
        </nav>
      </div>
      <div className="gg-calendar-grid">
        {weekdays.map(day => <span key={day}>{day}</span>)}
        {Array.from({ length: leading }).map((_, index) => <i key={index}/>)}
        {Array.from({ length: count }, (_, index) => index + 1).map(day => {
          const date = `${year}-${String(calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const tasks = projectTasks.filter(task => task.date === date);
          const report = reports.get(date);
          const buildCount = buildDates.get(date) ?? 0;
          const hasDetails = tasks.length > 0 || Boolean(report) || buildCount > 0;
          const allDone = tasks.length > 0 && tasks.every(task => task.status === "done");
          const hasRisk = tasks.some(task => task.status === "blocked");
          const state = hasRisk ? "risk" : allDone ? "complete" : "planned";
          const compactLabel = tasks.length > 0
            ? zh ? `${tasks.length} 项` : `${tasks.length} tasks`
            : report
              ? zh ? "日报" : "Report"
              : zh ? "发布" : "Release";

          return hasDetails
            ? <Link
                key={date}
                className={`gg-day ${state}`}
                href={`/${lang}/project/day/${date}`}
                aria-label={zh ? `${date}，${compactLabel}` : `${date}, ${compactLabel}`}
              >
                <b>{day}</b>
                <small>{compactLabel} →</small>
              </Link>
            : <span className="gg-day" key={date}><b>{day}</b></span>;
        })}
      </div>
    </section>;
  };

  return <main className="gg-project-page">
    <SiteHeader lang={lang}/>
    <div className="gg-project-main" style={{ minWidth: 0, overflowX: "clip" }}>
      <section className="gg-project-hero">
        <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <p className="section-kicker">{zh ? "SmartLingo 公开项目管理" : "SMARTLINGO PUBLIC PROJECT OPERATIONS"}</p>
          <h1>{zh ? "二十天，每天五项。" : "Twenty days. Five tasks every day."}</h1>
          <p>{zh ? "公开展示旧站迁移、七种语言学习、会员自助开班、班级社区、智能导师、实时语音、平台会员与安全商务的一百项交付计划。" : "Follow 100 public deliverables across legacy migration, seven-language learning, member-created classes, class communities, Ask Guru, Live Audio, platform memberships, and safe commerce."}</p>
        </div>
        <div className="gg-project-picker" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <span>{zh ? "最新真实检查点" : "LATEST RECORDED CHECKPOINT"}</span>
          <strong>{latestReport.date}</strong>
          <Link href={`/${lang}/project/report/${latestReport.date}`}>{zh ? "查看任务证据" : "Review task evidence"} →</Link>
        </div>
      </section>

      <section className="gg-velocity">
        <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <p className="section-kicker">{zh ? "二十天交付节奏" : "TWENTY-DAY DELIVERY CADENCE"}</p>
          <h2>{zh ? "每日五项 / 路线图一百项" : "Five per day / 100 roadmap tasks"}</h2>
          <Link href={`/${lang}/project/day/${latestReport.date}`}>{zh ? "查看最早完成日期" : "View the earliest completed date"} →</Link>
        </div>
        <strong>{runtime.today} / {runtime.total}</strong>
      </section>

      <section className="gg-kpis" aria-label={zh ? "项目任务统计" : "Project task totals"}>
        <article><b>{projectTasks.length}</b><span>{zh ? "任务总数" : "Total tasks"}</span></article>
        <article><b>{done}</b><span>{zh ? "已完成" : "Completed"}</span></article>
        <article><b>{planned}</b><span>{zh ? "已计划" : "Planned"}</span></article>
        <article className="risk"><b>{blocked}</b><span>{zh ? "受阻" : "Blocked"}</span></article>
      </section>

      <div className="gg-legend">
        <span><i className="complete"/>{zh ? "已完成并有证据" : "Completed with evidence"}</span>
        <span><i className="planned"/>{zh ? "计划交付" : "Planned delivery"}</span>
        <span><i className="risk"/>{zh ? "受阻，不能标为完成" : "Blocked, not completed"}</span>
      </div>

      <div className="gg-calendar-stack">
        {calendar(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)))}
      </div>

      <section className="gg-history gg-build-history">
        <header>
          <p className="section-kicker">{zh ? "经核验的发布历史" : "VERIFIED RELEASE HISTORY"}</p>
          <h2>{zh ? "只记录有 Sites、GitHub 与正式域名证据的版本" : "Only releases with Sites, GitHub, and production-domain evidence"}</h2>
        </header>
        {runtime.builds.length > 0
          ? [...runtime.builds].reverse().map(build => <article key={build.version}>
              <time>v{build.version}</time>
              <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <h3>{build.title[lang]}</h3>
                <p>{build.date} · {zh ? `完成 ${build.completed[lang].length} 项` : `${build.completed[lang].length} completed items`}</p>
              </div>
              <Link href={`/${lang}/project/build/${build.version}`}>{zh ? "查看证据" : "View evidence"} →</Link>
            </article>)
          : <article>
              <time>—</time>
              <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <h3>{zh ? "尚无经核验的发布记录" : "No verified release is recorded yet"}</h3>
                <p>{zh ? "本地迁移基础不等于 Sites、GitHub 或正式域名发布。通过全部门禁后才会在此登记版本。" : "A local migration foundation is not a Sites, GitHub, or production-domain release. A version will appear here only after every gate passes."}</p>
              </div>
            </article>}
      </section>

      <section className="gg-history">
        <header>
          <p className="section-kicker">{zh ? "每日检查点" : "DAILY CHECKPOINTS"}</p>
          <h2>{zh ? "任务证据、风险与下一步" : "Task evidence, risks, and next steps"}</h2>
        </header>
        {[...projectReports].reverse().map(report => <article key={report.date}>
          <time>{report.date}</time>
          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <h3>{report.title[lang]}</h3>
            <p>{zh ? `有证据的完成任务：${report.completed} 项` : `${report.completed} completed tasks with evidence`}</p>
          </div>
          <Link href={`/${lang}/project/report/${report.date}`}>{report.beta[lang]} →</Link>
        </article>)}
      </section>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
