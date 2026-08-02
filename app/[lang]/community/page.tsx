import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CommunityClient } from "../../../components/CommunityClient";
import "./community-profile.css";
import "./live-profile.css";
import "./member-drawer.css";
import "./responsive.css";
import "./active-header.css";
import "./message-link.css";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { getSessionUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (lang !== "en" && lang !== "zh") notFound();
  const incoming = await headers(); const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") || "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/community`);
  return <main className="community-page" data-layout-page="community"><SiteHeader lang={lang}/><CommunityClient lang={lang}/><SiteFooter lang={lang}/></main>;
}
