import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MembersDirectory } from "../../../components/MembersDirectory";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { getSessionUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") || "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/members`);
  return <main className="members-page-shell"><SiteHeader lang={lang}/><MembersDirectory lang={lang}/><SiteFooter lang={lang}/></main>;
}
