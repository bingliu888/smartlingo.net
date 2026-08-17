import { notFound, redirect } from "next/navigation";

export default async function CryptoPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  redirect(`/${lang}/programs`);
}
