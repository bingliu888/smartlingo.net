import type { SessionUser } from "../lib/auth";
import { getDatabase } from "../lib/auth";
import { AdminLearningRewards } from "./AdminLearningRewards";
import AdminCryptoSettings from "./AdminCryptoSettings";

type CountRow = { count: number };

async function count(sql: string) {
  return (await getDatabase().prepare(sql).first<CountRow>())?.count ?? 0;
}

export async function AdminDashboard({ lang, user }: { lang: "en" | "zh"; user: SessionUser }) {
  const [members, subscribers, certificates] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM users"),
    count("SELECT COUNT(*) AS count FROM subscriptions WHERE cadence='max' AND status='active' AND current_period_ends_at>unixepoch()"),
    count("SELECT COUNT(*) AS count FROM smartlingo_course_certificates_v2"),
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
          <div><p>{zh ? "会员" : "Members"}</p><strong>{members.toLocaleString()}</strong><span>{zh ? `${subscribers.toLocaleString()} 位有效旗舰版订阅会员（含试用）` : `${subscribers.toLocaleString()} active Max members (including trials)`}</span></div>
          <nav><a href={`/${lang}/admin/members?tab=members`}>{zh ? "全部会员" : "All members"} →</a><a href={`/${lang}/admin/members?tab=admins`}>{zh ? "管理员" : "Administrators"} →</a><a href={`/${lang}/admin/members?tab=subscribers`}>{zh ? "订阅者" : "Subscribers"} →</a></nav>
        </article>
        <article className="admin-overview-card">
          <div><p>{zh ? "课程等级" : "Course levels"}</p><strong>3</strong><span>{zh ? "初级免费；中高级由试用或旗舰版开放 · 0 个课程付款项目" : "Beginner free; trial or Max opens higher levels · 0 course payment items"}</span></div>
          <nav><a href={`/${lang}/admin/language-classes`}>{zh ? "查看课程等级" : "View course levels"} →</a></nav>
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
      <AdminLearningRewards lang={lang}/>
    </div>
  );
}
