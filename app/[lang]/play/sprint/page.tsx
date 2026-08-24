import { notFound } from "next/navigation";
import { DailySprintSetup } from "../../../../components/DailySprintSetup";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isInterfaceLanguage } from "../../../../lib/interface-locale";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: lang === "zh" ? "今日速成" : "Today’s Sprint" };
}

export default async function DailySprintSetupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  return <main className="sprint-setup-page" data-layout-page="sprint-setup"><SiteHeader lang={lang}/><DailySprintSetup lang={lang}/><SiteFooter lang={lang}/></main>;
}
