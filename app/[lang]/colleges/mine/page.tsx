import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CollegeCard } from "../../../../components/CollegeCard";
import { CollegeCoordinatorUpgradeButton } from "../../../../components/CollegeCoordinatorUpgradeButton";
import { CollegePayoutOnboardingButton } from "../../../../components/CollegePayoutOnboardingButton";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isInterfaceLanguage } from "../../../../lib/interface-locale";
import { requestUser } from "../../../../lib/request-user";
import { canCreateCollege, colleges } from "../../../../lib/smartlingo-colleges";
import { supervisorLicense } from "../../../../lib/college-departments";

export const dynamic = "force-dynamic";

export default async function MyCollegesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const user = await requestUser();
  if (!user) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/colleges/mine`)}`);

  const [items, coordinator, license] = await Promise.all([
    colleges({ userId: user.id, mine: true }),
    canCreateCollege(user),
    supervisorLicense(user.id),
  ]);
  const zh = lang === "zh";

  return <main className="my-colleges-page" data-layout-page="my-colleges">
    <SiteHeader lang={lang}/>
    <section className="my-colleges-hero" data-layout-fill="my-colleges-hero">
      <p className="section-kicker">MY COLLEGES</p>
      <h1>{zh ? "我的学院" : "My colleges"}</h1>
      <p>{zh
        ? "这里汇总您已经加入、订阅或负责管理的学院。学院总监可以创建招生学院与语言部门。"
        : "See colleges you joined, subscribed to, or manage. College Supervisors can create enrollment colleges and language departments."}</p>
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
        <p className="section-kicker">COLLEGE SUPERVISOR</p>
        <h2>{zh ? "成为学院总监" : "Become a College Supervisor"}</h2>
        <p>{zh
          ? "一次性购买黄金、白金或钻石总监方案，可分别管理 3、9 或 15 个语言部门。课程由平台管理员创建和定价；部门课程收入按 70%／30% 自动分账。"
          : "Buy Gold, Platinum, or Diamond once to manage 3, 9, or 15 language departments. Courses and prices remain admin-controlled; department course revenue splits 70/30 automatically."}</p>
      </div>
      <CollegeCoordinatorUpgradeButton lang={lang}/>
    </section> : <section className="college-coordinator-active">
      <strong>{zh ? "学院总监资格有效" : "College Supervisor active"}</strong>
      <span>{license?`${zh?"已使用":"Used"} ${license.departmentCount} / ${license.maxDepartments} ${zh?"个部门":"departments"}`:""}</span>
      <CollegePayoutOnboardingButton lang={lang}/>
      {license?.tier!=="supreme"?<CollegeCoordinatorUpgradeButton lang={lang} currentTier={license?.tier}/>:null}
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
        ? "您还没有加入学院。可以先浏览学院，或购买学院总监方案后创建一个学院。"
        : "You have not joined a college yet. Browse colleges, or buy a College Supervisor package to create one."}</p> : null}
    </section>
    <SiteFooter lang={lang}/>
  </main>;
}
