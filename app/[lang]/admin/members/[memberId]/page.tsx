import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminMemberRoleEditor } from "../../../../../components/AdminMemberRoleEditor";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { isBootstrapAdminEmail, isPermanentAdmin } from "../../../../../lib/admin-access";
import { getDatabase, getSessionUser } from "../../../../../lib/auth";
import "../../admin.css";

export const dynamic = "force-dynamic";
type Detail = {
  id: string; email: string; displayName: string; preferredLanguage: string;
  role: "member" | "admin"; createdAt: number; joinedClasses: number;
  paidPayments: number; subscriberOverride: number; expiresAt: number | null;
  cadence: string | null; subscriptionStatus: string | null;
  activeMax: number;
};

export default async function AdminMemberDetail({ params }: { params: Promise<{ lang: string; memberId: string }> }) {
  const { lang, memberId } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "zh-tw" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const incoming = await headers();
  const admin = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!admin) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/members/${encodeURIComponent(memberId)}`);
  if (!isPermanentAdmin(admin)) redirect(`/${lang}/dashboard`);
  const member = await getDatabase().prepare(`SELECT u.id,u.email,u.display_name AS displayName,
    u.preferred_language AS preferredLanguage,u.role,u.created_at AS createdAt,
    (SELECT COUNT(*) FROM smartlingo_language_class_members cm WHERE cm.user_id=u.id AND cm.status='active') AS joinedClasses,
    (SELECT COUNT(*) FROM smartlingo_platform_subscription_payments p WHERE p.subscriber_user_id=u.id AND p.status='paid') AS paidPayments,
    COALESCE(a.subscriber_override,0) AS subscriberOverride,
    s.current_period_ends_at AS expiresAt,s.cadence,s.status AS subscriptionStatus,
    CASE WHEN s.cadence='max' AND s.status='active' AND s.current_period_ends_at>unixepoch() THEN 1 ELSE 0 END AS activeMax
    FROM users u LEFT JOIN platform_member_access a ON a.user_id=u.id
    LEFT JOIN subscriptions s ON s.user_id=u.id WHERE u.id=? LIMIT 1`)
    .bind(memberId).first<Detail>();
  if (!member) notFound();
  const zh = lang === "zh" || lang === "zh-tw";
  const activeMax = member.activeMax === 1;
  const expiry = activeMax && member.expiresAt
    ? new Date(member.expiresAt * 1_000).toLocaleDateString(zh ? "zh-CN" : "en-US", { timeZone: "UTC" })
    : null;
  return <main>
    <SiteHeader lang={lang}/>
    <div className="admin-shell" data-layout-page="admin-member-detail" data-layout-fill="admin-shell" data-layout-ready="true">
      <div className="admin-toolbar"><div><p className="section-kicker">{zh ? "会员档案" : "MEMBER PROFILE"}</p><h1>{member.displayName}</h1><p>{member.email}</p></div><a href={`/${lang}/admin/members`}>← {zh ? "返回会员列表" : "Back to members"}</a></div>
      <div className="admin-detail-grid">
        <section className="admin-detail-card"><h2>{zh ? "账户概览" : "Account overview"}</h2><dl>
          <div><dt>{zh ? "会员账户" : "Member account"}</dt><dd>{zh ? "保留" : "Retained"}</dd></div>
          <div><dt>{zh ? "界面语言" : "Language"}</dt><dd>{member.preferredLanguage}</dd></div>
          <div><dt>{zh ? "加入日期" : "Joined"}</dt><dd>{new Date(member.createdAt * 1_000).toLocaleDateString(zh ? "zh-CN" : "en-US", { timeZone: "UTC" })}</dd></div>
          <div><dt>{zh ? "加入课程" : "Joined courses"}</dt><dd>{member.joinedClasses}</dd></div>
          <div><dt>{zh ? "平台付款记录" : "Platform payments"}</dt><dd>{member.paidPayments}</dd></div>
          <div><dt>{zh ? "Max 到期日" : "Max expires"}</dt><dd>{expiry || (zh ? "当前无有效 Max" : "No active Max")}</dd></div>
        </dl></section>
        <aside className="admin-detail-card"><h2>{zh ? "角色与订阅" : "Roles and subscription"}</h2><p>{zh ? "管理员赠送和付费 Max 共用订阅记录；不会删除会员账户或伪造付款。" : "Admin-granted and paid Max share the subscription record; member accounts and payment history are preserved."}</p><AdminMemberRoleEditor memberId={member.id} initialAdmin={member.role === "admin"} initialSubscriber={activeMax} initialExpiresAt={activeMax ? member.expiresAt : null} canRevokeSubscriber={activeMax && member.subscriberOverride === 1 && member.paidPayments === 0} hasPaidPayments={member.paidPayments > 0} lang={zh ? "zh" : "en"} adminLocked={isBootstrapAdminEmail(member.email) || member.id === admin.id}/></aside>
      </div>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
