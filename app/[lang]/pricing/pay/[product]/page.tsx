import { notFound, redirect } from "next/navigation";
import { PaymentMethodChooser } from "@/components/PaymentMethodChooser";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isInterfaceLanguage, interfaceText, safeInterfaceLanguage } from "@/lib/interface-locale";
import { platformProduct, platformProductTerm } from "@/lib/platform-commerce";
import { requestUser } from "@/lib/request-user";
import { stripeCommerceConfigured } from "@/lib/stripe-runtime";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined, fallback: string) {
  const candidate = String(value || "");
  return /^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(candidate) ? candidate : fallback;
}

export default async function PaymentPage({ params, searchParams }: {
  params: Promise<{ lang: string; product: string }>;
  searchParams: Promise<{ returnTo?: string; checkout?: string; session_id?: string }>;
}) {
  const [{ lang, product: requestedProduct }, query] = await Promise.all([params, searchParams]);
  if (!isInterfaceLanguage(lang)) notFound();
  const locale = safeInterfaceLanguage(lang);
  const product = platformProduct(requestedProduct);
  if (!product) notFound();
  const returnTo = safeReturnTo(query.returnTo, `/${locale}/pricing`);
  const href = `/${locale}/pricing/pay/${product.id}?returnTo=${encodeURIComponent(returnTo)}`;
  if (!await requestUser()) redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(href)}`);
  return <main className="billing-page payment-method-page">
    <SiteHeader lang={locale}/>
    <section className="payment-method-shell">
      <p className="payment-plan-price">{platformProductTerm(product, locale === "zh")} · {product.displayPrice} USD · {interfaceText(locale, "one-time payment", "一次性付款")}</p>
      <PaymentMethodChooser locale={locale} product={product.id} returnTo={returnTo} result={query.checkout} sessionId={query.session_id} cardConfigured={await stripeCommerceConfigured()}/>
    </section>
    <SiteFooter lang={locale}/>
  </main>;
}
