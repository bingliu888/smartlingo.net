import { notFound, redirect } from "next/navigation";

export default async function CourseCryptoPage({ params }: { params: Promise<{ lang: string; classId: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "zh-tw" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  redirect(`/${lang}/pricing`);
}
