import type { SessionUser } from "../lib/auth";
import { getDatabase } from "../lib/auth";

type CountRow = { count: number };

async function count(sql: string) {
  return (await getDatabase().prepare(sql).first<CountRow>())?.count ?? 0;
}

export async function AdminDashboard({ lang, user }: { lang: "en" | "zh"; user: SessionUser }) {
  const [members, subscribers, classes, openClasses, certificates] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM users"),
    count("SELECT COUNT(DISTINCT subscriber_user_id) AS count FROM smartlingo_platform_subscription_payments WHERE status = 'paid'"),
    count("SELECT COUNT(*) AS count FROM smartlingo_language_classes"),
    count("SELECT COUNT(*) AS count FROM smartlingo_language_classes WHERE status = 'open'"),
    count("SELECT COUNT(*) AS count FROM smartlingo_course_certificates"),
  ]);
  const zh = lang === "zh";
  return (
    <div className="admin-shell" data-layout-page="admin-dashboard" data-layout-fill="admin-shell">
      <header className="admin-hero">
        <p className="section-kicker">{zh ? "SMARTLINGO 管理中心" : "SMARTLINGO ADMIN"}</p>
        <h1>{zh ? `欢迎，${user.displayName}` : `Welcome, ${user.displayName}`}</h1>
        <p>{zh ? "管理会员、订阅与语言班级。所有管理操作都会在服务器端验证管理员权限。" : "Manage members, subscriptions, and language classes. Every management action is authorized again on the server."}</p>
      </header>
      <section className="admin-overview-grid" aria-label={zh ? "管理概览" : "Admin overview"}>
        <article className="admin-overview-card">
          <div><p>{zh ? "会员" : "Members"}</p><strong>{members.toLocaleString()}</strong><span>{zh ? `${subscribers.toLocaleString()} 位付费订阅会员` : `${subscribers.toLocaleString()} paid subscribers`}</span></div>
          <nav><a href={`/${lang}/admin/members?tab=recent`}>{zh ? "最近会员" : "Recent"} →</a><a href={`/${lang}/admin/members?tab=subscribers`}>{zh ? "订阅会员" : "Subscribers"} →</a></nav>
        </article>
        <article className="admin-overview-card">
          <div><p>{zh ? "语言班级" : "Language classes"}</p><strong>{classes.toLocaleString()}</strong><span>{zh ? `${openClasses.toLocaleString()} 个开放班级` : `${openClasses.toLocaleString()} open classes`}</span></div>
          <nav><a href={`/${lang}/admin/language-classes`}>{zh ? "管理班级" : "Manage classes"} →</a></nav>
        </article>
        <article className="admin-overview-card">
          <div><p>{zh ? "结业证书" : "Certificates"}</p><strong>{certificates.toLocaleString()}</strong><span>{zh ? "由真实课程成绩生成" : "Issued from recorded course scores"}</span></div>
          <nav><a href={`/${lang}/admin/certificates?tab=recent`}>{zh ? "最近证书" : "Recent"} →</a><a href={`/${lang}/admin/certificates?tab=ranks`}>{zh ? "成绩排名" : "Ranks"} →</a></nav>
        </article>
      </section>
      <section className="admin-quick-links">
        <h2>{zh ? "运营入口" : "Operations"}</h2>
        <div><a href={`/${lang}/project`}>{zh ? "项目进展" : "Project"}</a><a href={`/${lang}/community`}>{zh ? "社区" : "Community"}</a><a href={`/${lang}/messages`}>{zh ? "消息与实时聊天" : "Messages & live chat"}</a><a href={`/${lang}/assistant`}>{zh ? "智能导师" : "Ask Guru"}</a></div>
      </section>
    </div>
  );
}
