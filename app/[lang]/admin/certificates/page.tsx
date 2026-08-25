import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { isBootstrapAdminEmail } from "../../../../lib/admin-access";
import { getDatabase, getSessionUser } from "../../../../lib/auth";
import { certificateCourseName, certificateLanguageName, type SmartLingoCertificateRow } from "../../../../lib/smartlingo-certificates";
import "../admin.css";

export const dynamic = "force-dynamic";
type AdminCertificateRow = SmartLingoCertificateRow & { memberEmail: string };
function searchPattern(value: string) { return `%${value.toLowerCase().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`; }

export default async function AdminCertificatesPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ tab?: string; q?: string }> }) {
  const [{ lang }, queryParams] = await Promise.all([params, searchParams]);
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/admin/certificates`);
  if (!isBootstrapAdminEmail(user.email)) redirect(`/${lang}/dashboard`);
  const tab = queryParams.tab === "ranks" ? "ranks" : "recent";
  const query = (queryParams.q || "").trim().slice(0, 80);
  const filter = query ? "WHERE lower(u.email) LIKE ? ESCAPE '\\' OR lower(cert.member_name) LIKE ? ESCAPE '\\'" : "";
  const order = tab === "ranks" ? "cert.final_score DESC, cert.issued_at ASC" : "cert.issued_at DESC";
  const statement = getDatabase().prepare(`SELECT cert.id, cert.certificate_number AS certificateNumber,
    cert.verification_code AS verificationCode, cert.enrollment_id AS enrollmentId,
    cert.user_id AS userId, cert.class_id AS classId, cert.member_name AS memberName,
    u.email AS memberEmail, cert.course_title_zh AS courseTitleZh,
    cert.course_title_en AS courseTitleEn, cert.target_language AS targetLanguage,
    cert.level AS level, cert.duration_days AS durationDays, cert.start_day AS startDay,
    cert.completed_days AS completedDays,
    cert.final_score AS finalScore, cert.pass_score AS passScore,
    cert.completion_reason AS completionReason, cert.curriculum_version AS curriculumVersion,
    cert.issued_at AS issuedAt FROM smartlingo_course_certificates_v2 cert
    JOIN users u ON u.id = cert.user_id ${filter} ORDER BY ${order} LIMIT 200`);
  const pattern = searchPattern(query);
  const result = query ? await statement.bind(pattern, pattern).run<AdminCertificateRow>() : await statement.run<AdminCertificateRow>();
  const certificates = result.results || [];
  const zh = lang === "zh";
  return <main><SiteHeader lang={lang}/><div className="admin-shell" data-layout-page="admin-certificates" data-layout-fill="admin-shell" data-layout-ready="true">
    <div className="admin-toolbar"><div><p className="section-kicker">{zh ? "管理员 · 证书" : "ADMIN · CERTIFICATES"}</p><h1>{zh ? "结业证书" : "Course certificates"}</h1><p>{zh ? "查看最近颁发记录、成绩排名，并按会员姓名或邮箱搜索。" : "Review recent issues, score ranks, and search by member name or email."}</p></div><a href={`/${lang}/dashboard`}>← {zh ? "管理中心" : "Dashboard"}</a></div>
    <form className="admin-search" method="get"><input type="hidden" name="tab" value={tab}/><label htmlFor="certificate-search">{zh ? "搜索会员" : "Search members"}</label><div><input id="certificate-search" name="q" type="search" defaultValue={query} placeholder={zh ? "输入姓名或邮箱" : "Enter name or email"} maxLength={80}/><button type="submit">{zh ? "搜索" : "Search"}</button>{query ? <a href={`/${lang}/admin/certificates?tab=${tab}`}>{zh ? "清除" : "Clear"}</a> : null}</div></form>
    <nav className="admin-tabs"><a className={tab === "recent" ? "active" : ""} href={`/${lang}/admin/certificates?tab=recent`}>{zh ? "最近" : "Recent"}</a><a className={tab === "ranks" ? "active" : ""} href={`/${lang}/admin/certificates?tab=ranks`}>{zh ? "排名" : "Ranks"}</a></nav>
    <div className="admin-table-wrap">{certificates.length ? <table className="admin-table admin-certificate-table"><thead><tr><th>{zh ? "会员" : "Member"}</th><th>{zh ? "课程" : "Course"}</th><th>{zh ? "成绩" : "Score"}</th><th>{zh ? "颁发日期" : "Issued"}</th><th>{zh ? "操作" : "Action"}</th></tr></thead><tbody>{certificates.map(certificate => <tr key={certificate.id}><td data-label={zh ? "会员" : "Member"}><strong>{certificate.memberName}</strong><br/><span>{certificate.memberEmail}</span></td><td data-label={zh ? "课程" : "Course"}><strong>{certificateCourseName(certificate, lang === "zh" ? "zh" : "en")}</strong><br/><span>{certificateLanguageName(certificate.targetLanguage, lang === "zh" ? "zh" : "en")} · {certificate.durationDays} {zh ? "天" : "days"}</span></td><td data-label={zh ? "成绩" : "Score"}><span className="admin-badge">{certificate.finalScore} / 100</span></td><td data-label={zh ? "颁发日期" : "Issued"}>{new Date(certificate.issuedAt * 1000).toLocaleDateString(zh ? "zh-CN" : "en-US")}</td><td data-label={zh ? "操作" : "Action"}><a href={`/${lang}/certificates/${encodeURIComponent(certificate.id)}`}>{zh ? "查看证书" : "View"} →</a></td></tr>)}</tbody></table> : <div className="admin-empty">{zh ? "暂无匹配的证书。" : "No matching certificates."}</div>}</div>
  </div><SiteFooter lang={lang}/></main>;
}
