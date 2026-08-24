import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CollegeCard } from "../../../../components/CollegeCard";
import { CollegeCoordinatorUpgradeButton } from "../../../../components/CollegeCoordinatorUpgradeButton";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isInterfaceLanguage } from "../../../../lib/interface-locale";
import { requestUser } from "../../../../lib/request-user";
import { canCreateCollege, colleges } from "../../../../lib/smartlingo-colleges";
import { COLLEGE_COORDINATOR_MONTHLY_CENTS } from "../../../../lib/stripe-platform-subscription";

export const dynamic = "force-dynamic";

export default async function MyCollegesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const user = await requestUser();
  if (!user) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/colleges/mine`)}`);

  const [items, coordinator] = await Promise.all([
    colleges({ userId: user.id, mine: true }),
    canCreateCollege(user),
  ]);
  const zh = lang === "zh";

  return <main className="my-colleges-page" data-layout-page="my-colleges">
    <SiteHeader lang={lang}/>
    <section className="my-colleges-hero" data-layout-fill="my-colleges-hero">
      <p className="section-kicker">MY COLLEGES</p>
      <h1>{zh ? "我的学院" : "My colleges"}</h1>
      <p>{zh
        ? "这里汇总您已经加入、订阅或负责管理的学院。学院协调员可以从这里创建学院。"
        : "See colleges you joined, subscribed to, or manage. College Coordinators can create a college here."}</p>
      <div>
        {coordinator ? <Link className="primary-button" href={`/${lang}/college/create`}>
          ＋ {zh ? "创建学院" : "Create college"}
        </Link> : null}
        <Link className="secondary-button" href={`/${lang}/colleges`}>
          {zh ? "浏览学院" : "Browse colleges"}
        </Link>
      </div>
    </section>

    {!coordinator ? <section className="college-coordinator-plan">
      <div>
        <p className="section-kicker">COLLEGE COORDINATOR</p>
        <h2>{zh ? "成为学院协调员" : "Become a College Coordinator"}</h2>
        <p>{zh
          ? "订阅后可以创建学院、自动建立导论课程，并管理学院课程表。课程收入、退款和支付仍遵守独立的课程规则。"
          : "Subscribe to create a college, receive an automatic introductory course, and manage its course table. Course revenue, refunds, and payments remain governed by separate course rules."}</p>
      </div>
      <aside>
        <strong>${(COLLEGE_COORDINATOR_MONTHLY_CENTS / 100).toFixed(0)}</strong>
        <span>{zh ? "美元／月" : "USD / month"}</span>
        <CollegeCoordinatorUpgradeButton lang={lang}/>
      </aside>
    </section> : <section className="college-coordinator-active">
      <strong>{zh ? "学院协调员资格有效" : "College Coordinator active"}</strong>
      <span>{zh ? "您可以创建和管理学院。" : "You can create and manage colleges."}</span>
    </section>}

    <section className="my-colleges-list">
      <header>
        <h2>{zh ? "已加入的学院" : "Your colleges"}</h2>
        <span>{items.length}</span>
      </header>
      <div className="college-card-grid">
        {items.map(college => <CollegeCard key={college.id} college={college} lang={lang}/>)}
      </div>
      {!items.length ? <p className="college-empty">{zh
        ? "您还没有加入学院。可以先浏览学院，或订阅学院协调员方案后创建一个学院。"
        : "You have not joined a college yet. Browse colleges, or subscribe as a College Coordinator to create one."}</p> : null}
    </section>
    <SiteFooter lang={lang}/>
  </main>;
}
