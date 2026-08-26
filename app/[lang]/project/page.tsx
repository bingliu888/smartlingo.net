import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDashboard } from "../../../components/ProjectDashboard";
import { interfaceText, isInterfaceLanguage, safeInterfaceLanguage } from "../../../lib/interface-locale";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = safeInterfaceLanguage(lang);
  return { title: interfaceText(locale, "Project progress", "项目进展") };
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ month?: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const { month } = await searchParams;
  return <ProjectDashboard lang={lang} month={month} />;
}
