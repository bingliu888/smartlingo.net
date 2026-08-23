import { notFound, redirect } from "next/navigation";

/**
 * Compatibility route for bookmarks created by the previous product.
 * SmartLingo member discovery is organized around classes and Community.
 */
export default async function TalentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  redirect(`/${lang}/classes`);
}
