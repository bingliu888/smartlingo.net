import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { getDatabase, getSessionUser } from "../../../../lib/auth";
import {
  SMARTLINGO_CERTIFICATE_SELECT,
  certificateCourseName,
  certificateLanguageName,
  type SmartLingoCertificateRow,
} from "../../../../lib/smartlingo-certificates";
import "../certificates.css";

export const dynamic = "force-dynamic";

export default async function CertificateDetailPage({ params }: { params: Promise<{ lang: string; certificateId: string }> }) {
  const { lang, certificateId } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const incoming = await headers();
  const user = await getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: incoming.get("cookie") ?? "" } }));
  if (!user) redirect(`/${lang}/auth/login?returnTo=/${lang}/certificates/${encodeURIComponent(certificateId)}`);
  const certificate = await getDatabase().prepare(`${SMARTLINGO_CERTIFICATE_SELECT}
    WHERE cert.id = ? AND (cert.user_id = ? OR ? = 'admin') LIMIT 1`)
    .bind(certificateId, user.id, user.role).first<SmartLingoCertificateRow>();
  if (!certificate) notFound();
  const zh = lang === "zh";
  const issueDate = new Date(certificate.issuedAt * 1000).toLocaleDateString(zh ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const skillScope = certificate.level === "intermediate"
    ? (zh ? "中级综合语言能力 · 五项技能" : "INTERMEDIATE LANGUAGE COMMAND · FIVE SKILLS")
    : certificate.level === "advanced"
      ? (zh ? "高级综合语言能力 · 五项技能" : "ADVANCED LANGUAGE COMMAND · FIVE SKILLS")
      : certificate.durationDays === 7
    ? (zh ? "旅行基础 · 词汇、听力与对话" : "TRAVEL BASICS · VOCABULARY, LISTENING & DIALOGUE")
    : certificate.durationDays === 14
      ? (zh ? "生活沟通 · 词汇、听力、对话与阅读" : "EVERYDAY COMMUNICATION · VOCABULARY, LISTENING, DIALOGUE & READING")
      : (zh ? "五项语言技能 · 完整实用入门课程" : "FIVE LANGUAGE SKILLS · COMPLETE PRACTICAL BEGINNER COURSE");
  return <main><SiteHeader lang={lang as any}/><div className="certificate-detail-page" data-layout-page="certificate-detail" data-layout-fill="certificate-detail-page" data-layout-ready="true">
    <nav className="certificate-back"><a href={`/${lang}/certificates`}>← {zh ? "全部证书" : "All certificates"}</a></nav>
    <article className="certificate-art" aria-label={zh ? "SmartLingo 结业证书" : "SmartLingo course certificate"}>
      <div className="certificate-orbit one"/><div className="certificate-orbit two"/><span className="certificate-seal" aria-hidden="true">SL</span>
      <header><p>SMARTLINGO</p><h1>{zh ? "课程结业证书" : "Certificate of Completion"}</h1><span>{skillScope}</span></header>
      <section><p>{zh ? "兹证明" : "This certifies that"}</p><h2>{certificate.memberName}</h2><p>{zh ? "已达到课程通过标准并完成" : "has met the passing standard and completed"}</p><h3>{certificateCourseName(certificate, lang === "zh" ? "zh" : "en")}</h3></section>
      <dl><div><dt>{zh ? "目标语言" : "Target language"}</dt><dd>{certificateLanguageName(certificate.targetLanguage, lang === "zh" ? "zh" : "en")}</dd></div><div><dt>{zh ? "课程等级" : "Course level"}</dt><dd>{certificate.level === "beginner" ? (zh ? "入门" : "Beginner") : certificate.level === "intermediate" ? (zh ? "中级" : "Intermediate") : (zh ? "高级" : "Advanced")}</dd></div><div><dt>{zh ? "课程长度" : "Course length"}</dt><dd>{certificate.durationDays} {zh ? "天" : "days"}</dd></div><div><dt>{zh ? "最终成绩" : "Final score"}</dt><dd>{certificate.finalScore} / 100</dd></div><div><dt>{zh ? "颁发日期" : "Issue date"}</dt><dd>{issueDate}</dd></div></dl>
      <footer><div><span>{zh ? "证书编号" : "Certificate number"}</span><strong>{certificate.certificateNumber}</strong></div><div><span>{zh ? "验证代码" : "Verification code"}</span><strong>{certificate.verificationCode}</strong></div><em>{certificate.completionReason === "early_mastery" ? (zh ? "卓越掌握 · 提前结业" : "EARLY MASTERY") : (zh ? "完成全部课程" : "COURSE COMPLETE")}</em></footer>
    </article>
    <aside className="certificate-notice"><strong>{zh ? "关于本证书" : "About this certificate"}</strong><p>{zh ? "本证书记录 SmartLingo 平台课程完成情况和练习成绩，不是政府、学校或第三方语言考试证书。" : "This certificate records completion and practice performance in a SmartLingo course. It is not a government, academic, or third-party language examination credential."}</p></aside>
  </div><SiteFooter lang={lang as any}/></main>;
}
