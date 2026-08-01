"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { quoteClassOrder } from "../lib/smartlingo-commerce";

type Lang = "en" | "zh";
type LanguagePath = {
  id: string;
  targetLanguage: string;
  level: string;
  titleEn: string;
  titleZh: string;
  version: string;
};
type LanguageClass = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  pathId: string;
  pathTitleEn: string;
  pathTitleZh: string;
  ownerRole: "teacher" | "coordinator";
  title: string;
  summary: string;
  targetLanguage: string;
  level: string;
  schedule: string;
  status: string;
  visibility: string;
  priceCents: number;
  currency: string;
  capacity: number;
  enrollmentCount: number;
  classKind?: "official_language" | "member_created" | string;
  membershipRole?: string | null;
  membershipStatus?: string | null;
  isJoined?: boolean;
  isOwner?: boolean;
  canJoin?: boolean;
};
type Context = {
  currentUser: { id: string; displayName: string };
  member: { canCreatePrivateClass: boolean; allowedOwnerRoles: string[] };
  paths: LanguagePath[];
  classes: LanguageClass[];
  joinedClasses?: LanguageClass[];
  availableClasses?: LanguageClass[];
  createdClasses?: LanguageClass[];
  connectedAccount: {
    onboardingStatus: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    requirementsDue: string[];
  };
  paymentMode: string;
};
type Detail = {
  class: LanguageClass;
  currentUserId: string;
  isOwner: boolean;
  membership: { role: string; status: string } | null;
  placement: {
    id: string;
    status: string;
    entryMode: string;
    overallScore: number | null;
    recommendedLevel: string | null;
  } | null;
  paymentMode: string;
};

