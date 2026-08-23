import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MessageCenter } from "../../../components/MessageCenter";
import { SiteHeader } from "../../../components/SiteHeader";
import { getSessionUser } from "../../../lib/auth";
import "./messages.css";
import "./layout-contract.css";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ member?: string }> }) {
  const { lang } = await params; if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const requestHeaders = await headers(); const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: requestHeaders.get("cookie") || "" } }));
  if (!user) redirect(`/${lang}/auth/login`);
  const { member } = await searchParams;
  return <main className="messages-page" data-layout-page="messages"><SiteHeader lang={lang}/><MessageCenter lang={lang} initialMemberId={member || ""}/></main>;
}
