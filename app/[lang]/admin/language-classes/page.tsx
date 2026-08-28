import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isPermanentAdmin } from "../../../../lib/admin-access";
import { getSessionUser } from "../../../../lib/auth";
import { interfaceText, isInterfaceLanguage } from "../../../../lib/interface-locale";
import {
  courseSubscriptionMainId,
  SMARTLINGO_COURSE_PACKAGES,
  SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES,
} from "../../../../lib/smartlingo-course-packages";
import "../admin.css";

export const dynamic = "force-dynamic";

const usd = (priceCents: number) => `$${(priceCents / 100).toLocaleString("en-US")}`;

export default async function AdminLanguageClasses({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/language-classes`);
  if (!isPermanentAdmin(user)) redirect(`/${lang}/dashboard`);
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const monthsLabel = t("months", "个月");

  return <main>
    <SiteHeader lang={lang}/>
    <div className="admin-shell" data-layout-page="admin-course-prices" data-layout-fill="admin-shell">
      <div className="admin-toolbar">
        <div>
          <p className="section-kicker">{t("Nine packages. No automatic renewal.", "九个套餐，不自动续费。")}</p>
          <h1>{t("Choose a level and access period", "选择等级和学习期限")}</h1>
          <p>{t(
            "Choose the learning language first, then one of three levels and 3, 6, or 12 months. The same course has the same price in every language.",
            "先选择学习语言，再选择三个等级之一和 3、6 或 12 个月。同一等级在所有语言中价格相同。",
          )}</p>
        </div>
        <a href={`/${lang}/admin`}>← {t("Dashboard", "管理中心")}</a>
      </div>

      <section className="admin-package-grid" aria-label={t("Choose a level and access period", "选择等级和学习期限")}>
        {SMARTLINGO_COURSE_PACKAGES.map(course => {
          const packages = SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES.filter(item => item.tier === course.tier);
          return <article className="admin-package-card" key={course.tier}>
            <header>
              <span>{course.level}</span>
              <h2>{t(course.name.en, course.name.zh)}</h2>
            </header>
            <div className="admin-package-terms">
              {packages.map(item => <div className="admin-package-term" data-price-product-id={item.id} key={item.id}>
                <div>
                  <strong>{item.months} {monthsLabel}</strong>
                  <b>{usd(item.priceCents)} USD</b>
                </div>
                <span>{t("Card payment", "银行卡付款")}</span>
                {item.months === 3
                  ? <span className="admin-crypto-badge">Polygon · USDT / GLC</span>
                  : null}
                <code>{courseSubscriptionMainId(item.tier, item.months)}</code>
              </div>)}
            </div>
          </article>;
        })}
      </section>

      <aside className="admin-package-note">
        <strong>{t("Card payment", "银行卡付款")}: 9</strong>
        <strong>Polygon USDT / GLC: 3</strong>
        <p>{t(
          "Pay once for 3, 6, or 12 months. There is no automatic renewal. Polygon USDT and GLC are available only for three-month packages.",
          "一次支付 3、6 或 12 个月，不自动续费。Polygon USDT 与 GLC 只适用于三个 3 个月套餐。",
        )}</p>
      </aside>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
