import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isAdmin } from "../../../../lib/admin-access";
import { getDatabase, getSessionUser } from "../../../../lib/auth";
import "../admin.css";

export const dynamic = "force-dynamic";
type MemberRow = { id:string; email:string; displayName:string; role:"member"|"admin"; createdAt:number; paidAt:number|null; paymentCount:number };

function searchPattern(value:string){return `%${value.toLowerCase().replaceAll("\\","\\\\").replaceAll("%","\\%").replaceAll("_","\\_")}%`}

export default async function AdminMembersPage({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{tab?:string;q?:string}>}){
  const [{lang},{tab,q}]=await Promise.all([params,searchParams]);if(lang!=="en"&&lang!=="zh")notFound();
  const incoming=await headers();const user=await getSessionUser(new Request("https://smartlingo.net",{headers:{cookie:incoming.get("cookie")??""}}));
  if(!user)redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/members`);if(!isAdmin(user))redirect(`/${lang}/dashboard`);
  const active=tab==="subscribers"?"subscribers":"recent";const zh=lang==="zh";const query=(q??"").trim().slice(0,80);const filters:string[]=[];
  if(active==="subscribers")filters.push("EXISTS (SELECT 1 FROM smartlingo_platform_subscription_payments p2 WHERE p2.subscriber_user_id = u.id AND p2.status = 'paid')");
  if(query)filters.push("(lower(u.email) LIKE ? ESCAPE '\\' OR lower(u.display_name) LIKE ? ESCAPE '\\')");
  const where=filters.length?`WHERE ${filters.join(" AND ")}`:"";
  const statement=getDatabase().prepare(`SELECT u.id,u.email,u.display_name AS displayName,u.role,u.created_at AS createdAt,MAX(CASE WHEN p.status='paid' THEN p.paid_at END) AS paidAt,SUM(CASE WHEN p.status='paid' THEN 1 ELSE 0 END) AS paymentCount FROM users u LEFT JOIN smartlingo_platform_subscription_payments p ON p.subscriber_user_id=u.id ${where} GROUP BY u.id ORDER BY ${active==="subscribers"?"paidAt":"u.created_at"} DESC LIMIT 100`);
  const pattern=searchPattern(query);const result=query?await statement.bind(pattern,pattern).run<MemberRow>():await statement.run<MemberRow>();const members=result.results??[];
  const querySuffix=query?`&q=${encodeURIComponent(query)}`:"";
  return <main><SiteHeader lang={lang}/><div className="admin-shell" data-layout-page="admin-members" data-layout-fill="admin-shell"><div className="admin-toolbar"><div><p className="section-kicker">{zh?"管理员 · 会员":"ADMIN · MEMBERS"}</p><h1>{zh?"会员管理":"Member management"}</h1><p>{zh?"查看最近加入与已产生平台订阅付款的会员。":"Review recent members and members with paid platform subscriptions."}</p></div><a href={`/${lang}/dashboard`}>← {zh?"管理中心":"Dashboard"}</a></div><form className="admin-search" method="get"><input type="hidden" name="tab" value={active}/><label htmlFor="member-search">{zh?"搜索会员":"Search members"}</label><div><input id="member-search" name="q" type="search" defaultValue={query} placeholder={zh?"输入姓名或邮箱":"Enter name or email"} maxLength={80}/><button type="submit">{zh?"搜索":"Search"}</button>{query&&<a href={`/${lang}/admin/members?tab=${active}`}>{zh?"清除":"Clear"}</a>}</div></form><nav className="admin-tabs"><a className={active==="recent"?"active":""} href={`/${lang}/admin/members?tab=recent${querySuffix}`}>{zh?"最近":"Recent"}</a><a className={active==="subscribers"?"active":""} href={`/${lang}/admin/members?tab=subscribers${querySuffix}`}>{zh?"订阅会员":"Subscribers"}</a></nav><div className="admin-table-wrap">{members.length?<table className="admin-table"><thead><tr><th>{zh?"会员":"Member"}</th><th>{zh?"角色":"Role"}</th><th>{zh?"加入时间":"Joined"}</th><th>{zh?"订阅":"Subscription"}</th><th>{zh?"操作":"Action"}</th></tr></thead><tbody>{members.map(member=><tr key={member.id}><td><strong>{member.displayName}</strong><br/><span>{member.email}</span></td><td><span className="admin-badge">{member.role==="admin"?(zh?"管理员":"Admin"):(zh?"会员":"Member")}</span></td><td>{new Date(member.createdAt*1000).toLocaleDateString(zh?"zh-CN":"en-US")}</td><td>{member.paymentCount>0?(zh?`${member.paymentCount} 笔已付款`:`${member.paymentCount} paid`):(zh?"未付款":"No paid plan")}</td><td><a href={`/${lang}/admin/members/${encodeURIComponent(member.id)}`}>{zh?"查看会员":"View member"} →</a></td></tr>)}</tbody></table>:<div className="admin-empty">{query?(zh?"没有匹配的会员。":"No matching members."):(zh?"此分页暂无会员。":"No members in this tab yet.")}</div>}</div></div><SiteFooter lang={lang}/></main>;
}
