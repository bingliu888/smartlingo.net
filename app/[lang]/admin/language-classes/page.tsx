import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isPermanentAdmin } from "../../../../lib/admin-access";
import { getDatabase, getSessionUser } from "../../../../lib/auth";
import "../admin.css";

export const dynamic = "force-dynamic";

type Row = { id: string; title: string; targetLanguage: string; level: string; status: string; visibility: string; ownerName: string; ownerEmail: string; createdAt: number };

export default async function AdminLanguageClasses({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/language-classes`);
  if (!isPermanentAdmin(user)) redirect(`/${lang}/dashboard`);
  const result = await getDatabase().prepare("SELECT c.id,c.title,c.target_language AS targetLanguage,c.level,c.status,c.visibility,c.created_at AS createdAt,u.display_name AS ownerName,u.email AS ownerEmail FROM smartlingo_language_classes c JOIN users u ON u.id=c.owner_user_id ORDER BY c.created_at DESC LIMIT 100").run<Row>();
  const rows = result.results ?? [];
  const zh = lang === "zh";
  return <main><SiteHeader lang={lang}/><div className="admin-shell" data-layout-page="admin-classes" data-layout-fill="admin-shell"><div className="admin-toolbar"><div><p className="section-kicker">{zh ? "管理员 · 课程" : "ADMIN · COURSES"}</p><h1>{zh ? "语言课程管理" : "Language course management"}</h1><p>{zh ? "查看官方社区班与会员创建课程的状态、公开范围及负责人。" : "Review status, visibility, and owners across official and member-created classes."}</p></div><a href={`/${lang}/dashboard`}>← {zh ? "管理中心" : "Dashboard"}</a></div><div className="admin-table-wrap">{rows.length ? <table className="admin-table"><thead><tr><th>{zh ? "课程" : "Course"}</th><th>{zh ? "语言／等级" : "Language / level"}</th><th>{zh ? "负责人" : "Owner"}</th><th>{zh ? "状态" : "Status"}</th><th>{zh ? "公开范围" : "Visibility"}</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.title}</strong><br/><span>{row.id}</span></td><td>{row.targetLanguage.toUpperCase()} · {row.level}</td><td>{row.ownerName}<br/><span>{row.ownerEmail}</span></td><td><span className="admin-badge">{row.status}</span></td><td>{row.visibility}</td></tr>)}</tbody></table> : <div className="admin-empty">{zh ? "暂无课程。" : "No courses yet."}</div>}</div></div><SiteFooter lang={lang}/></main>;
}
