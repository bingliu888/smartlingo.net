import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { ProfileEditor } from "../../../components/ProfileEditor";
import { PasswordSettings } from "../../../components/PasswordSettings";
import { getDatabase, getSessionUser } from "../../../lib/auth";
import "../../profile-fixes.css";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") || "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/account`);
  const zh = lang === "zh";
  const introducer = await getDatabase().prepare("SELECT owner.display_name AS displayName, r.status AS status FROM referrals r JOIN referral_codes rc ON rc.id = r.referral_code_id JOIN users owner ON owner.id = rc.user_id WHERE r.referred_user_id = ? LIMIT 1").bind(user.id).first<{ displayName: string; status: string }>();
  const avatar = await getDatabase().prepare("SELECT user_id AS userId FROM user_avatars WHERE user_id = ?").bind(user.id).first<{ userId: string }>();
  return <main className="account-settings-page"><SiteHeader lang={lang}/><section className="account-settings-main"><p className="section-kicker">{zh ? "个人资料" : "MEMBER PROFILE"}</p><h1>{zh ? "管理您的 SmartLingo 个人资料。" : "Manage your SmartLingo profile."}</h1><p className="account-settings-intro">{zh ? "更新头像、显示名称、默认文本模型、平台介绍关系与阅读偏好，并快速进入课程和消息。图片理解、图片生成与实时语音由各自的专用模型处理。" : "Update your photo, display name, default text model, platform introducer relationship, and reading preferences, then open courses and messages. Image understanding, image generation, and live audio use their own specialized models."}</p><ProfileEditor lang={lang} email={user.email} initialName={user.displayName} initialAiProviderPreference={user.aiProviderPreference} initialIntroducer={introducer ?? null} initialImageUrl={avatar ? `/api/profile?avatar=${encodeURIComponent(user.id)}` : ""}/><div className="account-settings-grid account-secondary"><article><h2>{zh ? "学习与课程" : "Learning and courses"}</h2><div className="account-settings-links"><Link href={`/${lang}/dashboard`}>{zh ? "打开用户面板" : "Open dashboard"} →</Link><Link href={`/${lang}/classes?mine=1`}>{zh ? "查看我的课程" : "Open my courses"} →</Link><Link href={`/${lang}/programs`}>{zh ? "选择课程" : "Choose course"} →</Link><Link href={`/${lang}/messages`}>{zh ? "查看消息与实时聊天" : "Open messages and live chat"} →</Link></div></article><article><PasswordSettings lang={lang}/></article></div></section><SiteFooter lang={lang}/></main>;
}
