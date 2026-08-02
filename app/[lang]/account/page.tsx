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
  return <main className="account-settings-page"><SiteHeader lang={lang}/><section className="account-settings-main"><p className="section-kicker">{zh ? "个人资料" : "MEMBER PROFILE"}</p><h1>{zh ? "管理您的 SmartLingo 个人资料。" : "Manage your SmartLingo profile."}</h1><p className="account-settings-intro">{zh ? "更新头像、显示名称、平台介绍关系与阅读偏好，并快速进入语言路径、班级、消息和社区。" : "Update your photo, display name, platform introducer relationship, and reading preferences, then open language paths, classes, messages, and Community."}</p><ProfileEditor lang={lang} email={user.email} initialName={user.displayName} initialIntroducer={introducer ?? null} initialImageUrl={avatar ? `/api/profile?avatar=${encodeURIComponent(user.id)}` : ""}/><div className="account-settings-grid account-secondary"><article><h2>{zh ? "学习与班级" : "Learning and classes"}</h2><div className="account-settings-links"><Link href={`/${lang}/dashboard`}>{zh ? "打开用户面板" : "Open dashboard"} →</Link><Link href={`/${lang}/classes?mine=1`}>{zh ? "查看我的班级" : "Open my classes"} →</Link><Link href={`/${lang}/programs`}>{zh ? "浏览语言路径" : "Browse language paths"} →</Link><Link href={`/${lang}/messages`}>{zh ? "查看消息与实时聊天" : "Open messages and live chat"} →</Link><Link href={`/${lang}/community`}>{zh ? "进入 SmartLingo 社区" : "Open SmartLingo Community"} →</Link></div></article><article><PasswordSettings lang={lang}/></article></div></section><SiteFooter lang={lang}/></main>;
}
