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
  return <main className="community-page" data-layout-page="community"><SiteHeader lang={lang}/><section className="dashboard-voice-panel"><div><p className="section-kicker">COURSES</p><h2>{lang === "zh" ? "进入课程" : "Open Courses"}</h2><p>{lang === "zh" ? "浏览课程，并从课程内进入专属教室。" : "Browse courses and enter the dedicated classroom inside each course."}</p></div><a className="dashboard-voice-cta" href={`/${lang}/classes`}>{lang === "zh" ? "浏览课程" : "Browse courses"} →</a></section><CommunityMeetings lang={lang}/><CommunityClient lang={lang}/><SiteFooter lang={lang}/></main>;
}
