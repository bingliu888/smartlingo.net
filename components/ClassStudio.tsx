"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SMARTLINGO_COURSE_PACKAGES, courseSubscriptionPackage, type SmartLingoCourseDurationMonths, type SmartLingoPackageTier } from "../lib/smartlingo-course-packages";
import { interfaceText } from "../lib/interface-locale";
import type { SiteLanguage } from "../lib/site-locale";
import { CourseClassroomTile } from "./CourseClassroomTile";
import { CoursePaymentActions } from "./CoursePaymentActions";
import { CourseStudentManager } from "./CourseStudentManager";

type Lang = SiteLanguage;
type LanguageClass = {
  id: string; ownerName: string; pathTitleEn: string; pathTitleZh: string;
  title: string; summary: string; targetLanguage: string; level: string; schedule: string;
  priceCents: number; currency: string; capacity: number; enrollmentCount: number;
  classKind: "official_course" | string; packageTier: SmartLingoPackageTier | null;
  trialDays: number; membershipStatus?: string | null; subscriptionStatus?: string | null;
  trialEndsAt?: number | null; isJoined?: boolean; canJoin?: boolean;
};
type Context = {
  currentUser: { id: string; displayName: string };
  classes: LanguageClass[]; joinedClasses: LanguageClass[]; availableClasses: LanguageClass[];
};
type Detail = {
  class: LanguageClass; isOwner: boolean; canManage: boolean;
  membership: { role: string; status: string } | null;
  placement: { id: string; status: string; entryMode: string; overallScore: number | null; recommendedLevel: string | null } | null;
};

const COPY = {
  en: {
    eyebrow: "MY COURSES", title: "Your subscribed courses.",
    intro: "Only courses you have subscribed to appear here. Use Choose courses whenever you want to explore another language or level.",
    signIn: "Sign in to view courses", joinedTitle: "My courses", noJoined: "You have not started a course yet.",
    chooseCourses: "Choose courses", joined: "Subscribed",
    open: "Open course", learners: "learners", packageFrom: "Packages from", months: "months",
    back: "All courses", courseAdmin: "SmartLingo course", schedule: "Schedule", price: "Selected package",
    package: "Course package", classroom: "Two course rooms", classroomCopy: "Use the Webinar teaching room for administrator and co-host lessons, and the free group-audio practice room for student speaking discussion.",
    fiveSkillsTitle: "Learn five skills", fiveSkillsBody: "Open Vocabulary, Speaking, Listening, Writing, or Quiz for this course directly—no language or placement selection required.",
    dailyLearning: "Continue guided learning", calendar: "Learning calendar",
    edit: "Edit course", save: "Save", cancel: "Cancel", summary: "Description", joinFailed: "The subscription could not be started. Please try again.",
  },
  zh: {
    eyebrow: "我的课程", title: "您已订阅的课程。",
    intro: "这里只显示您已订阅的课程。如需学习其他语言或等级，可随时前往“选择课程”。",
    signIn: "登录后查看课程", joinedTitle: "我的课程", noJoined: "您尚未开始任何课程。",
    chooseCourses: "选择课程", joined: "已订阅",
    open: "进入课程", learners: "位学员", packageFrom: "套餐起价", months: "个月",
    back: "返回全部课程", courseAdmin: "SmartLingo 官方课程", schedule: "课程安排", price: "已选套餐",
    package: "课程内容", classroom: "两个课程教室", classroomCopy: "管理员和协办主持在 Webinar 课程教室授课；学员可在免费的 Group Audio 练习室讨论和练习口语。",
    fiveSkillsTitle: "学习五项技能", fiveSkillsBody: "直接进入本课程的词汇、口语、听力、写作或测验，无需再次选择语言或参加分级测试。",
    dailyLearning: "继续综合学习", calendar: "学习日历",
    edit: "编辑课程", save: "保存", cancel: "取消", summary: "课程说明", joinFailed: "暂时无法开通订阅，请稍后重试。",
  },
} as const;

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

