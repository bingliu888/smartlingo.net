import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClassStudio } from "../../../components/ClassStudio";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { requestUser } from "../../../lib/request-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: lang === "zh" ? "SmartLingo 课程" : "SmartLingo Courses",
    description: lang === "zh"
      ? "选择学习语言和课程等级；初级永久免费，首次进入中级或高级会开始一次 7 天 Max 试用，试用后需有效 Max 才能继续。"
      : "Choose a learning language and course level. Beginner is always free; entering Intermediate or Advanced starts one 7-day Max trial, after which active Max is required.",
  };
}

export default async function ClassesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ invite?: string; target?: string }>;
}) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "zh-tw" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query = await searchParams;
  const user = await requestUser();
  if (!user) {
    const returnParams = new URLSearchParams();
    if (query.invite) returnParams.set("invite", query.invite);
    if (query.target) returnParams.set("target", query.target);
    const returnTo = `/${lang}/classes${returnParams.size ? `?${returnParams.toString()}` : ""}`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="classes-page" data-layout-page="courses" data-layout-overlap-check="courses-page">
      <SiteHeader lang={lang} />
      <span data-layout-overlap-check="classes-start" style={{ display: "block", height: 1 }} />
      <ClassStudio lang={lang} initialInviteCode={query.invite} initialTargetLanguage={query.target} />
      <span data-layout-overlap-check="classes-end" style={{ display: "block", height: 1 }} />
      <SiteFooter lang={lang} />
    </main>
  );
}