const COPY = {
  en: {
    eyebrow: "MEMBER-LED LANGUAGE LEARNING",
    title: "Create a class. Learn as a community.",
    intro: "Every signed-in SmartLingo member can open a private language class as a teacher or coordinator. Bring learners together for daily practice, community discussion, AI Guru guidance, and live audio conversation.",
    signIn: "Sign in to enter Class Studio",
    yourClasses: "Your joined classes",
    noClasses: "You have not created or joined a class yet.",
    createdTitle: "Classes you created",
    createdIntro: "Private and reviewed classes where you are the teacher or coordinator.",
    noCreated: "You have not created a class yet.",
    discoverTitle: "Find your next learning community",
    discoverIntro: "Browse official language communities and public classes created by teachers or coordinators. A language can have many classes for different levels, schedules, and learning goals.",
    noAvailable: "No additional classes are available right now.",
    officialCommunity: "Official language community",
    memberClass: "Teacher-created class",
    joined: "Joined",
    join: "Join free community",
    joining: "Joining…",
    joinFailed: "This class could not be joined yet. Please try again.",
    free: "Free",
    createTitle: "Open a private class",
    createIntro: "Choose a published SmartLingo path, set your schedule and price, then invite your learners. A public directory listing requires a later review.",
    path: "Language path",
    role: "Your role",
    teacher: "Teacher",
    coordinator: "Coordinator",
    className: "Class name",
    summary: "Class description",
    schedule: "Schedule",
    seats: "Learner capacity",
    price: "Price per learner (USD)",
    create: "Create private class",
    owner: "Class owner",
    learners: "learners",
    open: "Open class",
    private: "Private",
    review: "In review",
    public: "Public",
    payoutTitle: "Simple class economics",
    firstPayment: "A learner's first payment for this class receives 15% off.",
    ownerShare: "The class owner receives 70% of the discounted pre-tax amount; SmartLingo receives 30%.",
    noReferral: "Class payments never create introducer reward points. Those points apply only to successful SmartLingo platform subscription charges.",
    example: "Example on a $100 class",
    discounted: "First payment",
    ownerGets: "Owner receives",
    platformGets: "Platform receives",
    connectReady: "Stripe Connect ready",
    connectNeeded: "Stripe Connect onboarding required before accepting class payments",
    checkoutDisabled: "No class payment is charged from this foundation screen.",
    back: "All classes",
    classRole: "Owner role",
    classPath: "Learning path",
    classSchedule: "Schedule",
    classPrice: "Class price",
    community: "Class community",
    communityNote: "This private class is the home for peer practice, social learning, AI Guru, and live audio. Invitations and checkout are enabled only after their verified workflows are complete.",
    officialCommunityNote: "This official language community brings together daily practice, peer discussion, AI Guru guidance, and live audio. Members may also join additional teacher-created classes for the same language.",
    placementTitle: "Start with your level",
    placementBody: "Choose Beginner, Intermediate, or Advanced, or take the approximately 30-minute adaptive five-skill placement check. You can pause, resume, or skip an item.",
    startPlacement: "Start placement",
    resumePlacement: "Resume placement",
    dailyLearning: "Daily five-skill learning",
    learningCalendar: "Learning calendar",
    requestReview: "Request public directory review",
    reviewSent: "This class is now waiting for public directory review.",
  },
  zh: {
    eyebrow: "会员自主语言班",
    title: "创建班级，在社区中一起学习。",
    intro: "每位已登录的 SmartLingo 会员都可作为教师或协调员创建私有语言班，带领学员进行每日练习、社区交流、人工智能导师辅导与实时语音对话。",
    signIn: "登录后进入班级工作室",
    yourClasses: "我已加入的班级",
    noClasses: "您还没有创建或加入班级。",
    createdTitle: "我创建的班级",
    createdIntro: "您作为教师或协调员创建的私有班级及送审班级。",
    noCreated: "您还没有创建班级。",
    discoverTitle: "寻找下一个学习社区",
    discoverIntro: "浏览官方语言社区，以及教师或协调员创建的公开班级。同一种语言可以有多个班级，分别服务不同等级、时间安排与学习目标。",
    noAvailable: "目前没有其他可加入班级。",
    officialCommunity: "官方语言社区",
    memberClass: "老师创建的班级",
    joined: "已加入",
    join: "免费加入社区",
    joining: "正在加入…",
    joinFailed: "暂时无法加入此班级，请稍后重试。",
    free: "免费",
    createTitle: "创建私有班级",
    createIntro: "选择 SmartLingo 已发布的语言路径，设置学习时间与价格，然后邀请学员。加入公开班级目录须另行审核。",
    path: "语言路径",
    role: "您的角色",
    teacher: "教师",
    coordinator: "协调员",
    className: "班级名称",
    summary: "班级说明",
    schedule: "学习时间",
    seats: "学员名额",
    price: "每位学员价格（美元）",
    create: "创建私有班级",
    owner: "开班人",
    learners: "位学员",
    open: "进入班级",
    private: "私有",
    review: "审核中",
    public: "公开",
    payoutTitle: "清晰的班级分账",
    firstPayment: "同一学员首次支付本班费用可享受八五折。",
    ownerShare: "优惠后税前金额的 70% 归班级开办人，30% 归 SmartLingo 平台。",
    noReferral: "班级付款永不产生介绍人积分；介绍人积分仅来自 SmartLingo 平台订阅的成功收费。",
    example: "以原价 100 美元的班级为例",
    discounted: "首次付款",
    ownerGets: "开班人获得",
    platformGets: "平台获得",
    connectReady: "Stripe Connect 已就绪",
    connectNeeded: "收取班级费用前须完成 Stripe Connect 入驻",
    checkoutDisabled: "本基础页面不会发起班级收费。",
    back: "返回全部班级",
    classRole: "开班角色",
    classPath: "学习路径",
    classSchedule: "学习时间",
    classPrice: "班级价格",
    community: "班级社区",
    communityNote: "私有班级将承载同伴练习、社交学习、人工智能导师与实时语音。邀请和结账功能只会在相应的验证流程完成后开放。",
    officialCommunityNote: "官方语言社区连接每日训练、同伴交流、人工智能导师与实时语音。会员还可加入同一语言下由老师创建的不同主题班级。",
    placementTitle: "先确定您的起点",
    placementBody: "可直接选择初级、中级或高级，也可参加约 30 分钟的五项技能自适应分级测评；测评支持暂停、继续和跳过。",
    startPlacement: "开始分级",
    resumePlacement: "继续分级",
    dailyLearning: "每日五项技能学习",
    learningCalendar: "学习日历",
    requestReview: "申请加入公开班级目录",
    reviewSent: "本班已进入公开目录审核流程。",
  },
} as const;

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function visibilityLabel(lang: Lang, visibility: string) {
  if (visibility === "public") return COPY[lang].public;
  if (visibility === "review") return COPY[lang].review;
  return COPY[lang].private;
}

