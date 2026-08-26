import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AdminCryptoSettings from "../../../../components/AdminCryptoSettings";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { SmartPayAdminConsole } from "../../../../components/SmartPayAdminConsole";
import { isPermanentAdmin } from "../../../../lib/admin-access";
import { getDatabase, getSessionUser } from "../../../../lib/auth";
import { allCryptoPaymentSettings } from "../../../../lib/crypto-payments";
import { interfaceText, isInterfaceLanguage } from "../../../../lib/interface-locale";

export const dynamic = "force-dynamic";

export default async function CryptoPaymentsAdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", {
    headers: { cookie: incoming.get("cookie") || "" },
  }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/crypto-payments`);
  if (!isPermanentAdmin(user)) redirect(`/${lang}/dashboard`);
  const [settings, wallet] = await Promise.all([
    allCryptoPaymentSettings(),
    getDatabase().prepare("SELECT wallet_address AS wallet FROM users WHERE id=? LIMIT 1")
      .bind(user.id).first<{ wallet: string | null }>(),
  ]);
  return <main className="dashboard-page smartpay-admin-page">
    <SiteHeader lang={lang}/>
    <section className="account-settings-main">
      <p className="section-kicker">SMARTPAY3 CONTROL</p>
      <h1>{interfaceText(lang, "Crypto payments", "加密货币付款")}</h1>
      <p className="account-settings-intro">{interfaceText(
        lang,
        "Maintain this site's tokens and annual course prices, then deploy or import its independent contract and manage its Owner, W1–W5, payment rules, withdrawals, and course-payment reconciliation.",
        "先维护本站代币与课程年费，再部署或导入本站独立合约，并管理 Owner、W1–W5、付款规则、提款和课程付款核对。",
      )}</p>
      <AdminCryptoSettings lang={lang === "zh" ? "zh" : "en"}/>
      <SmartPayAdminConsole initialSettings={settings} locale={lang} defaultWallet={wallet?.wallet || ""}/>
    </section>
    <SiteFooter lang={lang}/>
  </main>;
}
