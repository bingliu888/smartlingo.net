import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isPermanentAdmin } from "../../../../lib/admin-access";
import { getSessionUser } from "../../../../lib/auth";
import { interfaceText, isInterfaceLanguage } from "../../../../lib/interface-locale";
import { SMARTLINGO_COURSE_PACKAGES } from "../../../../lib/smartlingo-course-packages";
import "../admin.css";

export const dynamic = "force-dynamic";

export default async function AdminLanguageClasses({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/language-classes`);
  if (!isPermanentAdmin(user)) redirect(`/${lang}/dashboard`);
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  return <main>
    <SiteHeader lang={lang}/>
    <div className="admin-shell" data-layout-page="admin-course-prices" data-layout-fill="admin-shell">
      <div className="admin-toolbar">
        <div>
          <p className="section-kicker">{t("THREE LEVELS · ONE MAX PLAN", "三级课程 · 一个 MAX 方案")}</p>
          <h1>{t("Maintain learning levels, not payment products", "维护学习等级，而不是付款套餐")}</h1>
          <p>{t(
            "Beginner, Intermediate, and Advanced remain separate curriculum levels. An active Max membership opens every level in every supported language.",
            "初级、中级和高级继续作为不同课程等级；有效 Max 会员可学习所有支持语言的全部等级。",
          )}</p>
        </div>
        <a href={`/${lang}/admin`}>← {t("Dashboard", "管理中心")}</a>
      </div>

      <section className="admin-package-grid" aria-label={t("Course levels", "课程等级")}>
        {SMARTLINGO_COURSE_PACKAGES.map(course => {
          return <article className="admin-package-card" key={course.tier}>
            <header>
              <span>{course.level}</span>
              <h2>{t(course.name.en, course.name.zh)}</h2>
            </header>
            <div className="admin-package-terms"><div className="admin-package-term"><strong>{course.tier === "basic" ? t("Free", "免费") : t("7-day trial, then Max", "7 天试用，之后需 Max")}</strong><span>{t("No separate course payment item", "没有独立课程付款项目")}</span><code>{course.tier}</code></div></div>
          </article>;
        })}
      </section>

      <aside className="admin-package-note">
        <strong>{t("Plans", "方案")}: Free + Max</strong>
        <strong>{t("Course payment items", "课程付款项目")}: 0</strong>
        <p>{t(
          "Max is $59 for 6 months or $99 annually, paid once with no automatic renewal. Course level and learning language do not change the Max price.",
          "Max 为 6 个月 $59 或年度 $99，一次性付款且不自动续费；课程等级和学习语言不会改变 Max 价格。",
        )}</p>
      </aside>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
