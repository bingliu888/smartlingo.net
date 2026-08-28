import type { SessionUser } from "../lib/auth";
import { getDatabase } from "../lib/auth";
import { AdminCollegeTags } from "./CollegeAdminForms";
import { activeCollegeTags } from "../lib/smartlingo-colleges";
import { AdminLearningRewards } from "./AdminLearningRewards";
import AdminCryptoSettings from "./AdminCryptoSettings";
import { SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES } from "../lib/smartlingo-course-packages";

type CountRow = { count: number };

async function count(sql: string) {
  return (await getDatabase().prepare(sql).first<CountRow>())?.count ?? 0;
}

export async function AdminDashboard({ lang, user }: { lang: "en" | "zh"; user: SessionUser }) {
  const [members, subscribers, certificates, colleges, collegeTags] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM users"),
    count("SELECT COUNT(DISTINCT u.id) AS count FROM users u LEFT JOIN platform_member_access a ON a.user_id=u.id WHERE COALESCE(a.status,'active')='active' AND COALESCE(a.subscriber_override,0)<>-1 AND (COALESCE(a.subscriber_override,0)=1 OR EXISTS (SELECT 1 FROM smartlingo_platform_subscription_payments p WHERE p.subscriber_user_id=u.id AND p.status='paid'))"),
    count("SELECT COUNT(*) AS count FROM smartlingo_course_certificates_v2"),
    count("SELECT COUNT(*) AS count FROM smartlingo_colleges WHERE status='active'"),
    activeCollegeTags(true),
  ]);
  const zh = lang === "zh";
  return (
    <div className="admin-shell" data-layout-page="admin-dashboard" data-layout-fill="admin-shell">
      <header className="admin-hero">
        <p className="section-kicker">{zh ? "SMARTLINGO 管理中心" : "SMARTLINGO ADMIN"}</p>
        <h1>{zh ? `欢迎，${user.displayName}` : `Welcome, ${user.displayName}`}</h1>
        <p>{zh ? "管理会员、订阅与语言课程。所有管理操作都会在服务器端验证管理员权限。" : "Manage members, subscriptions, and language classes. Every management action is authorized again on the server."}</p>
      </header>
      <section className="admin-overview-grid" aria-label={zh ? "管理概览" : "Admin overview"}>
        <article className="admin-overview-card">
          <div><p>{zh ? "学院" : "Colleges"}</p><strong>{colleges.toLocaleString()}</strong><span>{zh ? "含自动导论课程与课程表" : "With introductions and course tables"}</span></div>
          <nav><a href={`/${lang}/colleges`}>{zh ? "管理学院" : "Manage colleges"} →</a><a href={`/${lang}/college/create`}>{zh ? "创建学院" : "Create college"} →</a></nav>
        </article>
        <article className="admin-overview-card">
          <div><p>{zh ? "会员" : "Members"}</p><strong>{members.toLocaleString()}</strong><span>{zh ? `${subscribers.toLocaleString()} 位付费订阅会员` : `${subscribers.toLocaleString()} paid subscribers`}</span></div>
          <nav><a href={`/${lang}/admin/members?tab=members`}>{zh ? "全部会员" : "All members"} →</a><a href={`/${lang}/admin/members?tab=admins`}>{zh ? "管理员" : "Administrators"} →</a><a href={`/${lang}/admin/members?tab=subscribers`}>{zh ? "订阅者" : "Subscribers"} →</a></nav>
        </article>
        <article className="admin-overview-card">
          <div><p>{zh ? "课程价格" : "Course prices"}</p><strong>{SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES.length}</strong><span>{zh ? "3 个等级 × 3 种固定期限" : "3 levels × 3 fixed terms"}</span></div>
          <nav><a href={`/${lang}/admin/language-classes`}>{zh ? "查看价格套餐" : "View price packages"} →</a></nav>
        </article>
        <article className="admin-overview-card">
          <div><p>{zh ? "结业证书" : "Certificates"}</p><strong>{certificates.toLocaleString()}</strong><span>{zh ? "由真实课程成绩生成" : "Issued from recorded course scores"}</span></div>
          <nav><a href={`/${lang}/admin/certificates?tab=recent`}>{zh ? "最近证书" : "Recent"} →</a><a href={`/${lang}/admin/certificates?tab=ranks`}>{zh ? "成绩排名" : "Ranks"} →</a></nav>
        </article>
      </section>
      <section className="admin-quick-links">
        <h2>{zh ? "运营入口" : "Operations"}</h2>
        <div><a href={`/${lang}/project`}>{zh ? "项目进展" : "Project"}</a><a href={`/${lang}/community`}>{zh ? "社区" : "Community"}</a><a href={`/${lang}/messages`}>{zh ? "消息与实时聊天" : "Messages & live chat"}</a><a href={`/${lang}/assistant`}>{zh ? "智能导师" : "Ask Guru"}</a><a href={`/${lang}/admin/crypto-payments`}>{zh ? "加密货币付款" : "Crypto payments"}</a></div>
      </section>
      <AdminCryptoSettings lang={lang}/>
      <AdminCollegeTags lang={lang} tags={collegeTags}/>
      <AdminLearningRewards lang={lang}/>
    </div>
  );
}
