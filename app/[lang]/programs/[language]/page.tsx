import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CourseClassroomTile } from "../../../../components/CourseClassroomTile";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isAdminUser } from "../../../../lib/admin-access";
import { getDatabase } from "../../../../lib/auth";
import { learningExperienceCopy, learningPathDisplayName } from "../../../../lib/learning-experience-copy";
import { learningUiCopy } from "../../../../lib/learning-ui-copy";
import { interfaceCopyFor, isInterfaceLanguage } from "../../../../lib/interface-locale";
import { ensureSevenDayMaxTrial } from "../../../../lib/platform-entitlements";
import { requestUser } from "../../../../lib/request-user";
import { SMARTLINGO_LANGUAGE_COMMUNITIES, isSmartLingoCommunityLanguage } from "../../../../lib/smartlingo-language-communities";
import "../../../../components/learning-experience.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; language: string }> }): Promise<Metadata> {
  const { language } = await params;
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language);
  return { title: item ? `${item.nativeName} · SmartLingo` : "SmartLingo" };
}

export default async function LanguageHubPage({ params, searchParams }: {
  params: Promise<{ lang: string; language: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { lang, language } = await params;
  if (!isInterfaceLanguage(lang) || !isSmartLingoCommunityLanguage(language)) notFound();
  const item = SMARTLINGO_LANGUAGE_COMMUNITIES.find(candidate => candidate.code === language)!;
  const path = (await searchParams).path === "max" ? "max" : "flash";
  const user = await requestUser();
  if (path === "max" && !user) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/programs/${language}?path=max`)}`);
  const admin = user ? await isAdminUser(user) : false;
  if (path === "max" && user && !admin) await ensureSevenDayMaxTrial(user.id);
  const membership = user ? await getDatabase().prepare(`SELECT c.id FROM smartlingo_language_classes c
    JOIN smartlingo_language_class_members m ON m.class_id=c.id
    WHERE c.target_language=? AND c.class_kind='official_course' AND c.status='open'
      AND m.user_id=? AND m.status='active'
    ORDER BY CASE c.package_tier WHEN 'basic' THEN 1 WHEN 'intermediate' THEN 2 ELSE 3 END LIMIT 1`)
    .bind(language, user.id).first<{ id: string }>() : null;
  const subscription = path === "max" && user ? await getDatabase().prepare(`SELECT cadence,status,trial_ends_at AS trialEndsAt,
    current_period_ends_at AS endsAt,(current_period_ends_at>unixepoch()) AS unexpired
    FROM subscriptions WHERE user_id=? LIMIT 1`)
    .bind(user.id).first<{ cadence: string; status: string; trialEndsAt: number | null; endsAt: number | null; unexpired: number }>() : null;
  const t = learningExperienceCopy[lang];
  const ui = interfaceCopyFor(lang);
  const labels = learningUiCopy[lang];
  const basicClassId = `course_${language}_basic`;
  const activeMax = admin || (subscription?.cadence === "max" && subscription.status === "active" && Boolean(subscription.unexpired));
  const trialMax = !admin && activeMax && Number(subscription?.trialEndsAt || 0) > 0 && Number(subscription?.trialEndsAt || 0) === Number(subscription?.endsAt || 0);
  return <main className="learning-entry-page" data-layout-page="program-detail" data-layout-ready="true" data-layout-overlap-check="program-detail-page" data-layout-fill="program-detail-hero-shell">
    <SiteHeader lang={lang}/>
    <div className="learning-entry-shell">
      <section className="learning-entry-intro">
        <p className="section-kicker">{learningPathDisplayName(lang, path)} · {language.toUpperCase()}</p>
        <h1 dir={item.direction}>{item.nativeName}</h1><p>{t.languageIntro}</p>
        <div className="learning-path-switch"><Link className={path === "flash" ? "active" : ""} href={`/${lang}/programs/${language}?path=flash`}>{learningPathDisplayName(lang, "flash")}</Link><Link className={path === "max" ? "active" : ""} href={`/${lang}/programs/${language}?path=max`}>{learningPathDisplayName(lang, "max")}</Link></div>
      </section>
      {path === "max" && <section className="learning-status-card"><div><strong>{activeMax ? (trialMax ? t.trialStatus : labels.active) : t.trialUsed}</strong><p>{subscription?.endsAt ? `${activeMax ? labels.until : labels.ended} ${new Date(subscription.endsAt * 1000).toLocaleDateString(lang, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" })}` : t.maxBody}</p></div><Link href={`/${lang}/pricing`}>{activeMax ? labels.extend : labels.getMax} →</Link></section>}
      <div className="learning-hub-grid">
        {path === "max" && <article className="learning-hub-card"><h2>{lang === "zh" || lang === "zh-tw" ? "一对一 AI 语言导师" : "1:1 AI language tutor"}</h2><p>{t.maxBody}</p><Link href={`/${lang}/max/tutor?language=${language}`}>{t.continueLearning} →</Link></article>}
        <article className="learning-hub-card"><h2>{ui.play}</h2><p>{t.flashBody}</p><Link href={`/${lang}/play?language=${language}`}>{t.continueLearning} →</Link></article>
        <article className="learning-hub-card"><h2>{ui.everyday}</h2><p>{t.languageIntro}</p><Link href={`/${lang}/play/everyday?language=${language}`}>{t.continueLearning} →</Link></article>
        <article className="learning-hub-card"><h2>SmartCards</h2><p>{t.flashBody}</p><Link href={`/${lang}/smartcards/starter-${language}`}>{t.continueLearning} →</Link></article>
        <article className="learning-hub-card"><h2>{ui.practice}</h2><p>{t.flashBody}</p><Link href={`/${lang}/play/challenge?language=${language}`}>{t.continueLearning} →</Link></article>
        <article className="learning-hub-card"><h2>{labels.findLevel}</h2><p>{t.languageIntro}</p><Link href={`/${lang}/classes/${basicClassId}/placement`}>{t.continueLearning} →</Link></article>
      </div>
      <section className="learning-hub-room"><h2>{labels.webinar}</h2><p>{t.webinarBody}</p>
        {membership ? <CourseClassroomTile classId={membership.id} lang={lang}/>
          : <div className="learning-hub-card"><p>{t.roomSignIn}</p><Link href={user ? `/${lang}/classes/${basicClassId}` : `/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/programs/${language}?path=${path}`)}`}>{t.continueLearning} →</Link></div>}
      </section>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
