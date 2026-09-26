import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MaxVoiceTutor } from "../../../../components/MaxVoiceTutor";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isAdminUser } from "../../../../lib/admin-access";
import { isInterfaceLanguage } from "../../../../lib/interface-locale";
import { memberLearningLanguages } from "../../../../lib/learning-experience";
import { tutorLearningLanguage } from "../../../../lib/learning-language-codes";
import { ensureSevenDayMaxTrial, hasMaxCourseAccess, hasUsedMaxTrial } from "../../../../lib/platform-entitlements";
import { requestUser } from "../../../../lib/request-user";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../../../../lib/smartlingo-language-communities";
import "../../assistant/role-tutor/role-tutor.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: `${lang === "zh" || lang === "zh-tw" ? "旗舰版 AI 语言导师" : "Max AI language tutor"} · SmartLingo` };
}

export default async function OpenTutorPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ language?: string }>;
}) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const query = await searchParams;
  const user = await requestUser();
  if (!user) {
    const selectedLanguage = tutorLearningLanguage(query.language, []);
    const returnTo = `/${lang}/max/tutor${selectedLanguage ? `?language=${selectedLanguage}` : ""}`;
    redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  const joined = await memberLearningLanguages(user.id);
  const learningLanguage = tutorLearningLanguage(query.language, joined);
  const selected = learningLanguage
    ? SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === learningLanguage) : null;
  const zh = lang === "zh" || lang === "zh-tw";
  if (selected && !await isAdminUser(user)) await ensureSevenDayMaxTrial(user.id);
  const max = selected ? await hasMaxCourseAccess(user) : false;
  const trialAvailable = Boolean(selected && !max && !await hasUsedMaxTrial(user.id));
  return <main className="role-tutor-page" data-layout-page="max-tutor" data-layout-ready="true"><SiteHeader lang={lang}/><div className={`role-tutor-shell${selected ? " teacher-ready" : ""}`}>
    {selected ? <h1 className="max-live-tutor-sr-only">{zh ? "选择你的 AI 语言导师" : "Choose your AI language tutor"}</h1> : <>
      <p className="role-tutor-eyebrow">SMARTLINGO · MAX</p>
      <h1>{zh ? "选择一门学习语言" : "Choose a learning language"}</h1>
    </>}
    {selected ? <MaxVoiceTutor lang={lang} language={selected.code} initialMax={max} trialAvailable={trialAvailable}/>
      : <section className="role-tutor-card"><h2>{zh ? "先选一门练习语言" : "Choose a language to practice"}</h2>
        <div className="role-tutor-language-grid">{SMARTLINGO_LANGUAGE_COMMUNITIES.map(item => <Link key={item.code}
          href={`/${lang}/max/tutor?language=${item.code}`}><strong dir={item.direction}>{item.nativeName}</strong><span>{zh ? item.nameZh : item.nameEn}</span></Link>)}</div>
      </section>}
  </div><SiteFooter lang={lang}/></main>;
}