export function ClassStudio({
  lang,
  initialClassId,
  initialInviteCode,
  initialTargetLanguage,
}: {
  lang: Lang;
  initialClassId?: string;
  initialInviteCode?: string;
  initialTargetLanguage?: string;
}) {
  const t = COPY[lang];
  const [context, setContext] = useState<Context | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joiningClassId, setJoiningClassId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pathId, setPathId] = useState("");
  const [ownerRole, setOwnerRole] = useState<"teacher" | "coordinator">("coordinator");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [schedule, setSchedule] = useState(lang === "zh" ? "每周一次线上学习" : "Weekly online session");
  const [capacity, setCapacity] = useState("30");
  const [price, setPrice] = useState("0");

  const returnPath = initialClassId
    ? `/${lang}/classes/${encodeURIComponent(initialClassId)}${initialInviteCode ? `?invite=${encodeURIComponent(initialInviteCode)}` : ""}`
    : `/${lang}/classes`;
  const signInUrl = `/${lang}/auth/login?returnTo=${encodeURIComponent(returnPath)}`;

  const loadContext = useCallback(async () => {
    const response = await fetch("/api/classes", { cache: "no-store" });
    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load classes");
    setContext(result);
    setPathId(current => current
      || result.paths?.find((path: LanguagePath) => path.targetLanguage === initialTargetLanguage)?.id
      || result.paths?.[0]?.id
      || "");
    setUnauthorized(false);
  }, [initialTargetLanguage]);

  const loadDetail = useCallback(async () => {
    if (!initialClassId) return;
    const response = await fetch(`/api/classes/${encodeURIComponent(initialClassId)}`, { cache: "no-store" });
    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load class");
    setDetail(result);
  }, [initialClassId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([loadContext(), loadDetail()]).catch(error => {
        setNotice(error instanceof Error ? error.message : "Unable to load Class Studio");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadContext, loadDetail]);

  const sample = useMemo(() => quoteClassOrder({
    subtotalCents: 10_000,
    hasPriorPaidOrderForLearnerAndClass: false,
  }), []);
  const connectReady = context?.connectedAccount.onboardingStatus === "ready"
    && context.connectedAccount.chargesEnabled
    && context.connectedAccount.payoutsEnabled;

  const classLists = useMemo(() => {
    if (!context) return { joined: [] as LanguageClass[], created: [] as LanguageClass[], available: [] as LanguageClass[] };
    const unique = (items: LanguageClass[]) => [...new Map(items.map(item => [item.id, item])).values()];
    const created = unique(context.createdClasses ?? context.classes.filter(item => item.isOwner || item.ownerUserId === context.currentUser.id));
    const createdIds = new Set(created.map(item => item.id));
    const joined = unique(context.joinedClasses ?? context.classes.filter(item => item.isJoined || item.membershipStatus === "active"))
      .filter(item => !createdIds.has(item.id));
    const joinedIds = new Set([...joined, ...created].map(item => item.id));
    const available = unique(context.availableClasses ?? context.classes.filter(item => !joinedIds.has(item.id)))
      .filter(item => !joinedIds.has(item.id));
    const prioritize = (items: LanguageClass[]) => initialTargetLanguage
      ? [...items].sort((left, right) => Number(right.targetLanguage === initialTargetLanguage) - Number(left.targetLanguage === initialTargetLanguage))
      : items;
    return { joined: prioritize(joined), created: prioritize(created), available: prioritize(available) };
  }, [context, initialTargetLanguage]);

  async function createClass() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pathId,
          ownerRole,
          title,
          summary,
          schedule,
          capacity: Number(capacity),
          priceCents: Math.round(Number(price) * 100),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to create class");
      window.location.assign(`/${lang}/classes/${encodeURIComponent(result.id)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create class");
    } finally {
      setBusy(false);
    }
  }

  async function joinClass(item: LanguageClass) {
    setJoiningClassId(item.id);
    setNotice("");
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(item.id)}/enroll`, { method: "POST" });
      if (!response.ok) throw new Error(t.joinFailed);
      window.location.assign(item.classKind === "official_language"
        ? `/${lang}/classes/${encodeURIComponent(item.id)}/placement`
        : `/${lang}/classes/${encodeURIComponent(item.id)}`);
    } catch {
      setNotice(t.joinFailed);
      setJoiningClassId(null);
    }
  }

  async function requestReview() {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(detail.class.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request_public_directory" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to request review");
      setNotice(t.reviewSent);
      await loadDetail();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to request review");
    } finally {
      setBusy(false);
    }
  }

  function classCard(item: LanguageClass, mode: "joined" | "created" | "available") {
    const official = item.classKind === "official_language";
    const action = mode === "available" && item.canJoin && item.priceCents === 0
      ? <button className="primary-button" type="button" onClick={() => joinClass(item)} disabled={joiningClassId === item.id}>{joiningClassId === item.id ? t.joining : `${t.join} →`}</button>
      : <Link className="secondary-button" href={`/${lang}/classes/${encodeURIComponent(item.id)}`}>{t.open} →</Link>;
    return (
      <article className={official ? "official" : "member-created"} key={item.id}>
        <div className="class-card-meta">
          <span>{item.targetLanguage.toUpperCase()} · {item.level} · {official ? t.officialCommunity : t.memberClass}</span>
          {mode !== "available" && <b>{t.joined}</b>}
        </div>
        <h3>{item.title}</h3>
        <p>{item.summary || (lang === "zh" ? item.pathTitleZh : item.pathTitleEn)}</p>
        <small>{item.ownerName} · {item.enrollmentCount}/{item.capacity} {t.learners} · {item.priceCents === 0 ? t.free : money(item.priceCents, item.currency)}</small>
        {action}
      </article>
    );
  }

  if (unauthorized) {
    return (
      <section className="smartlingo-class-studio class-auth-required">
        <p className="section-kicker">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <Link className="primary-button" href={signInUrl}>{t.signIn} →</Link>
        <ClassStyles />
      </section>
    );
  }

  if (!context || (initialClassId && !detail && !notice)) {
    return <section className="smartlingo-class-studio class-loading" aria-live="polite">SmartLingo…<ClassStyles /></section>;
  }

  if (initialClassId && detail) {
    const item = detail.class;
    return (
      <section className="smartlingo-class-studio">
        <Link className="class-back" href={`/${lang}/classes`}>← {t.back}</Link>
        <div className="class-detail-hero">
          <div>
            <p className="section-kicker">{item.targetLanguage.toUpperCase()} · {item.level}</p>
            <h1>{item.title}</h1>
            <p>{item.summary || (item.classKind === "official_language" ? t.officialCommunityNote : t.communityNote)}</p>
          </div>
          <dl>
            <div><dt>{t.owner}</dt><dd>{item.ownerName}</dd></div>
            <div><dt>{t.classRole}</dt><dd>{item.ownerRole === "teacher" ? t.teacher : t.coordinator}</dd></div>
            <div><dt>{t.classPath}</dt><dd>{lang === "zh" ? item.pathTitleZh : item.pathTitleEn}</dd></div>
            <div><dt>{t.classSchedule}</dt><dd>{item.schedule}</dd></div>
            <div><dt>{t.classPrice}</dt><dd>{money(item.priceCents, item.currency)}</dd></div>
          </dl>
        </div>
        <div className="class-detail-grid">
          {item.classKind === "official_language" && detail.membership?.status === "active" && (
            <article className="class-placement-card" data-layout-fill>
              <span>{detail.placement?.status === "completed" ? t.dailyLearning : t.placementTitle}</span>
              <h2>{detail.placement?.status === "completed" ? t.dailyLearning : t.placementTitle}</h2>
              <p>{t.placementBody}</p>
              <div className="class-learning-actions">
                {detail.placement?.status !== "completed" && (
                  <Link className="primary-button" href={`/${lang}/classes/${encodeURIComponent(item.id)}/placement`}>
                    {detail.placement?.status === "paused" || detail.placement?.status === "in_progress" ? t.resumePlacement : t.startPlacement} →
                  </Link>
                )}
                {detail.placement?.status === "completed" && (
                  <Link className="primary-button" href={`/${lang}/classes/${encodeURIComponent(item.id)}/learn`}>{t.dailyLearning} →</Link>
                )}
                <Link className="secondary-button" href={`/${lang}/learning-log`}>{t.learningCalendar} →</Link>
              </div>
            </article>
          )}
          <article>
            <span>{visibilityLabel(lang, item.visibility)}</span>
            <h2>{t.community}</h2>
            <p>{item.classKind === "official_language" ? t.officialCommunityNote : t.communityNote}</p>
            <small>{item.enrollmentCount}/{item.capacity} {t.learners}</small>
          </article>
          <article className="class-payment-card">
            <span>70 / 30</span>
            <h2>{t.payoutTitle}</h2>
            <p>{t.firstPayment}</p>
            <p>{t.ownerShare}</p>
            <p>{t.noReferral}</p>
          </article>
        </div>
        {detail.isOwner && item.visibility === "private" && (
          <button className="secondary-button class-review-button" onClick={requestReview} disabled={busy}>{t.requestReview}</button>
        )}
        {notice && <p className="class-notice" aria-live="polite">{notice}</p>}
        <ClassStyles />
      </section>
    );
  }

  return (
    <section className="smartlingo-class-studio">
      <header className="class-studio-intro">
        <p className="section-kicker">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </header>

      <section className="class-catalog">
        <div className="class-section-heading"><p className="section-kicker">SMARTLINGO</p><h2>{t.yourClasses}</h2></div>
        {classLists.joined.length ? (
          <div className="class-card-grid">
            {classLists.joined.map(item => classCard(item, "joined"))}
          </div>
        ) : <p className="class-empty">{t.noClasses}</p>}
      </section>

      <section className="class-catalog class-created-catalog">
        <div className="class-section-heading"><p className="section-kicker">{lang === "zh" ? "开班工作室" : "CLASS STUDIO"}</p><h2>{t.createdTitle}</h2><p>{t.createdIntro}</p></div>
        {classLists.created.length ? <div className="class-card-grid">{classLists.created.map(item => classCard(item, "created"))}</div> : <p className="class-empty">{t.noCreated}</p>}
      </section>

      <section className="class-catalog class-available-catalog">
        <div className="class-section-heading"><p className="section-kicker">{lang === "zh" ? "班级目录" : "CLASS DIRECTORY"}</p><h2>{t.discoverTitle}</h2><p>{t.discoverIntro}</p></div>
        {classLists.available.length ? <div className="class-card-grid">{classLists.available.map(item => classCard(item, "available"))}</div> : <p className="class-empty">{t.noAvailable}</p>}
      </section>

      <section className="class-economics" aria-labelledby="class-economics-title">
        <div>
          <p className="section-kicker">15% · 70 / 30</p>
          <h2 id="class-economics-title">{t.payoutTitle}</h2>
          <p>{t.firstPayment}</p>
          <p>{t.ownerShare}</p>
          <p>{t.noReferral}</p>
          <small>{connectReady ? t.connectReady : t.connectNeeded}. {t.checkoutDisabled}</small>
        </div>
        <dl>
          <div><dt>{t.example}</dt><dd>{money(sample.subtotalCents)}</dd></div>
          <div><dt>{t.discounted}</dt><dd>{money(sample.discountedPreTaxCents)}</dd></div>
          <div><dt>{t.ownerGets}</dt><dd>{money(sample.ownerShareCents)}</dd></div>
          <div><dt>{t.platformGets}</dt><dd>{money(sample.platformFeeCents)}</dd></div>
        </dl>
      </section>

      <section className="class-create-panel">
        <div>
          <p className="section-kicker">{t.createTitle}</p>
          <h2>{t.createTitle}</h2>
          <p>{t.createIntro}</p>
        </div>
        <form onSubmit={event => event.preventDefault()}>
          <label>{t.path}
            <select value={pathId} onChange={event => setPathId(event.target.value)}>
              {context.paths.map(path => <option key={path.id} value={path.id}>{lang === "zh" ? path.titleZh : path.titleEn} · {path.level}</option>)}
            </select>
          </label>
          <label>{t.role}
            <select value={ownerRole} onChange={event => setOwnerRole(event.target.value as "teacher" | "coordinator")}>
              <option value="teacher">{t.teacher}</option>
              <option value="coordinator">{t.coordinator}</option>
            </select>
          </label>
          <label>{t.className}<input value={title} maxLength={100} onChange={event => setTitle(event.target.value)} /></label>
          <label>{t.summary}<textarea value={summary} maxLength={800} onChange={event => setSummary(event.target.value)} /></label>
          <label>{t.schedule}<input value={schedule} maxLength={120} onChange={event => setSchedule(event.target.value)} /></label>
          <div className="class-form-pair">
            <label>{t.seats}<input type="number" min="1" max="1000" value={capacity} onChange={event => setCapacity(event.target.value)} /></label>
            <label>{t.price}<input type="number" min="0" max="100000" step="0.01" value={price} onChange={event => setPrice(event.target.value)} /></label>
          </div>
          <button className="primary-button" type="button" onClick={createClass} disabled={busy || !pathId || !title.trim()}>{t.create} →</button>
        </form>
      </section>
      {notice && <p className="class-notice" aria-live="polite">{notice}</p>}
      <ClassStyles />
    </section>
  );
}

