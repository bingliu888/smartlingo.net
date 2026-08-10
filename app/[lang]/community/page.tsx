import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CommunityClient } from "../../../components/CommunityClient";
import { CommunityMeetings } from "../../../components/CommunityMeetings";
import "./community-profile.css";
import "./live-profile.css";
import "./member-drawer.css";
import "./responsive.css";
import "./active-header.css";
import "./message-link.css";
import "./meetings.css";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { getSessionUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (lang !== "en" && lang !== "zh") notFound();
  const incoming = await headers(); const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") || "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/community`);
  return <main className="community-page" data-layout-page="community"><SiteHeader lang={lang}/><section className="dashboard-voice-panel"><div><p className="section-kicker">LIVE CLASSES</p><h2>{lang === "zh" ? "进入课堂" : "Enter Classes"}</h2><p>{lang === "zh" ? "浏览公课、试课和受邀私课。" : "Browse public, trial, and invited private classes."}</p></div><a className="dashboard-voice-cta" href={`/${lang}/classrooms`}>{lang === "zh" ? "进入课堂" : "Enter classes"} →</a></section><CommunityMeetings lang={lang}/><CommunityClient lang={lang}/><SiteFooter lang={lang}/></main>;
}
