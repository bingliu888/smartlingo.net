import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { LogoutButton } from "../../../components/LogoutButton";
import { MembershipPanel } from "../../../components/MembershipPanel";
import { TextSizeControl } from "../../../components/TextSizeControl";
import { getDatabase, getSessionUser } from "../../../lib/auth";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { DashboardLearningHub, type DashboardJoinedCourse } from "../../../components/DashboardLearningHub";
import "./dashboard-tuneup.css";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    welcome: "Welcome to your member dashboard",
    subtitle: "Manage your language path, courses, platform-subscription referrals, Community, and conversations from one place.",
    progress: "Course journey",
    level: "SmartLingo · Member dashboard",
    next: "Enter your first course",
    nextBody: "Browse approved courses, join a course, or return to a course already in progress.",
    action: "Open my courses",
    account: "Account",
    language: "Interface language",
    signOut: "Sign out",
    voiceKicker: "ASK GURU BY VOICE",
    voiceTitle: "Practice a useful conversation hands-free",
    voiceBody: "Open Ask Guru, tap the microphone and speak. Your words appear in the message box for you to review before sending.",
    voiceAction: "Live Audio AI Chat",
    coming: "Three platform plans, with course creation open to every member",
    comingBody: "Choose a Beginner, Intermediate, or Advanced language course. Every course starts with a free month and includes an A/V webinar classroom.",
    certs: "Certificates",
    certsBody: "Passed SmartLingo courses appear here with your final score and issue date.",
    certsAction: "View certificates",
  },
  zh: {
    welcome: "欢迎进入您的用户面板",
    subtitle: "从这里统一管理语言路径、课程、平台订阅推荐、社区与会话。",
    progress: "课程进度",
    level: "SmartLingo · 用户面板",
    next: "进入您的第一个课程",
    nextBody: "浏览已批准课程、加入课程，或继续已经开始的课程。",
    action: "打开我的课程",
    account: "账户",
    language: "界面语言",
    signOut: "退出登录",
    voiceKicker: "语音咨询智能导师",
    voiceTitle: "随时开口练习一段实用会话",
    voiceBody: "打开智能导师页面后点击麦克风并开始说话。语音会转成文字，您可以确认内容后再发送。",
    voiceAction: "实时智能语音对话",
    coming: "三种平台方案，每位会员都能开班",
    comingBody: "选择初期、中级或高级语言课程；每门课程首月免费，并配有音视频网络研讨会教室。",
    certs: "结业证书",
    certsBody: "通过 SmartLingo 课程后，最终成绩和颁发日期会保存在这里。",
    certsAction: "查看证书",
  },
};

export default async function Dashboard({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const requestHeaders = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login`);
  const t = copy[lang];
  const certificateCount = (await getDatabase().prepare("SELECT COUNT(*) AS count FROM smartlingo_course_certificates_v2 WHERE user_id = ?")
    .bind(user.id).first<{ count: number }>())?.count ?? 0;
  const joinedCourseResult = await getDatabase().prepare(`SELECT c.id,c.title,c.target_language AS targetLanguage,
      COALESCE(c.package_tier,c.level,'beginner') AS packageTier
    FROM smartlingo_language_classes c
    JOIN smartlingo_language_class_members member ON member.class_id=c.id
    WHERE member.user_id=? AND member.status='active' AND c.status='open' AND c.class_kind='official_course'
    ORDER BY c.target_language,CASE c.package_tier WHEN 'basic' THEN 1 WHEN 'intermediate' THEN 2 ELSE 3 END,c.title`)
    .bind(user.id).run<DashboardJoinedCourse>();
  const joinedCourses = joinedCourseResult.results ?? [];
  return (
    <main className="dashboard-page" data-layout-page="dashboard" data-layout-ready="true" data-layout-overlap-check="dashboard-page">
      <SiteHeader lang={lang} />
      <span data-layout-overlap-check="dashboard-start" style={{ display: "block", height: 1 }} />
      <div className="dashboard-wrap">
        <div className="dashboard-title"><p className="section-kicker">{t.level}</p><h1>{t.welcome}, {user.displayName}.</h1><p>{t.subtitle}</p></div>
        <DashboardLearningHub lang={lang} courses={joinedCourses}/>
        <MembershipPanel lang={lang} />
        <div className="dashboard-grid">
          <section className="dashboard-cert-card"><div className="dashboard-cert-count"><span aria-hidden="true">SL</span><strong>{certificateCount.toLocaleString()}</strong></div><div><p className="section-kicker">SMARTLINGO CERTS</p><h2>{t.certs}</h2><p>{t.certsBody}</p><a className="primary-button" href={`/${lang}/certificates`}>{t.certsAction} <span>→</span></a></div></section>
          <aside className="account-card" id="account"><h2>{t.account}</h2><dl><div><dt>{lang === "zh" ? "邮箱" : "Email"}</dt><dd>{user.email}</dd></div><div><dt>{t.language}</dt><dd>{lang === "zh" ? "中文" : "English"}</dd></div></dl><TextSizeControl lang={lang} /><LogoutButton lang={lang} label={t.signOut} /></aside>
          <section className="coming-card"><div className="mini-table gc-mini-network" aria-hidden="true"><span>{lang === "zh" ? "免费" : "FREE"}</span><span>{lang === "zh" ? "进阶" : "PLUS"}</span><i>{lang === "zh" ? "协调" : "COORD"}</i><span>{lang === "zh" ? "开班" : "CLASS"}</span><span>{lang === "zh" ? "社区" : "SOCIAL"}</span></div><div><p className="section-kicker">{lang === "zh" ? "平台方案" : "PLATFORM PLANS"}</p><h2>{t.coming}</h2><p>{t.comingBody}</p></div></section>
        </div>
      </div>
      <span data-layout-overlap-check="dashboard-end" style={{ display: "block", height: 1 }} />
      <SiteFooter lang={lang} />
    </main>
  );
}