function ClassStyles() {
  return <style>{`
    .smartlingo-class-studio{width:min(1328px,100%);margin:0 auto;padding:74px clamp(20px,4vw,56px) 110px;color:var(--ink)}
    .smartlingo-class-studio *{min-width:0;max-width:100%;overflow-wrap:break-word}.class-studio-intro{max-width:930px}.class-studio-intro h1,.class-detail-hero h1{margin:8px 0 22px;font:600 clamp(42px,5.8vw,76px)/1.02 "Iowan Old Style","Noto Serif SC",Georgia,serif;letter-spacing:-.035em}.class-studio-intro>p:last-child,.class-detail-hero>div>p:last-child{max-width:76ch;color:var(--muted);font-size:17px;line-height:1.72}
    .class-economics{margin-top:64px;padding:clamp(28px,4vw,52px);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);gap:clamp(30px,5vw,70px);border-radius:24px;background:#123f35;color:#fff}.class-economics h2,.class-create-panel h2,.class-section-heading h2,.class-detail-grid h2{margin:8px 0 18px;font:600 clamp(29px,3.5vw,46px)/1.08 "Iowan Old Style","Noto Serif SC",Georgia,serif}.class-economics p{max-width:68ch;color:rgba(255,255,255,.76);line-height:1.68}.class-economics small{display:block;margin-top:22px;color:#f0cf87;line-height:1.5}.class-economics dl,.class-detail-hero dl{margin:0;padding:22px;border-radius:16px;background:rgba(255,255,255,.1)}.class-economics dl div,.class-detail-hero dl div{padding:10px 0;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid rgba(255,255,255,.16)}.class-economics dl div:last-child,.class-detail-hero dl div:last-child{border-bottom:0}.class-economics dd,.class-detail-hero dd{margin:0;text-align:right;font-weight:900}
    .class-catalog,.class-create-panel,.class-economics{margin-top:76px}.class-section-heading{width:100%}.class-section-heading>p:last-child:not(.section-kicker){max-width:76ch;margin:14px 0 0;color:var(--muted);line-height:1.7}.class-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:28px}.class-card-grid article,.class-detail-grid article{padding:26px;display:flex;flex-direction:column;min-height:290px;border:1px solid rgba(18,32,42,.13);border-radius:18px;background:#fffaf0}.class-card-grid article.official{border-color:#a7d6c4;background:#f1fbf6}.class-card-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.class-card-meta>span,.class-detail-grid article>span{color:var(--vermillion);font-size:11px;font-weight:900;letter-spacing:.1em}.class-card-meta>b{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:#dff4e9;color:#08725e;font-size:10px}.class-card-grid h3{margin:20px 0 11px;font:600 26px/1.15 "Iowan Old Style","Noto Serif SC",Georgia,serif}.class-card-grid p,.class-detail-grid p{color:var(--muted);line-height:1.65}.class-card-grid small{margin-top:auto;padding-top:20px;color:var(--muted)}.class-card-grid a,.class-card-grid button{width:max-content;margin-top:18px}.class-empty{margin-top:26px;padding:30px;border:1px dashed rgba(18,32,42,.25);border-radius:16px;color:var(--muted)}
    .class-create-panel{padding:clamp(28px,4vw,54px);display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.3fr);gap:clamp(30px,5vw,70px);border-radius:24px;background:#e7eee9}.class-create-panel>div>p:last-child{color:var(--muted);line-height:1.7}.class-create-panel form{display:grid;gap:15px}.class-create-panel label{display:grid;gap:7px;font-size:13px;font-weight:850}.class-create-panel input,.class-create-panel textarea,.class-create-panel select{width:100%;padding:12px 14px;border:1px solid rgba(18,32,42,.22);border-radius:9px;background:white;font:16px/1.4 inherit}.class-create-panel textarea{min-height:112px;resize:vertical}.class-form-pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}.class-create-panel button{width:max-content}.class-notice{position:sticky;bottom:20px;z-index:3;margin:24px 0 0;padding:15px 18px;border-radius:10px;background:#123f35;color:white;box-shadow:0 14px 34px rgba(0,0,0,.18)}
    .class-back{display:inline-flex;margin-bottom:36px;color:var(--jade);font-weight:850}.class-detail-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:clamp(30px,5vw,70px);align-items:end}.class-detail-hero dl{background:#e7eee9}.class-detail-hero dl div{border-color:rgba(18,32,42,.12)}.class-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:56px}.class-detail-grid article{min-height:0}.class-payment-card{background:#123f35!important;color:white}.class-payment-card p{color:rgba(255,255,255,.76)}.class-review-button{width:max-content;margin-top:22px}.class-auth-required{min-height:62vh;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.class-auth-required h1{max-width:900px;margin:8px 0 20px;font:600 clamp(42px,6vw,76px)/1.03 "Iowan Old Style","Noto Serif SC",Georgia,serif}.class-auth-required>p:not(.section-kicker){max-width:72ch;color:var(--muted);line-height:1.72}.class-auth-required>a{width:max-content;margin-top:18px}.class-loading{min-height:54vh;display:grid;place-items:center;color:var(--jade);font-weight:900}
    @media(max-width:960px){.class-economics,.class-create-panel,.class-detail-hero{grid-template-columns:1fr}.class-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.class-economics dl,.class-detail-hero dl{max-width:560px}}
    .class-placement-card{grid-column:1/-1!important;background:#eaf8f1!important}.class-learning-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}.class-learning-actions a{width:max-content}
    @media(max-width:620px){.smartlingo-class-studio{padding-top:48px}.class-card-grid,.class-form-pair,.class-detail-grid{grid-template-columns:1fr}.class-catalog,.class-create-panel,.class-economics{margin-top:52px}.class-create-panel button,.class-card-grid a,.class-card-grid button,.class-review-button,.class-auth-required>a,.class-learning-actions a{width:100%}.class-economics dl div,.class-detail-hero dl div{align-items:flex-start}.class-economics dd,.class-detail-hero dd{max-width:56%}}
  `}</style>;
}
