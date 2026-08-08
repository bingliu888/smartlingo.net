import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/auth";
import { isAdmin } from "../../../lib/admin-access";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params; const h = await headers();
  const user = await getSessionUser(new Request("https://site.invalid", { headers: { cookie: h.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/project`);
  if (!isAdmin(user)) redirect(`/${lang}/dashboard`);
  return children;
}