export function ClassStudio({ lang, initialClassId, initialTargetLanguage, initialDurationMonths=3, initialDepartmentId }: { lang: Lang; initialClassId?: string; initialInviteCode?: string; initialTargetLanguage?: string; initialDurationMonths?: SmartLingoCourseDurationMonths; initialDepartmentId?: string }) {
  const t = COPY[lang === "zh" ? "zh" : "en"];
  const tx=(english:string,chinese:string)=>interfaceText(lang,english,chinese);
  const [context, setContext] = useState<Context | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [listResponse, detailResponse] = await Promise.all([
      fetch("/api/classes", { cache: "no-store" }),
      initialClassId ? fetch(`/api/classes/${encodeURIComponent(initialClassId)}`, { cache: "no-store" }) : Promise.resolve(null),
    ]);
    if (listResponse.status === 401 || detailResponse?.status === 401) { setUnauthorized(true); return; }
    const list = await listResponse.json();
    if (!listResponse.ok) throw new Error(list.error || "Unable to load courses");
    setContext(list);
    if (detailResponse) {
      const item = await detailResponse.json();
      if (!detailResponse.ok) throw new Error(item.error || "Unable to load course");
      setDetail(item);
    }
  }, [initialClassId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load().catch(error => setNotice(error instanceof Error ? error.message : "Unable to load courses")); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const lists = useMemo(() => {
    if (!context) return { joined: [] as LanguageClass[] };
    const prioritize = (items: LanguageClass[]) => initialTargetLanguage
      ? [...items].sort((a, b) => Number(b.targetLanguage === initialTargetLanguage) - Number(a.targetLanguage === initialTargetLanguage)) : items;
    return { joined: prioritize(context.joinedClasses || []) };
  }, [context, initialTargetLanguage]);

  async function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return; setBusy(true); setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/classes/${encodeURIComponent(detail.class.id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update_official_course", ...values }),
    });
    if (response.ok) { setEditing(false); await load(); } else setNotice((await response.json().catch(() => ({}))).error || "Unable to save");
    setBusy(false);
  }

  function card(item: LanguageClass) {
    const plan = SMARTLINGO_COURSE_PACKAGES.find(value => value.tier === item.packageTier);
    return <article className="official" key={item.id}>
      <div className="class-card-meta"><span>{item.targetLanguage.toUpperCase()} · {item.level}</span><b>{t.joined}</b></div>
      <h3>{item.title}</h3><p>{item.summary}</p>
      {plan && <ul>{plan.features.en.map((feature,index) => <li key={feature}>✓ {tx(feature,plan.features.zh[index])}</li>)}</ul>}
      <small>{t.packageFrom} {money(plan?.startingPriceCents || item.priceCents, item.currency)} / 3 {t.months} · {item.enrollmentCount}/{item.capacity} {t.learners}</small>
      <Link className="secondary-button" href={`/${lang}/classes/${item.id}`}>{t.open} →</Link>
    </article>;
  }

  function learningLinks(item: LanguageClass) {
    const encodedClassId = encodeURIComponent(item.id);
    const sessionBase = `/${lang}/classes/${encodedClassId}/learn/session`;
    return [
      { key: "vocabulary", icon: "Aa", label: lang === "zh" ? "词汇" : "Vocabulary", href: `/${lang}/classes/${encodedClassId}/vocabulary` },
      { key: "speaking", icon: "◉", label: lang === "zh" ? "口语" : "Speaking", href: `${sessionBase}?training=dialogue` },
      { key: "listening", icon: "◒", label: lang === "zh" ? "听力" : "Listening", href: `${sessionBase}?training=listening` },
      { key: "writing", icon: "✎", label: lang === "zh" ? "写作" : "Writing", href: `${sessionBase}?training=writing` },
      { key: "quiz", icon: "?", label: lang === "zh" ? "测验" : "Quiz", href: `${sessionBase}?training=quiz` },
    ];
  }

  if (unauthorized) return <section className="smartlingo-class-studio class-auth-required"><p className="section-kicker">{t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p><Link className="primary-button" href={`/${lang}/auth/login?returnTo=${encodeURIComponent(initialClassId ? `/${lang}/classes/${initialClassId}` : `/${lang}/classes`)}`}>{t.signIn} →</Link><Styles/></section>;
  if (!context || (initialClassId && !detail)) return <section className="smartlingo-class-studio class-loading" aria-live="polite"><div><strong>SmartLingo…</strong>{notice && <p className="class-notice">{notice}</p>}</div><Styles/></section>;

  if (detail) {
    const item = detail.class;
    const plan = SMARTLINGO_COURSE_PACKAGES.find(value => value.tier === item.packageTier);
    const selectedPackage=item.packageTier?courseSubscriptionPackage(item.packageTier,initialDurationMonths):null;
    const joined = detail.membership?.status === "active";
    return <section className="smartlingo-class-studio">
      <Link className="class-back" href={`/${lang}/classes`}>← {t.back}</Link>
      <div className="class-detail-hero"><div><p className="section-kicker">{item.targetLanguage.toUpperCase()} · {item.level}</p><h1>{item.title}</h1><p>{item.summary}</p></div>
        <dl><div><dt>{t.courseAdmin}</dt><dd>{item.ownerName}</dd></div><div><dt>{t.schedule}</dt><dd>{item.schedule}</dd></div><div><dt>{t.price}</dt><dd>{selectedPackage?`${money(selectedPackage.priceCents)} · ${selectedPackage.months} ${t.months}`:"—"}</dd></div><div><dt>{tx("Renewal","续费")}</dt><dd>{tx("Manual only","仅手动续购")}</dd></div></dl></div>
      {detail.canManage && <button className="secondary-button class-edit-course" onClick={() => setEditing(true)}>✎ {t.edit}</button>}
      {editing && <form className="course-edit-form" onSubmit={saveCourse}><label>{lang === "zh" ? "课程名称" : "Course title"}<input name="title" defaultValue={item.title}/></label><label>{t.summary}<textarea name="summary" defaultValue={item.summary}/></label><label>{t.schedule}<input name="schedule" defaultValue={item.schedule}/></label><div><button disabled={busy}>{t.save}</button><button type="button" onClick={() => setEditing(false)}>{t.cancel}</button></div></form>}
      <div className="class-detail-grid">
        <article><span>{plan?tx(plan.name.en,plan.name.zh):item.packageTier?.toUpperCase()}</span><h2>{t.package}</h2><ul>{plan?.features.en.map((feature,index) => <li key={feature}>✓ {tx(feature,plan.features.zh[index])}</li>)}</ul></article>
        <article><span>WEBINAR + GROUP AUDIO</span><h2>{t.classroom}</h2><p>{t.classroomCopy}</p></article>
        {!joined && !detail.canManage && item.packageTier && <article className="class-subscribe-card"><span>{tx("FIXED-TERM COURSE ACCESS","固定期限课程学习权利")}</span><h2>{selectedPackage?`${money(selectedPackage.priceCents)} · ${selectedPackage.months} ${t.months}`:tx("Choose a package","选择套餐")}</h2><p>{initialDepartmentId?tx("The administrator sets the same course price everywhere; this department receives 70% of each paid package.","课程价格由管理员统一设置；本部门获得每笔实付套餐费用的 70%。"):tx("Choose 3, 6, or 12 months. Card payment is available for all nine packages; Polygon USDT and GLC are available only for three months.","选择 3、6 或 12 个月。九个套餐均可使用信用卡；Polygon USDT 和 GLC 仅用于三个月套餐。")}</p><CoursePaymentActions lang={lang} classId={item.id} targetLanguage={item.targetLanguage} packageTier={item.packageTier} initialMonths={initialDurationMonths} departmentId={initialDepartmentId}/></article>}
        {joined && <article className="class-placement-card"><span>5 SKILLS</span><h2>{t.fiveSkillsTitle}</h2><p>{t.fiveSkillsBody}</p><nav className="class-skill-launcher" aria-label={t.fiveSkillsTitle}>{learningLinks(item).map(skill => <Link href={skill.href} key={skill.key}><i aria-hidden="true">{skill.icon}</i><strong>{skill.label}</strong><small>{lang === "zh" ? "直接开始" : "Start now"} →</small></Link>)}</nav><div className="class-learning-actions"><Link className="primary-button" href={`/${lang}/classes/${encodeURIComponent(item.id)}/learn/session`}>{t.dailyLearning} →</Link><Link className="secondary-button" href={`/${lang}/learning-log`}>{t.calendar} →</Link></div></article>}
        {(joined || detail.canManage) && <CourseClassroomTile classId={item.id} lang={lang==="zh"?"zh":"en"}/>}
        {detail.canManage && <CourseStudentManager classId={item.id} lang={lang==="zh"?"zh":"en"}/>}
      </div>{notice && <p className="class-notice">{notice}</p>}<Styles/>
    </section>;
  }

  return <section className="smartlingo-class-studio" data-layout-ready="true"><header className="class-studio-intro"><p className="section-kicker">{t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p><Link className="primary-button class-choose-courses" href={`/${lang}/programs`}>{t.chooseCourses} →</Link></header>
    <section className="class-catalog"><div className="class-section-heading"><h2>{t.joinedTitle}</h2></div>{lists.joined.length ? <div className="class-card-grid">{lists.joined.map(item => card(item))}</div> : <div className="class-empty"><p>{t.noJoined}</p><Link className="primary-button" href={`/${lang}/programs`}>{t.chooseCourses} →</Link></div>}</section>
    {notice && <p className="class-notice">{notice}</p>}<Styles/></section>;
}

function Styles() { return <style>{`
  .smartlingo-class-studio{width:min(1328px,100%);margin:0 auto;padding:74px clamp(20px,4vw,56px) 110px;color:var(--ink)}.smartlingo-class-studio *{min-width:0;overflow-wrap:break-word}.class-studio-intro{max-width:930px}.class-studio-intro h1,.class-detail-hero h1{margin:8px 0 22px;font:600 clamp(42px,5.8vw,76px)/1.02 "Iowan Old Style","Noto Serif SC",Georgia,serif}.class-studio-intro>p:last-of-type,.class-detail-hero>div>p:last-child{max-width:76ch;color:var(--muted);font-size:17px;line-height:1.72}.class-choose-courses{margin-top:20px}.class-catalog{margin-top:70px}.class-section-heading h2,.class-detail-grid h2{margin:8px 0 18px;font:600 clamp(29px,3.5vw,46px)/1.08 "Iowan Old Style","Noto Serif SC",Georgia,serif}.class-section-heading p{color:var(--muted)}.class-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:28px}.class-card-grid article,.class-detail-grid>article{padding:26px;display:flex;flex-direction:column;border:1px solid #a7d6c4;border-radius:18px;background:#f1fbf6}.class-card-meta{display:flex;justify-content:space-between;gap:12px}.class-card-meta span,.class-detail-grid article>span{color:var(--vermillion);font-size:11px;font-weight:900;letter-spacing:.1em}.class-card-meta b{padding:5px 8px;border-radius:999px;background:#dff4e9;color:#08725e;font-size:10px}.class-card-grid h3{margin:20px 0 11px;font-size:27px}.class-card-grid p,.class-detail-grid p{color:var(--muted);line-height:1.65}.class-card-grid ul,.class-detail-grid ul{padding:0;display:grid;gap:8px;list-style:none;color:var(--muted)}.class-card-grid small{margin-top:auto;padding-top:20px;color:var(--muted)}.class-card-grid a,.class-card-grid button{width:100%;margin-top:18px;text-align:center}.class-empty{margin-top:26px;padding:30px;border:1px dashed rgba(18,32,42,.25);border-radius:16px;color:var(--muted)}.class-empty p{margin:0}.class-empty a{margin-top:16px}.class-back{display:inline-flex;margin-bottom:36px;color:var(--jade);font-weight:850}.class-detail-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:50px;align-items:end}.class-detail-hero dl{margin:0;padding:22px;border-radius:16px;background:#e7eee9}.class-detail-hero dl div{padding:10px 0;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid rgba(18,32,42,.12)}.class-detail-hero dl div:last-child{border:0}.class-detail-hero dd{margin:0;text-align:right;font-weight:900}.class-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:48px}.class-detail-grid .course-classroom-tile,.class-placement-card{grid-column:1/-1}.class-subscribe-card{background:#123f35!important;color:#fff}.class-subscribe-card p{color:#c5d8d1!important}.class-edit-course{margin-top:22px}.course-edit-form{margin-top:20px;padding:24px;display:grid;gap:14px;border-radius:18px;background:#e7eee9}.course-edit-form label{display:grid;gap:7px;font-weight:800}.course-edit-form input,.course-edit-form textarea{padding:12px;border:1px solid #9baaa4;border-radius:9px;font:16px inherit}.course-edit-form textarea{min-height:110px}.course-edit-form div{display:flex;gap:10px}.course-edit-form button{padding:11px 18px;border:0;border-radius:8px;background:#123f35;color:#fff}.class-notice{margin-top:24px;padding:15px;border-radius:10px;background:#123f35;color:#fff}.class-auth-required{min-height:62vh;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.class-auth-required h1{font-size:clamp(42px,6vw,76px)}.class-loading{min-height:54vh;display:grid;place-items:center}.class-skill-launcher{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:22px}.class-skill-launcher a{padding:16px 12px;display:grid;place-items:center;gap:7px;border:1px solid #a8cdbf;border-radius:15px;background:#fff;color:#123f35;text-align:center;text-decoration:none;transition:transform .16s ease,box-shadow .16s ease}.class-skill-launcher a:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(18,63,53,.12)}.class-skill-launcher i{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#123f35;color:#6be0bc;font-style:normal;font-weight:900}.class-skill-launcher strong{font-size:17px}.class-skill-launcher small{color:#08725e;font-size:12px;font-weight:850}.class-learning-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px}@media(max-width:900px){.class-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.class-detail-hero{grid-template-columns:1fr}.class-skill-launcher{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.class-card-grid,.class-detail-grid{grid-template-columns:1fr}.smartlingo-class-studio{padding-top:48px}.class-skill-launcher{grid-template-columns:repeat(2,minmax(0,1fr))}.class-learning-actions a{width:100%}}
`}</style>; }
