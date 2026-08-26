import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { projectTasks } from "../lib/project-status";
import { getProjectRuntime } from "../lib/project-runtime";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";

export async function ProjectDashboard({ lang, month }: { lang: InterfaceLanguage; month?: string }) {
  const runtime = await getProjectRuntime();
  const projectReports = runtime.reports;
  const latestReport = projectReports.at(-1)!;
  const zh = lang === "zh";
  const dataLanguage = zh ? "zh" : "en";
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
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
    const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 7, 23 + index))));

    return <section className="gg-calendar">
      <div className="gg-calendar-head">
        <div style={{ minWidth: 0 }}>
          <h2>{new Date(Date.UTC(year, calendarMonth - 1)).toLocaleString(lang, { month: "long", year: "numeric" })}</h2>
          <span>{t("Select a date to review its five tasks and recorded evidence", "选择日期查看当天五项任务与真实证据")}</span>
        </div>
        <nav className="gg-calendar-nav" aria-label={t("Project months", "项目月份")}>
          {previousMonth ? <Link href={`/${lang}/project?month=${previousMonth}`}>← {t("Previous", "上个月")}</Link> : <span>← {t("Previous", "上个月")}</span>}
          {nextMonth ? <Link href={`/${lang}/project?month=${nextMonth}`}>{t("Next", "下个月")} →</Link> : <span>{t("Next", "下个月")} →</span>}
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
            ? t("{count} tasks", "{count} 项").replace("{count}", String(tasks.length))
            : report
              ? t("Report", "日报")
              : t("Release", "发布");

          return hasDetails
            ? <Link
                key={date}
                className={`gg-day ${state}`}
                href={`/${lang}/project/day/${date}`}
                aria-label={`${date}, ${compactLabel}`}
              >
                <b>{day}</b>
                <small>{compactLabel} →</small>
              </Link>
            : <span className="gg-day" key={date}><b>{day}</b></span>;
        })}
      </div>
    </section>;
  };

  return <main className="gg-project-page" data-layout-page="project">
    <SiteHeader lang={lang}/>
    <div className="gg-project-main" style={{ minWidth: 0, overflowX: "clip" }}>
      <section className="gg-project-hero" data-layout-fill="project-hero">
        <div style={{ minWidth: 0, overflowWrap: "anywhere" }} data-layout-track="project-hero-copy">
          <p className="section-kicker">{t("SMARTLINGO PUBLIC PROJECT OPERATIONS", "SmartLingo 公开项目管理")}</p>
          <h1 data-layout-text-fit="project-title">{t("Twenty days. Five tasks every day.", "二十天，每天五项。")}</h1>
          <p data-readable-copy="project-hero-copy">{t("Follow 100 public deliverables across legacy migration, twelve-language five-skill learning, member-created courses, course communities, Ask Guru, Live Audio, platform memberships, and safe commerce.", "公开展示旧站迁移、十二种语言与五项技能学习、会员自助开班、课程社区、智能导师、实时语音、平台会员与安全商务的一百项交付计划。")}</p>
        </div>
        <div className="gg-project-picker" style={{ minWidth: 0, overflowWrap: "anywhere" }} data-layout-track="project-checkpoint">
          <span>{t("LATEST RECORDED CHECKPOINT", "最新真实检查点")}</span>
          <strong>{latestReport.date}</strong>
          <Link href={`/${lang}/project/report/${latestReport.date}`}>{t("Review task evidence", "查看任务证据")} →</Link>
        </div>
      </section>

      <section className="gg-velocity" data-layout-fill="project-velocity">
        <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <p className="section-kicker">{t("TWENTY-DAY DELIVERY CADENCE", "二十天交付节奏")}</p>
          <h2>{t("Five per day / 100 roadmap tasks", "每日五项 / 路线图一百项")}</h2>
          <Link href={`/${lang}/project/day/${latestReport.date}`}>{t("View the earliest completed date", "查看最早完成日期")} →</Link>
        </div>
        <strong>{runtime.today} / {runtime.total}</strong>
      </section>

      <section className="gg-kpis" data-layout-fill="project-kpis" aria-label={t("Project task totals", "项目任务统计")}>
        <article><b>{projectTasks.length}</b><span>{t("Total tasks", "任务总数")}</span></article>
        <article><b>{done}</b><span>{t("Completed", "已完成")}</span></article>
        <article><b>{planned}</b><span>{t("Planned", "已计划")}</span></article>
        <article className="risk"><b>{blocked}</b><span>{t("Blocked", "受阻")}</span></article>
      </section>

      <div className="gg-legend">
        <span><i className="complete"/>{t("Completed with evidence", "已完成并有证据")}</span>
        <span><i className="planned"/>{t("Planned delivery", "计划交付")}</span>
        <span><i className="risk"/>{t("Blocked, not completed", "受阻，不能标为完成")}</span>
      </div>

      <div className="gg-calendar-stack">
        {calendar(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)))}
      </div>

      <section className="gg-history gg-build-history">
        <header>
          <p className="section-kicker">{t("VERIFIED RELEASE HISTORY", "经核验的发布历史")}</p>
          <h2>{t("Only releases with Sites, GitHub, and production-domain evidence", "只记录有 Sites、GitHub 与正式域名证据的版本")}</h2>
        </header>
        {runtime.builds.length > 0
          ? [...runtime.builds].reverse().map(build => <article key={build.version}>
              <time>v{build.version}</time>
              <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <h3>{build.title[dataLanguage]}</h3>
                <p>{build.date} · {t("{count} completed items", "完成 {count} 项").replace("{count}", String(build.completed[dataLanguage].length))}</p>
              </div>
              <Link href={`/${lang}/project/build/${build.version}`}>{t("View evidence", "查看证据")} →</Link>
            </article>)
          : <article>
              <time>—</time>
              <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <h3>{t("No verified release is recorded yet", "尚无经核验的发布记录")}</h3>
                <p>{t("A local migration foundation is not a Sites, GitHub, or production-domain release. A version will appear here only after every gate passes.", "本地迁移基础不等于 Sites、GitHub 或正式域名发布。通过全部门禁后才会在此登记版本。")}</p>
              </div>
            </article>}
      </section>

      <section className="gg-history">
        <header>
          <p className="section-kicker">{t("DAILY CHECKPOINTS", "每日检查点")}</p>
          <h2>{t("Task evidence, risks, and next steps", "任务证据、风险与下一步")}</h2>
        </header>
        {[...projectReports].reverse().map(report => <article key={report.date}>
          <time>{report.date}</time>
          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <h3>{report.title[dataLanguage]}</h3>
            <p>{t("{count} completed tasks with evidence", "有证据的完成任务：{count} 项").replace("{count}", String(report.completed))}</p>
          </div>
          <Link href={`/${lang}/project/report/${report.date}`}>{report.beta[dataLanguage]} →</Link>
        </article>)}
      </section>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
