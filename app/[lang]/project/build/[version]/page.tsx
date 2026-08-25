import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { getProjectRuntime } from "../../../../../lib/project-runtime";

export default async function BuildReportPage({ params }: { params: Promise<{ lang: string; version: string }> }) {
  const { lang, version } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const runtime = await getProjectRuntime();
  const build = runtime.builds.find(item => item.version === Number(version));
  if (!build) notFound();
  const zh = lang === "zh";
  return <main className="gg-project-page"><SiteHeader lang={lang}/><article className="gg-detail">
    <Link href={`/${lang}/project`}>← {zh ? "项目中心" : "Project center"}</Link>
    <p className="section-kicker">{zh ? "构建报告" : "BUILD REPORT"} · v{build.version} · {build.date}</p>
    <h1>{build.title[lang === "zh" ? "zh" : "en"]}</h1>
    <div className="gg-detail-summary"><span>{zh ? "已部署" : "DEPLOYED"}</span><b>{zh ? "提交" : "commit"} {build.commit}</b></div>
    <section><h2>{zh ? "本次构建完成" : "Completed in this build"}</h2><ul>{build.completed[lang === "zh" ? "zh" : "en"].map(item => <li key={item}>{item}</li>)}</ul></section>
    <section><h2>{zh ? "可测试内容" : "Ready to test"}</h2><ul>{build.testable[lang === "zh" ? "zh" : "en"].map(item => <li key={item}>{item}</li>)}</ul></section>
    <div className="gg-build-nav"><Link href={`/${lang}/project`}>{zh ? "全部构建" : "All builds"}</Link>{runtime.builds.find(item => item.version === build.version - 1) && <Link href={`/${lang}/project/build/${build.version - 1}`}>{zh ? "上一构建" : "Previous build"}</Link>}{runtime.builds.find(item => item.version === build.version + 1) && <Link href={`/${lang}/project/build/${build.version + 1}`}>{zh ? "下一构建" : "Next build"}</Link>}<Link href={`/${lang}/project/report/${build.date}`}>{zh ? "当日日报" : "Daily report"}</Link></div>
  </article><SiteFooter lang={lang}/></main>;
}
