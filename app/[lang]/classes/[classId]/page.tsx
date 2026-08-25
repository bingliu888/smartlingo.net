import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClassStudio } from "../../../../components/ClassStudio";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { requestUser } from "../../../../lib/request-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; classId: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "课程详情" : "Course details" };
}

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; classId: string }>;
  searchParams: Promise<{ invite?: string; department?: string }>;
}) {
  const { lang, classId } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query = await searchParams;
  const user = await requestUser();
  if (!user) {
    const returnQuery=new URLSearchParams();if(query.invite)returnQuery.set("invite",query.invite);if(query.department)returnQuery.set("department",query.department);
    const returnTo = `/${lang}/classes/${encodeURIComponent(classId)}${returnQuery.size?`?${returnQuery}`:""}`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="classes-page">
      <SiteHeader lang={lang} />
      <ClassStudio lang={lang === "zh" ? "zh" : "en"} initialClassId={classId} initialInviteCode={query.invite} initialDepartmentId={query.department} />
      <SiteFooter lang={lang} />
    </main>
  );
}
