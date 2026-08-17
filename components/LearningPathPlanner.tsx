"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  SMARTLINGO_DAILY_MINUTES,
  SMARTLINGO_LANGUAGE_CATALOG,
  SMARTLINGO_PATH_CONTENT_VERSION,
  SMARTLINGO_USE_CASES,
  buildLanguagePath,
  type SmartLingoDailyMinutes,
  type SmartLingoEntryMode,
  type SmartLingoUseCase,
} from "../lib/smartlingo-paths";
import type { SmartLingoLevel } from "../lib/smartlingo-learning";
import type { SmartLingoCommunityLanguage } from "../lib/smartlingo-language-communities";
import {
  SMARTLINGO_COURSE_DURATIONS,
  buildQuickCourse,
  type SmartLingoCourseDays,
  type SmartLingoCourseLevel,
} from "../lib/smartlingo-quick-courses";
import { rememberTargetLanguage } from "./InterfaceLanguageMenu";

type SavedPlan = {
  targetLanguage: SmartLingoCommunityLanguage;
  useCase: SmartLingoUseCase;
  dailyMinutes: SmartLingoDailyMinutes;
  selfReportedLevel: SmartLingoLevel;
  entryMode: SmartLingoEntryMode;
  currentUnitId: string | null;
  isActive: boolean;
};

type SaveResponse = {
  error?: string;
  plan?: SavedPlan;
  path?: { classId: string; targetLanguage: SmartLingoCommunityLanguage };
  next?: "placement" | "learning";
};

const SKILL_LABELS = {
  zh: { vocabulary: "词汇", reading: "阅读", writing: "写作", listening: "听力", dialogue: "对话" },
  en: { vocabulary: "Vocabulary", reading: "Reading", writing: "Writing", listening: "Listening", dialogue: "Dialogue" },
} as const;

