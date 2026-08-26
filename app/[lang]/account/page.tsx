import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { ProfileEditor } from "../../../components/ProfileEditor";
import { PasswordSettings } from "../../../components/PasswordSettings";
import { getDatabase, getSessionUser } from "../../../lib/auth";
import { interfaceText, isInterfaceLanguage } from "../../../lib/interface-locale";
import "../../profile-fixes.css";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") || "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/account`);
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const introducer = await getDatabase()
    .prepare("SELECT owner.display_name AS displayName, r.status AS status FROM referrals r JOIN referral_codes rc ON rc.id = r.referral_code_id JOIN users owner ON owner.id = rc.user_id WHERE r.referred_user_id = ? LIMIT 1")
    .bind(user.id)
    .first<{ displayName: string; status: string }>();
  const avatar = await getDatabase()
    .prepare("SELECT user_id AS userId FROM user_avatars WHERE user_id = ?")
    .bind(user.id)
    .first<{ userId: string }>();

  return <main className="account-settings-page" dir={lang === "ar" ? "rtl" : "ltr"}>
    <SiteHeader lang={lang}/>
    <section className="account-settings-main">
      <p className="section-kicker">{t("MEMBER PROFILE", "个人资料")}</p>
      <h1>{t("Manage your SmartLingo profile.", "管理您的 SmartLingo 个人资料。")}</h1>
      <p className="account-settings-intro">{t(
        "Update your photo, display name, default text model, platform introducer relationship, and reading preferences, then open courses and messages. Image understanding, image generation, and live audio use their own specialized models.",
        "更新头像、显示名称、默认文本模型、平台介绍关系与阅读偏好，并快速进入课程和消息。图片理解、图片生成与实时语音由各自的专用模型处理。",
      )}</p>
      <ProfileEditor
        lang={lang}
        email={user.email}
        initialName={user.displayName}
        initialAiProviderPreference={user.aiProviderPreference}
        initialIntroducer={introducer ?? null}
        initialImageUrl={avatar ? `/api/profile?avatar=${encodeURIComponent(user.id)}` : ""}
      />
      <div className="account-settings-grid account-secondary">
        <article>
          <h2>{t("Learning and courses", "学习与课程")}</h2>
          <div className="account-settings-links">
            <Link href={`/${lang}/dashboard`}>{t("Open dashboard", "打开用户面板")} →</Link>
            <Link href={`/${lang}/classes?mine=1`}>{t("Open my courses", "查看我的课程")} →</Link>
            <Link href={`/${lang}/programs`}>{t("Choose course", "选择课程")} →</Link>
            <Link href={`/${lang}/messages`}>{t("Open messages and live chat", "查看消息与实时聊天")} →</Link>
          </div>
        </article>
        <article><PasswordSettings lang={lang}/></article>
      </div>
    </section>
    <SiteFooter lang={lang}/>
  </main>;
}
