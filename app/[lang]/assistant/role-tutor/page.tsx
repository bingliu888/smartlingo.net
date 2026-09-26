import { notFound } from "next/navigation";
import { RoleTutor } from "../../../../components/RoleTutor";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { hasMaxCourseAccess, hasUsedMaxTrial } from "../../../../lib/platform-entitlements";
import { requestUser } from "../../../../lib/request-user";
import { resolveRoleTutorMission } from "../../../../lib/smartlingo-role-tutor";
import "./role-tutor.css";

export const dynamic = "force-dynamic";

export default async function RoleTutorPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ scene?: string; language?: string; level?: string }>;
}) {
  if (process.env.SMARTLINGO_ROLE_TUTOR_ENABLED === "0") notFound();
  const { lang } = await params;
  if (lang !== "zh" && lang !== "en" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query = await searchParams;
  const mission = resolveRoleTutorMission({ ...query, uiLanguage: lang === "zh" ? "zh" : "en" });
  if (!mission) notFound();
  const user = await requestUser();
  const max = await hasMaxCourseAccess(user);
  const trialAvailable = Boolean(user && !max && !await hasUsedMaxTrial(user.id));
  const zh = lang === "zh";
  return <main className="role-tutor-page"><SiteHeader lang={lang}/><div className="role-tutor-shell">
    <p className="role-tutor-eyebrow">{zh ? "MAX · 场景角色练习" : "MAX · SCENE ROLE-PLAY"}</p>
    <h1>{zh ? mission.scene.nameZh : mission.scene.nameEn}</h1>
    <p>{zh ? mission.scene.goalZh : mission.scene.goalEn} · {mission.language.nativeName} · {mission.level}</p>
    {!user ? <p><a href={`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/assistant/role-tutor?scene=${mission.scene.id}&language=${mission.language.code}&level=${mission.level}`)}`}>{zh ? "请先登录，再查看旗舰版导师。" : "Sign in to access the Max tutor."}</a></p>
      : <RoleTutor lang={lang} language={mission.language.code} scene={mission.scene.id} level={mission.level} role={mission.role} sceneVisual={mission.scene.motionMedia[0]} initialMax={max} trialAvailable={trialAvailable} speechLocale={mission.language.speechLocale}/>}
  </div><SiteFooter lang={lang}/></main>;
}
