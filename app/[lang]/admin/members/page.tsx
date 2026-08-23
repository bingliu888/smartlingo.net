import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminMemberActions, AdminRoleRemoveButton } from "../../../../components/AdminMemberActions";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isBootstrapAdminEmail } from "../../../../lib/admin-access";
import { getDatabase, getSessionUser } from "../../../../lib/auth";
import "../admin.css";

export const dynamic = "force-dynamic";

type Tab = "members" | "admins" | "subscribers";
type MemberRow = {
  id: string;
  email: string;
  displayName: string;
  role: "member" | "admin";
  createdAt: number;
  paymentCount: number;
  subscriberOverride: number;
};

function searchPattern(value: string) {
  return `%${value.toLowerCase().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

export default async function AdminMembersPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ tab?: string; q?: string }> }) {
  const [{ lang }, { tab, q }] = await Promise.all([params, searchParams]);
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/members`);
  if (!isBootstrapAdminEmail(user.email)) redirect(`/${lang}/dashboard`);

  const active: Tab = tab === "admins" ? "admins" : tab === "subscribers" ? "subscribers" : "members";
  const zh = lang === "zh";
  const query = (q ?? "").trim().slice(0, 80);
  const filters = ["COALESCE(a.status,'active')='active'"];
  if (active === "admins") filters.push("u.role='admin'");
  if (active === "subscribers") filters.push("COALESCE(a.subscriber_override,0)<>-1 AND (COALESCE(a.subscriber_override,0)=1 OR EXISTS (SELECT 1 FROM smartlingo_platform_subscription_payments p2 WHERE p2.subscriber_user_id=u.id AND p2.status='paid'))");
  if (query) filters.push("(lower(u.email) LIKE ? ESCAPE '\\' OR lower(u.display_name) LIKE ? ESCAPE '\\')");
  const statement = getDatabase().prepare(`SELECT u.id,u.email,u.display_name AS displayName,u.role,u.created_at AS createdAt,
    SUM(CASE WHEN p.status='paid' THEN 1 ELSE 0 END) AS paymentCount,COALESCE(a.subscriber_override,0) AS subscriberOverride
    FROM users u
    LEFT JOIN smartlingo_platform_subscription_payments p ON p.subscriber_user_id=u.id
    LEFT JOIN platform_member_access a ON a.user_id=u.id
    WHERE ${filters.join(" AND ")}
    GROUP BY u.id
    ORDER BY ${active === "subscribers" ? "paymentCount DESC," : ""} u.created_at DESC LIMIT 100`);
  const pattern = searchPattern(query);
  const result = query ? await statement.bind(pattern, pattern).run<MemberRow>() : await statement.run<MemberRow>();
  const members = result.results ?? [];
  const suffix = query ? `&q=${encodeURIComponent(query)}` : "";
  const tabLabel = active === "admins" ? (zh ? "管理员" : "Administrators") : active === "subscribers" ? (zh ? "订阅者" : "Subscribers") : (zh ? "会员" : "Members");

  return <main>
    <SiteHeader lang={lang}/>
    <div className="admin-shell" data-layout-page="admin-members" data-layout-fill="admin-shell">
      <div className="admin-toolbar">
        <div><p className="section-kicker">{zh ? "用户权限" : "USER ACCESS"}</p><h1>{zh ? "用户管理" : "User management"}</h1><p>{zh ? "会员账户始终保留；管理员和订阅者权限分别添加或删除。" : "Member accounts remain intact; administrator and subscriber roles are added or removed separately."}</p></div>
        <a href={`/${lang}/dashboard`}>← {zh ? "管理中心" : "Dashboard"}</a>
      </div>
      <form className="admin-search" method="get">
        <input type="hidden" name="tab" value={active}/><label htmlFor="member-search">{zh ? `搜索${tabLabel}` : `Search ${tabLabel.toLowerCase()}`}</label>
        <div><input id="member-search" name="q" type="search" defaultValue={query} placeholder={zh ? "输入姓名或邮箱" : "Enter name or email"} maxLength={80}/><button type="submit">{zh ? "搜索" : "Search"}</button>{query && <a href={`/${lang}/admin/members?tab=${active}`}>{zh ? "清除" : "Clear"}</a>}</div>
      </form>
      <nav className="admin-tabs">
        <a className={active === "members" ? "active" : ""} href={`/${lang}/admin/members?tab=members${suffix}`}>{zh ? "会员" : "Members"}</a>
        <a className={active === "admins" ? "active" : ""} href={`/${lang}/admin/members?tab=admins${suffix}`}>{zh ? "管理员" : "Administrators"}</a>
        <a className={active === "subscribers" ? "active" : ""} href={`/${lang}/admin/members?tab=subscribers${suffix}`}>{zh ? "订阅者" : "Subscribers"}</a>
      </nav>
      <div className="admin-table-wrap">{members.length ? <table className="admin-table"><thead><tr><th>{zh ? "会员" : "Member"}</th><th>{zh ? "当前分页" : "Current tab"}</th><th>{zh ? "加入时间" : "Joined"}</th><th>{zh ? "订阅" : "Subscription"}</th><th>{zh ? "操作" : "Action"}</th></tr></thead><tbody>
        {members.map((member) => <tr key={member.id}><td><strong>{member.displayName}</strong><br/><span>{member.email}</span></td><td><span className="admin-badge">{tabLabel}</span></td><td>{new Date(member.createdAt * 1000).toLocaleDateString(zh ? "zh-CN" : "en-US")}</td><td>{member.paymentCount > 0 ? (zh ? `${member.paymentCount} 笔已付款` : `${member.paymentCount} paid`) : member.subscriberOverride === 1 ? (zh ? "管理员授予" : "Granted by admin") : (zh ? "无" : "None")}</td><td><span className="admin-row-actions"><a href={`/${lang}/admin/members/${encodeURIComponent(member.id)}`}>{zh ? "查看" : "View"}</a>{active === "admins" && <AdminRoleRemoveButton memberId={member.id} lang={lang} kind="admin" locked={isBootstrapAdminEmail(member.email) || member.id === user.id}/>} {active === "subscribers" && <AdminRoleRemoveButton memberId={member.id} lang={lang} kind="subscriber"/>}</span></td></tr>)}
      </tbody></table> : <div className="admin-empty">{query ? (zh ? "没有匹配的用户。" : "No matching users.") : (zh ? "此分页暂无用户。" : "No users in this tab yet.")}</div>}</div>
      <AdminMemberActions lang={lang} tab={active}/>
    </div>
    <SiteFooter lang={lang}/>
  </main>;
}