const copy = {
  zh: {
    catalogKicker: "十二种语言目录",
    catalogTitle: "文字、语音能力与内容状态都清楚可查。",
    catalogIntro: "语言不是国家，目录不使用国旗。语音播放和麦克风能力取决于设备；麦克风与实时语音只在登录后开放。",
    pathId: "稳定路径",
    direction: "文字方向",
    ltr: "从左到右",
    rtl: "从右到左",
    speech: "设备语音播放 · 登录后麦克风与实时语音",
    stages: "阶段",
    status: "基础内容已就绪；后续阶段为透明预览",
    version: "内容版本",
    onboardingKicker: "学习目标与起点",
    onboardingTitle: "先告诉我们您想怎样使用这门语言。",
    onboardingIntro: "选择会保存到您的账户并按语言分别保留。跳过定位测评不会生成五项技能分数；以后仍可重测。",
    language: "目标语言",
    useCase: "使用场景",
    minutes: "每日时长",
    level: "自报水平",
    course: "选择等级与累进课程",
    courseIntro: "入门为 7、14、30 天；中级为 1、2、3 个月；高级为 3、6、12 个月。已有同级较短课程证书会自动承接下一天；每个课程日为可跨日续学的 60 分钟。",
    free: "免费",
    paidLater: "付费开放前可保存选择",
    daily: "每天约",
    entry: "起点方式",
    useCases: { daily_life: "日常生活", travel: "旅行", work: "工作", study: "学习", community: "社区交流" },
    levels: { beginner: "初级", intermediate: "中级", advanced: "高级" },
    entries: {
      fundamentals: ["跳过测评，从基础开始", "不生成技能分数，直接进入基础第一单元。"],
      self_selected: ["采用自报水平", "按所选初、中、高级推荐起点，不生成技能分数。"],
      adaptive: ["完成十五题自适应分级", "从中级起步，覆盖五项技能，可暂停、跳题和重测。"],
    },
    save: "保存并继续",
    saving: "正在保存…",
    saved: "学习目标已安全保存，正在打开下一步。",
    saveOnly: "目标已经保存；如下一步暂不可用，稍后可从班级页继续。",
    auth: "请先登录；验证邮箱后会返回此处继续。",
    error: "暂时无法保存学习目标，请稍后重试。",
    nonCredential: "定位结果和人工智能反馈仅用于安排练习，不是真人教师判断、官方考试成绩或语言证书。",
    mapKicker: "阶段与单元地图",
    mapTitle: "每个真实场景都有明确先决单元。",
    mapIntro: "地图以版本化原创双语结构连接词汇、阅读、写作、听力、对话和综合场景。基础阶段可学习；A2 与 B1+ 目前只作透明预览，不伪装成已发布课程。",
    available: "可学习",
    preview: "预览",
    prerequisite: "先完成",
    first: "路径起点",
    scenario: "真实场景",
    current: "当前单元",
    openClasses: "查看语言班",
  },
  en: {
    catalogKicker: "TWELVE-LANGUAGE CATALOG",
    catalogTitle: "Writing, speech capabilities, and content status are explicit.",
    catalogIntro: "Languages are not countries, so the catalog uses no flags. Playback and microphone support depend on the device; microphone and live audio require sign-in.",
    pathId: "Stable path",
    direction: "Writing direction",
    ltr: "Left to right",
    rtl: "Right to left",
    speech: "Device speech playback · signed-in microphone and live audio",
    stages: "Stages",
    status: "Foundation content ready; later stages shown as transparent previews",
    version: "Content version",
    onboardingKicker: "GOAL AND STARTING POINT",
    onboardingTitle: "Tell us how you want to use this language.",
    onboardingIntro: "Choices are saved to your account and retained separately for each language. Skipping placement creates no five-skill scores; you can take it later.",
    language: "Target language",
    useCase: "Use case",
    minutes: "Daily time",
    level: "Self-reported level",
    course: "Choose a level and cumulative course",
    courseIntro: "Beginner offers 7, 14, and 30 days; intermediate offers 1, 2, and 3 months; advanced offers 3, 6, and 12 months. A shorter certificate continues at the next day. Every course day is a resumable 60-minute session.",
    free: "Free",
    paidLater: "Save choice before paid access opens",
    daily: "About",
    entry: "Starting method",
    useCases: { daily_life: "Daily life", travel: "Travel", work: "Work", study: "Study", community: "Community" },
    levels: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
    entries: {
      fundamentals: ["Skip placement and start with fundamentals", "Creates no skill scores and opens the first foundation unit."],
      self_selected: ["Use my self-reported level", "Recommends a beginner, intermediate, or advanced start without creating skill scores."],
      adaptive: ["Take the 15-item adaptive placement", "Starts at intermediate, covers five skills, and can pause, skip items, or retake."],
    },
    save: "Save and continue",
    saving: "Saving…",
    saved: "Your learning goal is saved safely. Opening the next step.",
    saveOnly: "Your goal is saved; if the next step is unavailable, continue later from Classes.",
    auth: "Sign in first; after email verification you will return here.",
    error: "The learning goal cannot be saved right now. Please try again.",
    nonCredential: "Placement results and AI feedback guide practice only. They are not human-teacher judgments, official exam scores, or language credentials.",
    mapKicker: "STAGE AND UNIT MAP",
    mapTitle: "Every real situation has an explicit prerequisite.",
    mapIntro: "This versioned, original bilingual structure connects vocabulary, reading, writing, listening, dialogue, and integrated scenarios. Foundation is learnable; A2 and B1+ are transparent previews, not falsely presented as released courses.",
    available: "Available",
    preview: "Preview",
    prerequisite: "Complete first",
    first: "Path start",
    scenario: "Real situation",
    current: "Current unit",
    openClasses: "Browse classes",
  },
} as const;

