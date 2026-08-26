import "./admin.css";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminDashboard } from "../../../components/AdminDashboard";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { isPermanentAdmin } from "../../../lib/admin-access";
import { getSessionUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin`);
  if (!isPermanentAdmin(user)) redirect(`/${lang}/dashboard`);
  return <main className="dashboard-page"><SiteHeader lang={lang}/><AdminDashboard lang={lang === "zh" ? "zh" : "en"} user={user}/><SiteFooter lang={lang}/></main>;
}
