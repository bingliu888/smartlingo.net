import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDashboard } from "../../../components/ProjectDashboard";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "项目进展" : "Project progress" };
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ month?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const { month } = await searchParams;
  return <ProjectDashboard lang={lang === "zh" ? "zh" : "en"} month={month} />;
}
