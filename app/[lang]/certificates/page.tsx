import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { getDatabase, getSessionUser } from "../../../lib/auth";
import {
  SMARTLINGO_CERTIFICATE_SELECT,
  certificateCourseName,
  certificateLanguageName,
  type SmartLingoCertificateRow,
} from "../../../lib/smartlingo-certificates";
import "./certificates.css";

export const dynamic = "force-dynamic";

export default async function CertificatesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/certificates`);
  const result = await getDatabase().prepare(`${SMARTLINGO_CERTIFICATE_SELECT}
    WHERE cert.user_id = ? ORDER BY cert.issued_at DESC, cert.id`).bind(user.id).run<SmartLingoCertificateRow>();
  const certificates = result.results || [];
  const zh = lang === "zh";
  return <main><SiteHeader lang={lang as any}/><div className="certificate-page" data-layout-page="certificates" data-layout-fill="certificate-page" data-layout-ready="true">
    <header className="certificate-page-heading"><p className="section-kicker">{zh ? "SMARTLINGO 学习成果" : "SMARTLINGO ACHIEVEMENTS"}</p><h1>{zh ? "我的结业证书" : "My course certificates"}</h1><p>{zh ? "证书按颁发日期从新到旧排列。每份证书记录课程、成绩、学习者姓名和颁发日期。" : "Certificates are ordered newest first. Each one records the course, score, learner name, and issue date."}</p></header>
    {certificates.length ? <section className="certificate-grid" aria-label={zh ? "证书列表" : "Certificate list"}>{certificates.map(certificate => <a className="certificate-tile" href={`/${lang}/certificates/${encodeURIComponent(certificate.id)}`} key={certificate.id}>
      <span className="certificate-tile-mark" aria-hidden="true">SL</span><div><p>{certificateLanguageName(certificate.targetLanguage, lang === "zh" ? "zh" : "en")} · {certificate.durationDays} {zh ? "天" : "days"}</p><h2>{certificateCourseName(certificate, lang === "zh" ? "zh" : "en")}</h2><strong>{certificate.finalScore}<small> / 100</small></strong><span>{new Date(certificate.issuedAt * 1000).toLocaleDateString(zh ? "zh-CN" : "en-US")}</span></div>
    </a>)}</section> : <div className="certificate-empty"><h2>{zh ? "完成第一门课程后，证书会显示在这里。" : "Your first certificate will appear here after you pass a course."}</h2><a href={`/${lang}/classes`}>{zh ? "浏览语言课程" : "Browse language courses"} →</a></div>}
  </div><SiteFooter lang={lang as any}/></main>;
}
