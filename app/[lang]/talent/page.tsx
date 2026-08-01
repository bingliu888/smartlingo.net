import { notFound, redirect } from "next/navigation";

/**
 * Compatibility route for bookmarks created by the previous product.
 * SmartLingo member discovery is organized around classes and Community.
 */
export default async function TalentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  redirect(`/${lang}/classes`);
}
