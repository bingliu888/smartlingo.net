import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { LogoutButton } from "../../../components/LogoutButton";
import { MembershipPanel } from "../../../components/MembershipPanel";
import { TextSizeControl } from "../../../components/TextSizeControl";
import { getSessionUser } from "../../../lib/auth";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import "./dashboard-tuneup.css";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    welcome: "Welcome to your member dashboard",
    subtitle: "Manage your language path, classes, platform-subscription referrals, Community, and conversations from one place.",
    progress: "Class journey",
    level: "SmartLingo · Member dashboard",
    next: "Enter your first class",
    nextBody: "Browse approved courses, join a class, or return to a class already in progress.",
    action: "Open my classes",
    account: "Account",
    language: "Interface language",
    signOut: "Sign out",
    voiceKicker: "ASK GURU BY VOICE",
    voiceTitle: "Practice a useful conversation hands-free",
    voiceBody: "Open Ask Guru, tap the microphone and speak. Your words appear in the message box for you to review before sending.",
    voiceAction: "Live Audio AI Chat",
    coming: "Three platform plans, with class creation open to every member",
    comingBody: "Free members can learn and create a private class. Plus adds deeper practice and live audio. Coordinator adds richer class operations without turning class creation into a paid gate.",
  },
  zh: {
    welcome: "欢迎进入您的用户面板",
    subtitle: "从这里统一管理语言路径、班级、平台订阅推荐、社区与会话。",
    progress: "班级进度",
    level: "SmartLingo · 用户面板",
    next: "进入您的第一个班级",
    nextBody: "浏览已批准课程、加入班级，或继续已经开始的班级。",
    action: "打开我的班级",
    account: "账户",
    language: "界面语言",
    signOut: "退出登录",
    voiceKicker: "语音咨询智能导师",
    voiceTitle: "随时开口练习一段实用会话",
    voiceBody: "打开智能导师页面后点击麦克风并开始说话。语音会转成文字，您可以确认内容后再发送。",
    voiceAction: "实时智能语音对话",
    coming: "三种平台方案，每位会员都能开班",
    comingBody: "免费会员即可学习并创建私有班级；进阶方案增加深入训练与实时语音；协调员方案增加班级运营能力，但不会把开班资格变成付费门槛。",
  },
};

export default async function Dashboard({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const requestHeaders = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login`);
  const t = copy[lang];
  return (
    <main className="dashboard-page">
      <SiteHeader lang={lang} />
      <div className="dashboard-wrap">
        <div className="dashboard-title"><p className="section-kicker">{t.level}</p><h1>{t.welcome}, {user.displayName}.</h1><p>{t.subtitle}</p></div>
        <section className="dashboard-voice-panel">
          <span className="dashboard-voice-icon" aria-hidden="true" />
          <div><p className="section-kicker">{t.voiceKicker}</p><h2>{t.voiceTitle}</h2><p>{t.voiceBody}</p></div>
          <a className="dashboard-voice-cta" href={`/${lang}/assistant`}>{t.voiceAction} <span aria-hidden="true">→</span></a>
        </section>
        <MembershipPanel lang={lang} />
        <div className="dashboard-grid">
          <section className="progress-card"><div className="card-top"><span>{t.progress}</span><strong>{lang === "zh" ? "开始" : "START"}</strong></div><div className="progress-track"><i style={{ width: "0%" }} /></div><div className="lesson-preview"><span>语</span><div><h2>{t.next}</h2><p>{t.nextBody}</p><a className="primary-button" href={`/${lang}/classes?mine=1`}>{t.action} <span>→</span></a></div></div></section>
          <aside className="account-card" id="account"><h2>{t.account}</h2><dl><div><dt>{lang === "zh" ? "邮箱" : "Email"}</dt><dd>{user.email}</dd></div><div><dt>{t.language}</dt><dd>{lang === "zh" ? "中文" : "English"}</dd></div></dl><TextSizeControl lang={lang} /><LogoutButton lang={lang} label={t.signOut} /></aside>
          <section className="coming-card"><div className="mini-table gc-mini-network" aria-hidden="true"><span>{lang === "zh" ? "免费" : "FREE"}</span><span>{lang === "zh" ? "进阶" : "PLUS"}</span><i>{lang === "zh" ? "协调" : "COORD"}</i><span>{lang === "zh" ? "开班" : "CLASS"}</span><span>{lang === "zh" ? "社区" : "SOCIAL"}</span></div><div><p className="section-kicker">{lang === "zh" ? "平台方案" : "PLATFORM PLANS"}</p><h2>{t.coming}</h2><p>{t.comingBody}</p></div></section>
        </div>
      </div>
      <SiteFooter lang={lang} />
    </main>
  );
}
