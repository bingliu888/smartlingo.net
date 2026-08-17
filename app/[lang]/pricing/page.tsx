import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

export default async function PricingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  redirect(`/${lang}/programs`);
}
