import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearningLanguageTiles } from "../../../components/LearningLanguageTiles";
import { LogoutButton } from "../../../components/LogoutButton";
import { MembershipPanel } from "../../../components/MembershipPanel";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { TextSizeControl } from "../../../components/TextSizeControl";
import { isAdminUser } from "../../../lib/admin-access";
import { getDatabase } from "../../../lib/auth";
import { learningExperienceCopy, learningPathDisplayName } from "../../../lib/learning-experience-copy";
import { memberLearningLanguages } from "../../../lib/learning-experience";
import { learningUiCopy } from "../../../lib/learning-ui-copy";
import { interfaceCopyFor, isInterfaceLanguage } from "../../../lib/interface-locale";
import { requestUser } from "../../../lib/request-user";
import "../../../components/learning-experience.css";

export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const user = await requestUser();
  if (!user) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/dashboard`)}`);
  const [languages, subscription, admin] = await Promise.all([
    memberLearningLanguages(user.id),
    getDatabase().prepare("SELECT cadence,status,trial_ends_at AS trialEndsAt,current_period_ends_at AS endsAt,(current_period_ends_at>unixepoch()) AS unexpired FROM subscriptions WHERE user_id=? LIMIT 1")
      .bind(user.id).first<{ cadence: string; status: string; trialEndsAt: number | null; endsAt: number | null; unexpired: number }>(),
    isAdminUser(user),
  ]);
  const t = learningExperienceCopy[lang];
  const ui = interfaceCopyFor(lang);
  const labels = learningUiCopy[lang];
  const active = admin || (subscription?.cadence === "max" && subscription.status === "active" && Boolean(subscription.unexpired));
  const expires = subscription?.endsAt ? new Date(subscription.endsAt * 1000).toLocaleDateString(lang, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }) : null;
  const isTrial = !admin && active && Number(subscription?.trialEndsAt || 0) > 0 && Number(subscription?.trialEndsAt || 0) === Number(subscription?.endsAt || 0);
  return <main className="learning-entry-page" data-layout-page="dashboard" data-layout-ready="true" data-layout-overlap-check="dashboard-page">
    <SiteHeader lang={lang}/>
    <div className="learning-entry-shell">
      <section className="learning-entry-intro"><p className="section-kicker">SMARTLINGO · DASHBOARD</p><h1>{user.displayName}</h1><p>{t.homeIntro}</p></section>
      <section className="learning-status-card" aria-label={learningPathDisplayName(lang, "max")}>
        <div><strong>{active ? (isTrial ? t.trialStatus : labels.active) : labels.inactive}</strong><p>{expires ? `${active ? labels.until : labels.ended} ${expires}` : t.maxBody}</p></div>
        <Link href={`/${lang}/pricing`}>{active ? labels.extend : labels.getMax} →</Link>
      </section>
      <div className="learning-dashboard-paths">
        <section aria-label={learningPathDisplayName(lang, "max")}><div className="learning-dashboard-heading"><h2>{learningPathDisplayName(lang, "max")}</h2><Link href={`/${lang}/max`}>{t.continueLearning} →</Link></div><LearningLanguageTiles lang={lang} path="max" initialLanguages={languages} signedIn/></section>
        <section aria-label={learningPathDisplayName(lang, "flash")}><div className="learning-dashboard-heading"><h2>{learningPathDisplayName(lang, "flash")}</h2><Link href={`/${lang}/flash`}>{t.continueLearning} →</Link></div><LearningLanguageTiles lang={lang} path="flash"/></section>
      </div>
      <div className="learning-hub-grid">
        <article className="learning-hub-card"><h2>{ui.askGuru}</h2><p>{t.guruBody}</p><Link href={`/${lang}/assistant`}>{ui.askGuru} →</Link></article>
        <article className="learning-hub-card"><h2>{ui.community}</h2><p>{t.webinarBody}</p><Link href={`/${lang}/community`}>{t.continueLearning} →</Link></article>
      </div>
      <details className="learning-dashboard-more"><summary>{ui.account}</summary><MembershipPanel lang={lang}/><div className="learning-dashboard-account"><Link href={`/${lang}/score-history`}>{labels.score}</Link><Link href={`/${lang}/certificates`}>{labels.certificates}</Link><TextSizeControl lang={lang}/><LogoutButton lang={lang} label={labels.signOut}/></div></details>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
