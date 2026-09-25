import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearningLanguageTiles } from "../../../components/LearningLanguageTiles";
import { isAdminUser } from "../../../lib/admin-access";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { getDatabase } from "../../../lib/auth";
import { learningExperienceCopy, learningPathDisplayName } from "../../../lib/learning-experience-copy";
import { memberLearningLanguages } from "../../../lib/learning-experience";
import { learningUiCopy } from "../../../lib/learning-ui-copy";
import { interfaceCopyFor, isInterfaceLanguage } from "../../../lib/interface-locale";
import { ensureSevenDayMaxTrial } from "../../../lib/platform-entitlements";
import { requestUser } from "../../../lib/request-user";
import "../../../components/learning-experience.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: `${isInterfaceLanguage(lang) ? learningPathDisplayName(lang, "max") : "Max"} · SmartLingo` };
}

export default async function MaxPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const user = await requestUser();
  if (!user) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/max`)}`);
  const admin = await isAdminUser(user);
  // Arriving at Max after sign-in is the member's explicit choice to start this
  // one-time trial. Repeated visits cannot restart it or extend paid access.
  if (!admin) await ensureSevenDayMaxTrial(user.id);
  const languages = await memberLearningLanguages(user.id);
  const t = learningExperienceCopy[lang];
  const ui = interfaceCopyFor(lang);
  const labels = learningUiCopy[lang];
  const subscription = await getDatabase().prepare("SELECT cadence,status,trial_ends_at AS trialEndsAt,current_period_ends_at AS endsAt,(current_period_ends_at>unixepoch()) AS unexpired FROM subscriptions WHERE user_id=? LIMIT 1")
    .bind(user.id).first<{ cadence: string; status: string; trialEndsAt: number | null; endsAt: number | null; unexpired: number }>();
  const active = admin || (subscription?.cadence === "max" && subscription.status === "active" && Boolean(subscription.unexpired));
  const isTrial = !admin && active && Number(subscription?.trialEndsAt || 0) > 0 && Number(subscription?.trialEndsAt || 0) === Number(subscription?.endsAt || 0);
  const expires = subscription?.endsAt ? new Date(subscription.endsAt * 1000).toLocaleDateString(lang, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }) : null;
  return <main className="learning-entry-page" data-layout-page="max" data-layout-ready="true" data-layout-overlap-check="max-page">
    <SiteHeader lang={lang}/>
    <div className="learning-entry-shell">
      <section className="learning-entry-intro"><p className="section-kicker">SMARTLINGO · {learningPathDisplayName(lang, "max")}</p><h1>{learningPathDisplayName(lang, "max")}</h1><p>{t.maxBody}</p></section>
      <section className="learning-status-card" aria-live="polite"><div><strong>{active ? (isTrial ? t.trialStatus : labels.active) : t.trialUsed}</strong><p>{expires ? `${active ? labels.until : labels.ended} ${expires}` : t.maxBody}</p></div><Link href={`/${lang}/pricing`}>{active ? labels.extend : labels.getMax} →</Link></section>
      <LearningLanguageTiles lang={lang} path="max" initialLanguages={languages} signedIn/>
      <div className="learning-hub-grid">
        <article className="learning-hub-card"><h2>{ui.askGuru}</h2><p>{t.maxBody}</p><Link href={`/${lang}/assistant/role-tutor`}>{t.continueLearning} →</Link></article>
        <article className="learning-hub-card"><h2>{ui.everyday}</h2><p>{t.languageIntro}</p><Link href={`/${lang}/play/everyday`}>{t.continueLearning} →</Link></article>
      </div>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
