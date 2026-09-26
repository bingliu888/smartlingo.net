import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RoleTutor } from "../../../../components/RoleTutor";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isAdminUser } from "../../../../lib/admin-access";
import { isInterfaceLanguage } from "../../../../lib/interface-locale";
import { ensureSevenDayMaxTrial, hasMaxCourseAccess, hasUsedMaxTrial } from "../../../../lib/platform-entitlements";
import { requestUser } from "../../../../lib/request-user";
import { isSmartLingoCommunityLanguage, SMARTLINGO_LANGUAGE_COMMUNITIES } from "../../../../lib/smartlingo-language-communities";
import "../../assistant/role-tutor/role-tutor.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: `${lang === "zh" ? "旗舰版 AI 语言导师" : "Max AI language tutor"} · SmartLingo` };
}

export default async function OpenTutorPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ language?: string }>;
}) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const user = await requestUser();
  if (!user) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/max/tutor`)}`);
  const query = await searchParams;
  const selected = typeof query.language === "string" && isSmartLingoCommunityLanguage(query.language)
    ? SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === query.language) : null;
  const zh = lang === "zh";
  if (selected && !await isAdminUser(user)) await ensureSevenDayMaxTrial(user.id);
  const max = selected ? await hasMaxCourseAccess(user) : false;
  const trialAvailable = Boolean(selected && !max && !await hasUsedMaxTrial(user.id));
  return <main className="role-tutor-page" data-layout-page="max-tutor"><SiteHeader lang={lang}/><div className="role-tutor-shell">
    <p className="role-tutor-eyebrow">SMARTLINGO · MAX</p>
    <h1>{zh ? "你的 AI 语言导师" : "Your AI language tutor"}</h1>
    <p>{zh ? "不限定场景。先聊你的兴趣与目标，再由导师逐步判断练习起点；计划由你确认后保存。" : "No fixed scene. Talk about your interests and goals; the tutor gradually estimates your practice level, and you confirm any plan before it is saved."}</p>
    {selected ? <RoleTutor mode="open" lang={lang} language={selected.code} role={zh ? "专属 AI 语言导师" : "Your AI language tutor"}
      speechLocale={selected.speechLocale} initialMax={max} trialAvailable={trialAvailable}/>
      : <section className="role-tutor-card"><h2>{zh ? "先选一门练习语言" : "Choose a language to practice"}</h2>
        <div className="role-tutor-language-grid">{SMARTLINGO_LANGUAGE_COMMUNITIES.map(item => <Link key={item.code}
          href={`/${lang}/max/tutor?language=${item.code}`}><strong dir={item.direction}>{item.nativeName}</strong><span>{zh ? item.nameZh : item.nameEn}</span></Link>)}</div>
      </section>}
  </div><SiteFooter lang={lang}/></main>;
}
