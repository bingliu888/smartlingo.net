"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SMARTLINGO_COURSE_PACKAGES, type SmartLingoPackageTier } from "../lib/smartlingo-course-packages";
import { CourseClassroomTile } from "./CourseClassroomTile";
import { CoursePaymentActions } from "./CoursePaymentActions";

type Lang = "en" | "zh";
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
    eyebrow: "SMARTLINGO COURSES", title: "Three clear levels. One free first month.",
    intro: "Choose Beginner, Intermediate, or Advanced. Every course includes an A/V Webinar teaching room and a group-audio practice room.",
    signIn: "Sign in to view courses", joinedTitle: "My courses", noJoined: "You have not started a course yet.",
    availableTitle: "Available courses", availableIntro: "Fixed monthly plans; members cannot create courses or set fees.",
    noAvailable: "No additional courses are available.", joined: "Subscribed", subscribe: "Start free month", subscribing: "Starting…",
    open: "Open course", learners: "learners", firstMonth: "First month free", perMonth: "per month",
    back: "All courses", courseAdmin: "SmartLingo course", schedule: "Schedule", price: "Monthly price",
    package: "Course package", classroom: "Two course rooms", classroomCopy: "Use the Webinar teaching room for administrator and co-host lessons, and the free group-audio practice room for student speaking discussion.",
    fiveSkillsTitle: "Learn five skills", fiveSkillsBody: "Start vocabulary, reading, writing, listening, and dialogue directly—no placement test required.",
    dailyLearning: "Start five-skill learning", calendar: "Learning calendar",
    edit: "Edit course", save: "Save", cancel: "Cancel", summary: "Description", joinFailed: "The subscription could not be started. Please try again.",
  },
  zh: {
    eyebrow: "SmartLingo 课程", title: "三级课程，首月免费。",
    intro: "选择初期、中级或高级课程。每门课程都配有音视频 Webinar 教课室和小组语音练习室。",
    signIn: "登录后查看课程", joinedTitle: "我的课程", noJoined: "您尚未开始任何课程。",
    availableTitle: "可订阅课程", availableIntro: "固定月费；会员不能创建课程或自行定价。",
    noAvailable: "目前没有其他可订阅课程。", joined: "已订阅", subscribe: "开始免费首月", subscribing: "正在开通…",
    open: "进入课程", learners: "位学员", firstMonth: "第一个月免费", perMonth: "每月",
    back: "返回全部课程", courseAdmin: "SmartLingo 官方课程", schedule: "课程安排", price: "每月价格",
    package: "课程内容", classroom: "两个课程房间", classroomCopy: "管理员和协办主持在 Webinar 教课室授课；学员可在免费的 Group Audio 练习室讨论和练习口语。",
    fiveSkillsTitle: "学习五项技能", fiveSkillsBody: "直接开始词汇、阅读、写作、听力和对话训练，无需分级测试。",
    dailyLearning: "开始五项技能学习", calendar: "学习日历",
    edit: "编辑课程", save: "保存", cancel: "取消", summary: "课程说明", joinFailed: "暂时无法开通订阅，请稍后重试。",
  },
} as const;

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

