import { notFound } from "next/navigation";
import { CryptoCheckout } from "@/components/CryptoCheckout";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isInterfaceLanguage, safeInterfaceLanguage } from "@/lib/interface-locale";
import { platformProduct } from "@/lib/platform-commerce";

export default async function CryptoPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ product?: string }> }) {
  const { lang } = await params;
  const product = platformProduct((await searchParams).product);
  if (!isInterfaceLanguage(lang) || !product) notFound();
  const locale = safeInterfaceLanguage(lang);
  return <main className="billing-page"><SiteHeader lang={locale}/><CryptoCheckout lang={locale} initialPlan={product.id} initialLanguageCode="platform" commerceScope="platform"/><SiteFooter lang={locale}/></main>;
}
