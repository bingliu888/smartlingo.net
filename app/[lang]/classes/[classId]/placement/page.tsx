import { notFound, redirect } from "next/navigation";

export default async function PlacementPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang, classId } = await params;
  if (lang !== "zh" && lang !== "en") notFound();
  redirect(`/${lang}/classes/${encodeURIComponent(classId)}/learn`);
}
