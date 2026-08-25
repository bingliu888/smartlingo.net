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

    <section className="college-two-level-model" aria-labelledby="college-two-level-title">
      <header><p className="section-kicker">TWO-LEVEL LEARNING SCHOOL</p><h2 id="college-two-level-title">{zh ? "两层组织，平台统一教学质量" : "Two levels, one platform quality standard"}</h2></header>
      <div>
        <article><span>01</span><h3>{zh ? "学院／学校" : "College / school"}</h3><p>{zh ? "学院总监负责招生、品牌和部门管理；黄金、白金、钻石方案分别支持 3、9、15 个语言部门。" : "A College Supervisor manages enrollment, identity, and departments; Gold, Platinum, and Diamond support 3, 9, or 15 language departments."}</p></article>
        <article><span>02</span><h3>{zh ? "语言部门／课程组" : "Language department / course group"}</h3><p>{zh ? "每个部门选择教学语言与学习语言后，自动获得平台管理员课程、今日速成、生活口语、智慧卡、智慧卡挑战和默认音频学习房间。" : "After selecting interface and target languages, each department automatically receives admin-created courses, Today’s Sprint, Everyday Speaking, Smart Cards, Smart Card Challenge, and an audio-first learning room."}</p></article>
      </div>
      <p>{zh ? "课程价格仍由平台管理员统一制定；符合条件的部门课程收入按 70% 给学院／部门、30% 给平台。" : "Course prices remain platform-admin controlled; eligible department course revenue is split 70% to the college/department and 30% to the platform."}</p>
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