export function LearningPathPlanner({ lang, initialLanguage, catalogOnly = false }: {
  lang: "zh" | "en";
  initialLanguage?: SmartLingoCommunityLanguage;
  catalogOnly?: boolean;
}) {
  const t = copy[lang];
  const [targetLanguage, setTargetLanguage] = useState<SmartLingoCommunityLanguage>(initialLanguage ?? (lang === "zh" ? "en" : "es"));
  const [joinedCourses, setJoinedCourses] = useState<Array<{ id: string; targetLanguage: string; classKind?: string }>>([]);
  const [useCase, setUseCase] = useState<SmartLingoUseCase>("daily_life");
  const [dailyMinutes, setDailyMinutes] = useState<SmartLingoDailyMinutes>(10);
  const [selfReportedLevel, setSelfReportedLevel] = useState<SmartLingoLevel>("beginner");
  const [entryMode, setEntryMode] = useState<SmartLingoEntryMode>("fundamentals");
  const [courseLevel, setCourseLevel] = useState<SmartLingoCourseLevel>("beginner");
  const [courseDays, setCourseDays] = useState<SmartLingoCourseDays>(7);
  const [currentUnitId, setCurrentUnitId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selected = SMARTLINGO_LANGUAGE_CATALOG.find(language => language.code === targetLanguage)!;
  const stages = useMemo(() => buildLanguagePath(targetLanguage), [targetLanguage]);

  useEffect(() => {
    const requested = initialLanguage ? null : new URLSearchParams(window.location.search).get("language");
    let languageFrame = 0;
    if (requested && SMARTLINGO_LANGUAGE_CATALOG.some(language => language.code === requested)) {
      languageFrame = window.requestAnimationFrame(() => setTargetLanguage(requested as SmartLingoCommunityLanguage));
    }
    void fetch("/api/learning-plan", { headers: { accept: "application/json" } }).then(async response => {
      if (!response.ok) return;
      const payload = await response.json() as { plans?: SavedPlan[] };
      const active = payload.plans?.find(plan => plan.isActive && (!initialLanguage || plan.targetLanguage === initialLanguage));
      if (!active) return;
      if (!initialLanguage) setTargetLanguage(active.targetLanguage);
      setUseCase(active.useCase);
      setDailyMinutes(active.dailyMinutes);
      setSelfReportedLevel(active.selfReportedLevel);
      setEntryMode(active.entryMode);
      setCurrentUnitId(active.currentUnitId);
    }).catch(() => undefined);
    return () => {
      if (languageFrame) window.cancelAnimationFrame(languageFrame);
    };
    void fetch("/api/classes", { headers: { accept: "application/json" } }).then(async response => {
      if (!response.ok) return;
      const payload = await response.json() as { joinedClasses?: Array<{ id: string; targetLanguage: string; classKind?: string }>; classes?: Array<{ id: string; targetLanguage: string; classKind?: string; isJoined?: boolean; isOwner?: boolean }> };
      setJoinedCourses(payload.joinedClasses ?? payload.classes?.filter(item => item.isJoined || item.isOwner) ?? []);
    }).catch(() => undefined);
  }, [initialLanguage]);

  function openCatalogLanguage(language: SmartLingoCommunityLanguage) {
    rememberTargetLanguage(language);
    const joined = joinedCourses.find(item => item.targetLanguage === language && item.classKind === "official_course")
      ?? joinedCourses.find(item => item.targetLanguage === language);
    window.location.assign(joined
      ? `/${lang}/classes/${encodeURIComponent(joined.id)}`
      : `/${lang}/programs/${encodeURIComponent(language)}`);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/learning-plan", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ targetLanguage, useCase, dailyMinutes, selfReportedLevel, entryMode }),
      });
      if (response.status === 401) {
        setNotice(t.auth);
        const returnTo = `/${lang}/programs?language=${encodeURIComponent(targetLanguage)}`;
        window.location.assign(`/${lang}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      const payload = await response.json() as SaveResponse;
      if (!response.ok || !payload.plan || !payload.path) throw new Error(payload.error || t.error);
      setCurrentUnitId(payload.plan.currentUnitId);
      setNotice(t.saved);

      const enrollment = await fetch(`/api/classes/${encodeURIComponent(payload.path.classId)}/enroll`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!enrollment.ok) throw new Error(t.saveOnly);

      const quickCourse = await fetch("/api/quick-courses", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ targetLanguage, level: courseLevel, durationDays: courseDays }),
      });
      if (!quickCourse.ok) throw new Error(t.saveOnly);
      const quickCoursePayload = await quickCourse.json() as { enrollment?: { status?: string } };
      if (quickCoursePayload.enrollment?.status === "pending_payment") {
        setNotice(lang === "zh"
          ? "课程选择已保存；付费结账尚未开放，因此没有收费。您现在可以先使用免费的七天课程。"
          : "Your course choice is saved. Checkout is not open, so no charge was made. You can start the free 7-day course now.");
        setBusy(false);
        return;
      }

      const placementMode = entryMode === "fundamentals" ? "beginner" : selfReportedLevel;
      const placement = await fetch(`/api/classes/${encodeURIComponent(payload.path.classId)}/placement`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(entryMode === "adaptive"
          ? { action: "start", mode: "adaptive", lang }
          : { action: "skip_placement", mode: placementMode, lang }),
      });
      if (!placement.ok) throw new Error(t.saveOnly);
      window.location.assign(entryMode === "adaptive"
        ? `/${lang}/classes/${encodeURIComponent(payload.path.classId)}/placement`
        : `/${lang}/classes/${encodeURIComponent(payload.path.classId)}/learn`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return <div className="sl-path-planner">
    {!initialLanguage && <section id="language-catalog" className="sl-language-catalog" data-layout-fill="language-catalog">
      <header className="sl-planner-heading" data-readable-copy="language-catalog-copy">
        <p className="section-kicker">{t.catalogKicker}</p>
        <h2 data-layout-text-fit="language-catalog-title">{t.catalogTitle}</h2>
        <p>{t.catalogIntro}</p>
      </header>
      <div className="sl-language-grid" data-layout-fill="language-catalog-grid">
        {SMARTLINGO_LANGUAGE_CATALOG.map(language => <button
          type="button"
          data-layout-track={`language-${language.code}`}
          onClick={() => openCatalogLanguage(language.code)}
          key={language.stableId}
        >
          <span>{language.nameZh} · {language.nameEn}</span>
          <strong dir={language.direction} data-layout-text-fit={`language-name-${language.code}`}>{language.nativeName}</strong>
          <dl>
            <div><dt>{t.pathId}</dt><dd>{language.pathId}</dd></div>
            <div><dt>{t.direction}</dt><dd>{language.direction === "rtl" ? t.rtl : t.ltr}</dd></div>
            <div><dt>{t.stages}</dt><dd>A1 · A2 · B1+</dd></div>
            <div><dt>{t.version}</dt><dd>{language.contentVersion}</dd></div>
          </dl>
          <small>{t.speech}</small>
          <em>{t.status}</em>
        </button>)}
      </div>
    </section>}

    {!catalogOnly && <>
    <section className="sl-onboarding" data-layout-fill="goal-onboarding">
      <header className="sl-planner-heading" data-readable-copy="onboarding-copy">
        <p className="section-kicker">{t.onboardingKicker}</p>
        <h2 data-layout-text-fit="onboarding-title">{t.onboardingTitle}</h2>
        <p>{t.onboardingIntro}</p>
      </header>
      <form onSubmit={save} data-layout-fill="goal-onboarding-form">
        <div className="sl-onboarding-fields">
          <div className="sl-fixed-language" data-layout-track="onboarding-language"><span>{t.language}</span><strong dir={selected.direction}>{selected.nativeName} · {lang === "zh" ? selected.nameZh : selected.nameEn}</strong></div>
          <label data-layout-track="onboarding-use-case"><span>{t.useCase}</span><select value={useCase} onChange={event => setUseCase(event.target.value as SmartLingoUseCase)}>{SMARTLINGO_USE_CASES.map(value => <option value={value} key={value}>{t.useCases[value]}</option>)}</select></label>
          <label data-layout-track="onboarding-minutes"><span>{t.minutes}</span><select value={dailyMinutes} onChange={event => setDailyMinutes(Number(event.target.value) as SmartLingoDailyMinutes)}>{SMARTLINGO_DAILY_MINUTES.map(value => <option value={value} key={value}>{value} {lang === "zh" ? "分钟" : "minutes"}</option>)}</select></label>
          <label data-layout-track="onboarding-level"><span>{t.level}</span><select value={selfReportedLevel} onChange={event => setSelfReportedLevel(event.target.value as SmartLingoLevel)}>{(["beginner", "intermediate", "advanced"] as const).map(value => <option value={value} key={value}>{t.levels[value]}</option>)}</select></label>
        </div>
        <fieldset>
          <legend>{t.course}</legend>
          <p className="sl-course-intro">{t.courseIntro}</p>
          <div className="sl-course-levels" role="group" aria-label={t.level} style={{width:"100%",margin:"0 0 10px",display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
            {(["beginner", "intermediate", "advanced"] as const).map(level => <button
              type="button"
              className={courseLevel === level ? "selected" : ""}
              aria-pressed={courseLevel === level}
              style={{minWidth:0,minHeight:46,padding:"9px 12px",border:`1px solid ${courseLevel === level ? "#63deb7" : "rgba(255,255,255,.28)"}`,borderRadius:12,background:courseLevel === level ? "#63deb7" : "rgba(255,255,255,.07)",color:courseLevel === level ? "#113a31" : "#fff",font:"850 15px/1.25 inherit",cursor:"pointer"}}
              onClick={() => {
                setCourseLevel(level);
                setCourseDays(SMARTLINGO_COURSE_DURATIONS[level][0]);
              }}
              key={level}
            >{t.levels[level]}</button>)}
          </div>
          <div className="sl-course-grid" data-layout-fill="quick-course-options">
            {SMARTLINGO_COURSE_DURATIONS[courseLevel].map(days => {
              const course = buildQuickCourse(targetLanguage, days, courseLevel);
              return <label className={courseDays === days ? "selected" : ""} data-layout-track={`quick-course-${days}`} key={days}>
                <input type="radio" name="courseDays" value={days} checked={courseDays === days} onChange={() => setCourseDays(days)}/>
                <span><b>{course.title[lang]}</b><small>{course.summary[lang]}</small><em>{course.isFreeDefault ? t.free : t.paidLater} · {t.daily} {course.schedule[0].estimatedMinutes} {lang === "zh" ? "分钟" : "minutes"}</em></span>
              </label>;
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t.entry}</legend>
          <div className="sl-entry-grid">
            {(["fundamentals", "self_selected", "adaptive"] as const).map(value => <label className={entryMode === value ? "selected" : ""} data-layout-track={`entry-${value}`} key={value}><input type="radio" name="entryMode" value={value} checked={entryMode === value} onChange={() => setEntryMode(value)}/><span><strong>{t.entries[value][0]}</strong><small>{t.entries[value][1]}</small></span></label>)}
          </div>
        </fieldset>
        <p className="sl-noncredential" data-readable-copy="noncredential-notice">{t.nonCredential}</p>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? t.saving : t.save} →</button>
        {notice && <p className="sl-planner-notice" aria-live="polite">{notice}</p>}
        {error && <p className="sl-planner-error" role="alert">{error} <Link href={`/${lang}/classes`}>{t.openClasses} →</Link></p>}
      </form>
    </section>

    <section className="sl-path-map" data-layout-fill="stage-unit-map">
      <header className="sl-planner-heading" data-readable-copy="path-map-copy">
        <p className="section-kicker">{t.mapKicker} · {selected.nativeName}</p>
        <h2 data-layout-text-fit="path-map-title">{t.mapTitle}</h2>
        <p>{t.mapIntro}</p>
      </header>
      <div className="sl-stage-stack">
        {stages.map((stage, stageIndex) => <article className="sl-stage" data-layout-fill={`stage-${stage.id}`} key={stage.id}>
          <header data-readable-copy={`stage-${stage.id}-copy`}>
            <span>{stage.level}</span><div><h3 data-layout-text-fit={`stage-title-${stage.id}`}>{stage.title[lang]}</h3><p>{stage.summary[lang]}</p></div><em>{stage.availability === "available" ? t.available : t.preview}</em>
          </header>
          <div className="sl-unit-grid">
            {stage.units.map((unit, unitIndex) => <section className={unit.id === currentUnitId ? "current" : ""} data-layout-track={unit.id} key={unit.id}>
              <div><span>{stageIndex + 1}.{unitIndex + 1}</span>{unit.id === currentUnitId && <b>{t.current}</b>}</div>
              <h4 data-layout-text-fit={`${unit.id}-title`}>{unit.title[lang]}</h4>
              <p>{unit.summary[lang]}</p>
              <dl><div><dt>{t.prerequisite}</dt><dd>{unit.prerequisiteUnitId ? unit.prerequisiteUnitId.replace(`sl-unit-${targetLanguage}-`, "") : t.first}</dd></div><div><dt>{t.scenario}</dt><dd>{unit.scenario[lang]}</dd></div></dl>
              <ul>{unit.skills.map(skill => <li key={skill}>{SKILL_LABELS[lang][skill]}</li>)}</ul>
            </section>)}
          </div>
        </article>)}
      </div>
      <p className="sl-version-note">SmartLingo original bilingual path · {SMARTLINGO_PATH_CONTENT_VERSION}</p>
    </section>
    </>}
    <LearningPathPlannerStyles/>
  </div>;
}

function LearningPathPlannerStyles() {
  return <style>{`
    .sl-path-planner,.sl-path-planner *{box-sizing:border-box;min-width:0}.sl-path-planner{width:100%;max-width:none;color:var(--ink)}.sl-language-catalog,.sl-onboarding,.sl-path-map{width:100%;max-width:none;padding:clamp(66px,8vw,112px) clamp(18px,5vw,72px)}.sl-language-catalog{background:#f7f2e8}.sl-onboarding{background:#fff}.sl-path-map{background:#e8f3ed}.sl-planner-heading{width:100%;max-width:none}.sl-planner-heading h2{width:100%;max-width:none;margin:9px 0 15px;font:850 clamp(34px,5vw,66px)/1.04 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.045em;overflow-wrap:anywhere}.sl-planner-heading>p:last-child{max-width:74ch;margin:0;color:#566963;font-size:17px;line-height:1.72}.sl-language-grid{width:100%;max-width:none;margin-top:38px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.sl-language-grid>button{width:100%;min-height:310px;padding:23px;display:flex;flex-direction:column;align-items:stretch;border:1px solid #d6d2c8;border-radius:19px;background:#fff;color:var(--ink);font:inherit;text-align:left;cursor:pointer;overflow:hidden}.sl-language-grid>button.selected{border-color:#0c9271;box-shadow:inset 0 0 0 2px rgba(12,146,113,.2);background:#f0fbf6}.sl-language-grid>button>span{color:#0a775f;font-size:12px;font-weight:900;letter-spacing:.04em}.sl-language-grid strong{width:100%;margin:14px 0 18px;font-size:clamp(27px,3vw,39px);line-height:1.12;overflow-wrap:anywhere}.sl-language-grid dl{width:100%;margin:0;display:grid;gap:7px}.sl-language-grid dl div{display:flex;justify-content:space-between;gap:14px;border-top:1px solid #ebe7df;padding-top:7px}.sl-language-grid dt{color:#6b756f;font-size:12px}.sl-language-grid dd{margin:0;font-size:12px;font-weight:800;text-align:right;overflow-wrap:anywhere}.sl-language-grid small{margin-top:17px;color:#536b63;line-height:1.5}.sl-language-grid em{margin-top:auto;padding-top:12px;color:#0a775f;font-size:12px;font-style:normal;font-weight:900}.sl-onboarding form{width:100%;max-width:none;margin-top:38px;padding:clamp(24px,4vw,48px);border-radius:24px;background:#133f36;color:#fff}.sl-onboarding-fields{width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.sl-onboarding label>span,.sl-onboarding fieldset>legend,.sl-fixed-language>span{display:block;margin-bottom:8px;color:#cbe0d8;font-size:12px;font-weight:900}.sl-fixed-language>strong{min-height:52px;padding:0 13px;display:flex;align-items:center;border:1px solid rgba(255,255,255,.28);border-radius:11px;background:#fff;color:#16362f;font:750 16px/1.3 inherit}.sl-onboarding select{width:100%;min-height:52px;padding:0 13px;border:1px solid rgba(255,255,255,.28);border-radius:11px;background:#fff;color:#16362f;font:750 16px/1.3 inherit}.sl-onboarding fieldset{width:100%;margin:27px 0 0;padding:0;border:0}.sl-entry-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sl-entry-grid label{width:100%;min-height:128px;padding:17px;display:flex;align-items:flex-start;gap:11px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(255,255,255,.06);cursor:pointer}.sl-entry-grid label.selected{border-color:#63deb7;background:rgba(99,222,183,.13)}.sl-entry-grid input{margin-top:4px;accent-color:#58d7ae}.sl-entry-grid strong,.sl-entry-grid small{display:block}.sl-entry-grid strong{color:#fff;line-height:1.35}.sl-entry-grid small{margin-top:8px;color:#c8d9d3;line-height:1.5}.sl-noncredential{max-width:74ch;margin:22px 0;color:#c6d7d1;line-height:1.65}.sl-onboarding form>.primary-button{border:0}.sl-planner-notice,.sl-planner-error{width:100%;margin:16px 0 0;padding:13px 15px;border-radius:11px}.sl-planner-notice{background:#dff7ec;color:#075b49}.sl-planner-error{background:#fff0ed;color:#8b332e}.sl-planner-error a{color:inherit;font-weight:900}.sl-stage-stack{width:100%;margin-top:40px;display:grid;gap:18px}.sl-stage{width:100%;padding:clamp(22px,4vw,43px);border:1px solid #c8dbd1;border-radius:24px;background:#fff}.sl-stage>header{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:19px}.sl-stage>header>span{min-width:56px;padding:9px 12px;border-radius:999px;background:#123f35;color:#fff;font-size:13px;font-weight:900;text-align:center}.sl-stage h3{width:100%;max-width:none;margin:0;font:820 clamp(27px,4vw,44px)/1.08 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.035em;overflow-wrap:anywhere}.sl-stage>header p{max-width:72ch;margin:8px 0 0;color:#5c6c66;line-height:1.6}.sl-stage>header em{padding:8px 11px;border-radius:999px;background:#e3f6ed;color:#087159;font-size:12px;font-style:normal;font-weight:900}.sl-unit-grid{width:100%;margin-top:27px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.sl-unit-grid>section{width:100%;padding:20px;border:1px solid #d7e1db;border-radius:17px;background:#fffdf8}.sl-unit-grid>section.current{border-color:#0b9473;box-shadow:inset 0 0 0 2px rgba(11,148,115,.16)}.sl-unit-grid>section>div:first-child{display:flex;justify-content:space-between;gap:10px;color:#0a775f;font-size:12px;font-weight:900}.sl-unit-grid h4{width:100%;max-width:none;margin:14px 0 9px;font-size:23px;line-height:1.18;overflow-wrap:anywhere}.sl-unit-grid>section>p{color:#586963;line-height:1.58}.sl-unit-grid dl{margin:18px 0 0;display:grid;gap:11px}.sl-unit-grid dt{color:#75817c;font-size:11px;font-weight:900;text-transform:uppercase}.sl-unit-grid dd{margin:4px 0 0;line-height:1.48;overflow-wrap:anywhere}.sl-unit-grid ul{margin:18px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:5px;list-style:none}.sl-unit-grid li{padding:6px 8px;border-radius:999px;background:#e7f4ed;color:#087159;font-size:11px;font-weight:850}.sl-version-note{margin:22px 0 0;color:#5e6e68;font-size:12px}
    .sl-course-intro{max-width:74ch;margin:0 0 12px;color:#c8d9d3;line-height:1.6}.sl-course-grid{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sl-course-grid label{width:100%;min-height:164px;padding:17px;display:flex;align-items:flex-start;gap:11px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(255,255,255,.06);cursor:pointer}.sl-course-grid label.selected{border-color:#63deb7;background:rgba(99,222,183,.13)}.sl-course-grid input{margin-top:4px;accent-color:#58d7ae}.sl-course-grid b,.sl-course-grid small,.sl-course-grid em{display:block}.sl-course-grid b{color:#fff;line-height:1.35}.sl-course-grid small{margin-top:8px;color:#c8d9d3;line-height:1.5}.sl-course-grid em{margin-top:12px;color:#77e0be;font-size:12px;font-style:normal;font-weight:850}
    @media(max-width:1000px){.sl-language-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sl-onboarding-fields{grid-template-columns:1fr 1fr}.sl-unit-grid{grid-template-columns:1fr}.sl-unit-grid>section{min-height:0}}
    @media(max-width:700px){.sl-language-catalog,.sl-onboarding,.sl-path-map{padding-inline:16px}.sl-language-grid,.sl-entry-grid,.sl-course-grid{grid-template-columns:minmax(0,1fr)}.sl-language-grid>button{min-height:0}.sl-onboarding-fields{grid-template-columns:minmax(0,1fr)}.sl-onboarding form{padding:22px 16px}.sl-stage{padding:22px 16px}.sl-stage>header{grid-template-columns:minmax(0,1fr)}.sl-stage>header>span,.sl-stage>header>em{justify-self:start}.sl-entry-grid label,.sl-course-grid label{min-height:0}.sl-onboarding form>.primary-button{width:100%}}
  `}</style>;
}
