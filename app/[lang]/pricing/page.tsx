import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PlatformPlans } from "@/components/PlatformPlans";
import { isInterfaceLanguage, safeInterfaceLanguage } from "@/lib/interface-locale";

export default async function PricingPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ checkout?: string; session_id?: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const locale = safeInterfaceLanguage(lang);
  const query = await searchParams;
  return <main className="billing-page platform-pricing-page"><SiteHeader lang={locale}/><PlatformPlans lang={locale} checkout={query.checkout} sessionId={query.session_id}/><SiteFooter lang={locale}/></main>;
}