export function ClassStudio({ lang, initialClassId, initialTargetLanguage }: { lang: Lang; initialClassId?: string; initialInviteCode?: string; initialTargetLanguage?: string }) {
  const t = COPY[lang];
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

  useEffect(() => { void load().catch(error => setNotice(error instanceof Error ? error.message : "Unable to load courses")); }, [load]);

  const lists = useMemo(() => {
    if (!context) return { joined: [] as LanguageClass[], available: [] as LanguageClass[] };
    const prioritize = (items: LanguageClass[]) => initialTargetLanguage
      ? [...items].sort((a, b) => Number(b.targetLanguage === initialTargetLanguage) - Number(a.targetLanguage === initialTargetLanguage)) : items;
    return { joined: prioritize(context.joinedClasses || []), available: prioritize(context.availableClasses || []) };
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

  function card(item: LanguageClass, joined: boolean) {
    const plan = SMARTLINGO_COURSE_PACKAGES.find(value => value.tier === item.packageTier);
    return <article className="official" key={item.id}>
      <div className="class-card-meta"><span>{item.targetLanguage.toUpperCase()} · {item.level}</span>{joined && <b>{t.joined}</b>}</div>
      <h3>{item.title}</h3><p>{item.summary}</p>
      {plan && <ul>{plan.features[lang].map(feature => <li key={feature}>✓ {feature}</li>)}</ul>}
      <small>{money(item.priceCents, item.currency)} {t.perMonth} · {t.firstMonth} · {item.enrollmentCount}/{item.capacity} {t.learners}</small>
      <Link className={joined ? "secondary-button" : "primary-button"} href={`/${lang}/classes/${item.id}`}>{joined ? t.open : (lang === "zh" ? "查看课程与付款" : "View course and payment")} →</Link>
    </article>;
  }

  if (unauthorized) return <section className="smartlingo-class-studio class-auth-required"><p className="section-kicker">{t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p><Link className="primary-button" href={`/${lang}/auth/login?returnTo=${encodeURIComponent(initialClassId ? `/${lang}/classes/${initialClassId}` : `/${lang}/classes`)}`}>{t.signIn} →</Link><Styles/></section>;
  if (!context || (initialClassId && !detail)) return <section className="smartlingo-class-studio class-loading">SmartLingo…<Styles/></section>;

  if (detail) {
    const item = detail.class;
    const plan = SMARTLINGO_COURSE_PACKAGES.find(value => value.tier === item.packageTier);
    const joined = detail.membership?.status === "active";
    return <section className="smartlingo-class-studio">
      <Link className="class-back" href={`/${lang}/classes`}>← {t.back}</Link>
      <div className="class-detail-hero"><div><p className="section-kicker">{item.targetLanguage.toUpperCase()} · {item.level}</p><h1>{item.title}</h1><p>{item.summary}</p></div>
        <dl><div><dt>{t.courseAdmin}</dt><dd>{item.ownerName}</dd></div><div><dt>{t.schedule}</dt><dd>{item.schedule}</dd></div><div><dt>{t.price}</dt><dd>{money(item.priceCents)} / {lang === "zh" ? "月" : "month"}</dd></div><div><dt>{t.firstMonth}</dt><dd>{item.trialDays} {lang === "zh" ? "天" : "days"}</dd></div></dl></div>
      {detail.canManage && <button className="secondary-button class-edit-course" onClick={() => setEditing(true)}>✎ {t.edit}</button>}
      {editing && <form className="course-edit-form" onSubmit={saveCourse}><label>{lang === "zh" ? "课程名称" : "Course title"}<input name="title" defaultValue={item.title}/></label><label>{t.summary}<textarea name="summary" defaultValue={item.summary}/></label><label>{t.schedule}<input name="schedule" defaultValue={item.schedule}/></label><div><button disabled={busy}>{t.save}</button><button type="button" onClick={() => setEditing(false)}>{t.cancel}</button></div></form>}
      <div className="class-detail-grid">
        <article><span>{plan?.name[lang] || item.packageTier?.toUpperCase()}</span><h2>{t.package}</h2><ul>{plan?.features[lang].map(feature => <li key={feature}>✓ {feature}</li>)}</ul></article>
        <article><span>WEBINAR + GROUP AUDIO</span><h2>{t.classroom}</h2><p>{t.classroomCopy}</p></article>
        {!joined && !detail.canManage && <article className="class-subscribe-card"><span>{t.firstMonth}</span><h2>{money(item.priceCents)} / {t.perMonth}</h2><p>{lang === "zh" ? "选择信用卡订阅（符合资格者首月免费），或使用加密货币购买本课程一个月。" : "Choose a card subscription (first month free when eligible) or purchase one month of this course with crypto."}</p><CoursePaymentActions lang={lang} classId={item.id} priceCents={item.priceCents} firstMonthFree /></article>}
        {joined && <article className="class-placement-card"><span>5 SKILLS</span><h2>{t.fiveSkillsTitle}</h2><p>{t.fiveSkillsBody}</p><ul><li>✓ {lang === "zh" ? "词汇" : "Vocabulary"}</li><li>✓ {lang === "zh" ? "阅读" : "Reading"}</li><li>✓ {lang === "zh" ? "写作" : "Writing"}</li><li>✓ {lang === "zh" ? "听力" : "Listening"}</li><li>✓ {lang === "zh" ? "对话" : "Dialogue"}</li></ul><div className="class-learning-actions"><Link className="primary-button" href={`/${lang}/classes/${item.id}/learn`}>{t.dailyLearning} →</Link><Link className="secondary-button" href={`/${lang}/learning-log`}>{t.calendar} →</Link></div></article>}
        {(joined || detail.canManage) && <CourseClassroomTile classId={item.id} lang={lang}/>}
      </div>{notice && <p className="class-notice">{notice}</p>}<Styles/>
    </section>;
  }

  return <section className="smartlingo-class-studio" data-layout-ready="true"><header className="class-studio-intro"><p className="section-kicker">{t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p></header>
    <section className="class-catalog"><div className="class-section-heading"><h2>{t.joinedTitle}</h2></div>{lists.joined.length ? <div className="class-card-grid">{lists.joined.map(item => card(item, true))}</div> : <p className="class-empty">{t.noJoined}</p>}</section>
    <section className="class-catalog"><div className="class-section-heading"><h2>{t.availableTitle}</h2><p>{t.availableIntro}</p></div>{lists.available.length ? <div className="class-card-grid">{lists.available.map(item => card(item, false))}</div> : <p className="class-empty">{t.noAvailable}</p>}</section>
    {notice && <p className="class-notice">{notice}</p>}<Styles/></section>;
}

function Styles() { return <style>{`
  .smartlingo-class-studio{width:min(1328px,100%);margin:0 auto;padding:74px clamp(20px,4vw,56px) 110px;color:var(--ink)}.smartlingo-class-studio *{min-width:0;overflow-wrap:break-word}.class-studio-intro{max-width:930px}.class-studio-intro h1,.class-detail-hero h1{margin:8px 0 22px;font:600 clamp(42px,5.8vw,76px)/1.02 "Iowan Old Style","Noto Serif SC",Georgia,serif}.class-studio-intro>p:last-child,.class-detail-hero>div>p:last-child{max-width:76ch;color:var(--muted);font-size:17px;line-height:1.72}.class-catalog{margin-top:70px}.class-section-heading h2,.class-detail-grid h2{margin:8px 0 18px;font:600 clamp(29px,3.5vw,46px)/1.08 "Iowan Old Style","Noto Serif SC",Georgia,serif}.class-section-heading p{color:var(--muted)}.class-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:28px}.class-card-grid article,.class-detail-grid>article{padding:26px;display:flex;flex-direction:column;border:1px solid #a7d6c4;border-radius:18px;background:#f1fbf6}.class-card-meta{display:flex;justify-content:space-between;gap:12px}.class-card-meta span,.class-detail-grid article>span{color:var(--vermillion);font-size:11px;font-weight:900;letter-spacing:.1em}.class-card-meta b{padding:5px 8px;border-radius:999px;background:#dff4e9;color:#08725e;font-size:10px}.class-card-grid h3{margin:20px 0 11px;font-size:27px}.class-card-grid p,.class-detail-grid p{color:var(--muted);line-height:1.65}.class-card-grid ul,.class-detail-grid ul{padding:0;display:grid;gap:8px;list-style:none;color:var(--muted)}.class-card-grid small{margin-top:auto;padding-top:20px;color:var(--muted)}.class-card-grid a,.class-card-grid button{width:100%;margin-top:18px;text-align:center}.class-empty{margin-top:26px;padding:30px;border:1px dashed rgba(18,32,42,.25);border-radius:16px;color:var(--muted)}.class-back{display:inline-flex;margin-bottom:36px;color:var(--jade);font-weight:850}.class-detail-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:50px;align-items:end}.class-detail-hero dl{margin:0;padding:22px;border-radius:16px;background:#e7eee9}.class-detail-hero dl div{padding:10px 0;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid rgba(18,32,42,.12)}.class-detail-hero dl div:last-child{border:0}.class-detail-hero dd{margin:0;text-align:right;font-weight:900}.class-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:48px}.class-detail-grid .course-classroom-tile,.class-placement-card{grid-column:1/-1}.class-subscribe-card{background:#123f35!important;color:#fff}.class-subscribe-card p{color:#c5d8d1!important}.class-edit-course{margin-top:22px}.course-edit-form{margin-top:20px;padding:24px;display:grid;gap:14px;border-radius:18px;background:#e7eee9}.course-edit-form label{display:grid;gap:7px;font-weight:800}.course-edit-form input,.course-edit-form textarea{padding:12px;border:1px solid #9baaa4;border-radius:9px;font:16px inherit}.course-edit-form textarea{min-height:110px}.course-edit-form div{display:flex;gap:10px}.course-edit-form button{padding:11px 18px;border:0;border-radius:8px;background:#123f35;color:#fff}.class-notice{margin-top:24px;padding:15px;border-radius:10px;background:#123f35;color:#fff}.class-auth-required{min-height:62vh;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.class-auth-required h1{font-size:clamp(42px,6vw,76px)}.class-loading{min-height:54vh;display:grid;place-items:center}.class-learning-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px}@media(max-width:900px){.class-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.class-detail-hero{grid-template-columns:1fr}}@media(max-width:620px){.class-card-grid,.class-detail-grid{grid-template-columns:1fr}.smartlingo-class-studio{padding-top:48px}.class-learning-actions a{width:100%}}
`}</style>; }
