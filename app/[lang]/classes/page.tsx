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
      ? "先选择学习语言，再从三级课程的 3、6、12 个月固定期限套餐中选择，并进入课程专属音视频网络研讨会教室。"
      : "Choose a learning language first, then a 3, 6, or 12-month fixed-term package across three course levels and a dedicated A/V webinar classroom.",
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
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
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
