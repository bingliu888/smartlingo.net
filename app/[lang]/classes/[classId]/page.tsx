import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassStudio } from "../../../../components/ClassStudio";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; classId: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "加入班级" : "Join class" };
}

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; classId: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { lang, classId } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const query = await searchParams;
  return (
    <main className="classes-page">
      <SiteHeader lang={lang} />
      <ClassStudio lang={lang} initialClassId={classId} initialInviteCode={query.invite} />
      <SiteFooter lang={lang} />
    </main>
  );
}
