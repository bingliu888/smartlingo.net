import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassStudio } from "../../../components/ClassStudio";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: lang === "zh" ? "班级工作室" : "Class Studio",
    description: lang === "zh"
      ? "每位已登录会员都可作为教师或协调员创建私有语言班，并带领社区共同学习。"
      : "Every signed-in member can create a private language class as a teacher or coordinator.",
  };
}

export default async function ClassesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const query = await searchParams;
  return (
    <main className="classes-page">
      <SiteHeader lang={lang} />
      <ClassStudio lang={lang} initialInviteCode={query.invite} />
      <SiteFooter lang={lang} />
    </main>
  );
}
