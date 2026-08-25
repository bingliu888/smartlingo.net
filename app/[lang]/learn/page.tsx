import { redirect } from "next/navigation";
import { isInterfaceLanguage } from "../../../lib/interface-locale";
import { requestUser } from "../../../lib/request-user";

export default async function LearnEntryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) redirect("/en/learn");
  const user = await requestUser();
  redirect(user ? `/${lang}/dashboard` : `/${lang}/play`);
}
