"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { LearningLogCalendar, type LearningLogDay } from "./LearningLogCalendar";

type Lang = "zh" | "en";
type Skill = "vocabulary" | "reading" | "writing" | "listening" | "dialogue";
type VocabularyMode = "recognition" | "recall" | "listening" | "spelling" | "cloze";
type VocabularyGrade = "again" | "hard" | "good" | "easy" | "suspend";

type Placement = {
  status: "in_progress" | "paused" | "completed" | "abandoned";
  entryMode?: string;
  overallScore?: number | null;
  recommendedLevel?: "beginner" | "intermediate" | "advanced" | null;
};

type ClassSummary = {
  id: string;
  title: string;
  targetLanguage: string;
  classKind?: "official_language" | "member_language" | "subject";
};

type VocabularyItem = {
  taskId?: string;
  sampleId?: string;
  stableId?: string;
  word?: string;
  form?: string;
  pronunciation?: string;
  meaning?: string | { zh?: string; en?: string };
  visualCue?: {
    kind: "pictogram";
    symbol: string;
    label: { zh?: string; en?: string };
  };
  example?: string;
  exampleTranslation?: string | { zh?: string; en?: string };
  audioText?: string;
  speechLocale?: string;
  direction?: "ltr" | "rtl";
  mode?: VocabularyMode;
  status?: string;
};

type PracticeOption = { id?: string; value?: string; label: string };
type PracticeTask = {
  taskId: string;
  skill: Skill;
  prompt: string;
  context?: string;
  audioText?: string;
  speechLocale?: string;
  direction?: "ltr" | "rtl";
  options?: PracticeOption[];
  estimatedMinutes?: number;
  status?: "available" | "completed" | "skipped";
  score?: number | null;
};

type LearningPayload = {
  class?: ClassSummary;
  placement?: Placement | null;
  date?: string;
  vocabulary?: VocabularyItem | null;
  tasks?: PracticeTask[];
  dailyTasks?: PracticeTask[];
  quickCourse?: {
    title: { zh: string; en: string };
    durationDays: number;
    currentDay: number;
    scene: { zh: string; en: string };
    skills: Skill[];
    estimatedMinutes: number;
  } | null;
  error?: string;
};

type ClassDetailPayload = {
  class?: ClassSummary;
  placement?: Placement | null;
  error?: string;
};

type LearningLogPayload = {
  month?: string;
  days?: LearningLogDay[];
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const PRACTICE_SKILLS: Skill[] = ["reading", "writing", "listening", "dialogue"];
const VOCABULARY_MODES: VocabularyMode[] = ["recognition", "recall", "listening", "spelling", "cloze"];
const VOCABULARY_GRADES: VocabularyGrade[] = ["again", "hard", "good", "easy", "suspend"];

const ACCENTS: Record<Skill, string> = {
  vocabulary: "#0b9b75",
  reading: "#2878bd",
  writing: "#8059bf",
  listening: "#d38b20",
  dialogue: "#d65362",
};

const COPY = {
  zh: {
    kicker: "SmartLingo 每日学习",
    title: "五项技能，每天形成真实进步。",
    intro: "分级确定起点后，依次完成词汇、阅读、写作、听力与对话任务；所有完成、跳过和社区参与都会进入您的学习日志。",
    calendarKicker: "个人学习记录",
    calendarTitle: "学习日历",
    calendarIntro: "查看每天五项技能和社区活动的真实记录。日期格只用颜色标记活动，详细数据在日历下方。",
    placement: "分级测评状态",
    placementRequired: "完成分级测评后开启每日五技能训练。",
    placementInProgress: "您的分级测评尚未完成，可以从已保存的位置继续。",
    placementComplete: "分级已完成",
    placementUnknown: "尚未开始",
    startPlacement: "开始分级测评",
    resumePlacement: "继续分级测评",
    level: { beginner: "初级", intermediate: "中级", advanced: "高级" },
    today: "今日五技能",
    todayIntro: "每项任务均可提交或跳过；跳过会被如实记录，不会伪造成已掌握。",
    quickCourse: "旅行入门课程",
    courseDay: "课程日",
    visualCue: "视觉提示",
    sourceMeaning: "中文释义",
    minutes: "分钟",
    vocabulary: "词汇",
    reading: "阅读",
    writing: "写作",
    listening: "听力",
    dialogue: "对话",
    modes: { recognition: "识别", recall: "回忆", listening: "听音", spelling: "拼写", cloze: "填空" },
    modeHelp: {
      recognition: "看到词语，先回想它的意思。",
      recall: "根据释义回想并说出目标词语。",
      listening: "先听发音，再回想词语和意思。",
      spelling: "听发音后输入目标词语。",
      cloze: "根据例句语境补全目标词语。",
    },
    pronounce: "播放发音",
    reveal: "揭示答案",
    answer: "输入答案",
    grades: { again: "重来", hard: "困难", good: "良好", easy: "容易", suspend: "暂停此词" },
    gradeHelp: "揭示后请如实评价回忆难度，系统将据此安排下一次复习。",
    prompt: "任务",
    context: "学习材料",
    play: "播放听力",
    submit: "提交任务",
    skip: "跳过今天",
    completed: "已完成",
    skipped: "已跳过",
    score: "得分",
    noTask: "今天暂时没有可用任务，请稍后再试。",
    response: "输入您的回答",
    voice: "语音输入",
    listeningNow: "正在聆听",
    communityKicker: "共同学习",
    communityTitle: "在社区里练习真实交流。",
    communityIntro: "加入讨论、向同学提问，或进入消息与实时聊天。只有真实记录的社区活动会显示在学习日历中。",
    openCommunity: "进入社区",
    openMessages: "消息与实时聊天",
    loadError: "暂时无法读取今日学习内容，请稍后重试。",
    logError: "暂时无法读取学习日历。",
    saveError: "暂时无法保存本次学习，请重试。",
    saved: "学习记录已保存。",
    loading: "正在读取学习计划…",
    calendarLoading: "正在读取学习日历…",
    noActivity: "本月暂无学习或社区活动记录。",
    allClasses: "全部班级",
    classCalendar: "当前班级",
  },
  en: {
    kicker: "SMARTLINGO DAILY LEARNING",
    title: "Build real progress across five skills every day.",
    intro: "After placement sets your starting point, work through Vocabulary, Reading, Writing, Listening, and Dialogue. Every completion, skip, and community activity becomes part of your learning log.",
    calendarKicker: "YOUR LEARNING RECORD",
    calendarTitle: "Learning calendar",
    calendarIntro: "Review genuine five-skill and community activity by day. Calendar tiles use compact color markers; details stay below the calendar.",
    placement: "Placement status",
    placementRequired: "Complete placement to unlock daily five-skill practice.",
    placementInProgress: "Your placement is not finished yet. Continue from your saved position.",
    placementComplete: "Placement complete",
    placementUnknown: "Not started",
    startPlacement: "Start placement",
    resumePlacement: "Continue placement",
    level: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
    today: "Today's five skills",
    todayIntro: "Submit or skip each task. A skip is recorded honestly and is never presented as mastery.",
    quickCourse: "BEGINNER TRAVEL COURSE",
    courseDay: "Course day",
    visualCue: "Visual cue",
    sourceMeaning: "English meaning",
    minutes: "minutes",
    vocabulary: "Vocabulary",
    reading: "Reading",
    writing: "Writing",
    listening: "Listening",
    dialogue: "Dialogue",
    modes: { recognition: "Recognition", recall: "Recall", listening: "Listening", spelling: "Spelling", cloze: "Cloze" },
    modeHelp: {
      recognition: "See the word and recall its meaning before revealing it.",
      recall: "Use the meaning to recall and say the target word.",
      listening: "Hear the pronunciation, then recall the word and meaning.",
      spelling: "Hear the pronunciation, then type the target word.",
      cloze: "Complete the target word from its sentence context.",
    },
    pronounce: "Play pronunciation",
    reveal: "Reveal answer",
    answer: "Enter your answer",
    grades: { again: "Again", hard: "Hard", good: "Good", easy: "Easy", suspend: "Suspend" },
    gradeHelp: "After revealing, rate your recall honestly so the next review can be scheduled appropriately.",
    prompt: "Task",
    context: "Learning material",
    play: "Play listening",
    submit: "Submit task",
    skip: "Skip today",
    completed: "Completed",
    skipped: "Skipped",
    score: "Score",
    noTask: "No task is available right now. Please try again shortly.",
    response: "Enter your response",
    voice: "Voice input",
    listeningNow: "Listening",
    communityKicker: "LEARN TOGETHER",
    communityTitle: "Practice real communication in Community.",
    communityIntro: "Join a discussion, ask classmates a question, or open Messages and Live Chat. Only recorded community activity appears in your learning calendar.",
    openCommunity: "Open Community",
    openMessages: "Messages & Live Chat",
    loadError: "Today's learning plan is temporarily unavailable. Please try again.",
    logError: "Your learning calendar is temporarily unavailable.",
    saveError: "This learning activity could not be saved yet. Please retry.",
    saved: "Learning activity saved.",
    loading: "Loading your learning plan…",
    calendarLoading: "Loading your learning calendar…",
    noActivity: "No learning or community activity has been recorded this month.",
    allClasses: "All classes",
    classCalendar: "Current class",
  },
} as const;

const subscribe = () => () => undefined;

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function dateInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function localizedText(value: string | { zh?: string; en?: string } | undefined, lang: Lang) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || value.zh || "";
}

function finiteScore(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : null;
}

function taskOptionValue(option: PracticeOption) {
  return option.id || option.value || option.label;
}

function clozeText(example: string | undefined, word: string | undefined) {
  if (!example || !word) return example || "_____";
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return example.replace(new RegExp(escapedWord, "giu"), "_____");
}

export function LearningWorkspace({ lang, classId = "", calendarOnly = false }: {
  lang: Lang;
  classId?: string;
  calendarOnly?: boolean;
}) {
  const t = COPY[lang];
  const isBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  const timeZone = isBrowser ? browserTimeZone() : "UTC";
  const today = useMemo(() => dateInTimeZone(timeZone), [timeZone]);
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const calendarMonth = monthOverride ?? today.slice(0, 7);
  const [classInfo, setClassInfo] = useState<ClassSummary | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [placementChecked, setPlacementChecked] = useState(false);
  const [learning, setLearning] = useState<LearningPayload | null>(null);
  const [days, setDays] = useState<LearningLogDay[]>([]);
  const [loadedLogKey, setLoadedLogKey] = useState("");
  const [vocabularyMode, setVocabularyMode] = useState<VocabularyMode>("recognition");
  const [revealState, setRevealState] = useState({ key: "", revealed: false });
  const [answers, setAnswers] = useState<Partial<Record<Skill, string>>>({});
  const [busyKey, setBusyKey] = useState("");
  const [learningError, setLearningError] = useState("");
  const [logError, setLogError] = useState("");
  const [notice, setNotice] = useState("");
  const [dictating, setDictating] = useState<Skill | null>(null);
  const logRequestKey = `${calendarMonth}:${classId || "all"}:${timeZone}`;
  const logLoaded = loadedLogKey === logRequestKey;

  const placementComplete = placement?.status === "completed";
  const vocabulary = learning?.vocabulary ?? null;
  const vocabularyKey = `${vocabulary?.sampleId || vocabulary?.stableId || vocabulary?.taskId || vocabulary?.word || vocabulary?.form || "none"}:${vocabularyMode}`;
  const revealed = revealState.key === vocabularyKey && revealState.revealed;
  const tasks = useMemo(
    () => {
      const taskList = learning?.tasks ?? learning?.dailyTasks ?? [];
      return new Map(taskList.filter(task => PRACTICE_SKILLS.includes(task.skill)).map(task => [task.skill, task]));
    },
    [learning],
  );

  const loadLog = useCallback(async () => {
    const query = new URLSearchParams({ month: calendarMonth, timeZone });
    if (classId) query.set("classId", classId);
    try {
      const response = await fetch(`/api/learning-log?${query}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as LearningLogPayload;
      if (!response.ok) throw new Error(result.error || t.logError);
      setDays(Array.isArray(result.days) ? result.days : []);
      setLoadedLogKey(logRequestKey);
      setLogError("");
    } catch (cause) {
      setLogError(cause instanceof Error ? cause.message : t.logError);
    }
  }, [calendarMonth, classId, logRequestKey, t.logError, timeZone]);

  const loadClassAndLearning = useCallback(async () => {
    if (!classId || calendarOnly) return;
    try {
      const classResponse = await fetch(`/api/classes/${encodeURIComponent(classId)}`, { cache: "no-store" });
      const classResult = await classResponse.json().catch(() => ({})) as ClassDetailPayload;
      if (!classResponse.ok) throw new Error(classResult.error || t.loadError);
      setLearningError("");
      setClassInfo(classResult.class ?? null);
      setPlacement(classResult.placement ?? null);
      setPlacementChecked(true);
      if (classResult.placement?.status !== "completed") {
        setLearning(null);
        return;
      }

      const query = new URLSearchParams({
        date: today,
        lang,
        timeZone,
        vocabularyMode,
      });
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/learning?${query}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as LearningPayload;
      if (!response.ok) throw new Error(result.error || t.loadError);
      setLearning(result);
      setClassInfo(current => result.class ?? current);
      setPlacement(current => result.placement ?? current);
    } catch (cause) {
      setPlacementChecked(true);
      setLearningError(cause instanceof Error ? cause.message : t.loadError);
    }
  }, [calendarOnly, classId, lang, t.loadError, timeZone, today, vocabularyMode]);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ month: calendarMonth, timeZone });
    if (classId) query.set("classId", classId);
    fetch(`/api/learning-log?${query}`, { cache: "no-store" })
      .then(async response => {
        const result = await response.json().catch(() => ({})) as LearningLogPayload;
        if (!response.ok) throw new Error(result.error || t.logError);
        return result;
      })
      .then(result => {
        if (cancelled) return;
        setDays(Array.isArray(result.days) ? result.days : []);
        setLoadedLogKey(logRequestKey);
        setLogError("");
      })
      .catch(cause => {
        if (!cancelled) setLogError(cause instanceof Error ? cause.message : t.logError);
      });
    return () => { cancelled = true; };
  }, [calendarMonth, classId, logRequestKey, t.logError, timeZone]);

  useEffect(() => {
    if (!classId || calendarOnly) return undefined;
    let cancelled = false;
    fetch(`/api/classes/${encodeURIComponent(classId)}`, { cache: "no-store" })
      .then(async classResponse => {
        const classResult = await classResponse.json().catch(() => ({})) as ClassDetailPayload;
        if (!classResponse.ok) throw new Error(classResult.error || t.loadError);
        if (classResult.placement?.status !== "completed") return { classResult, learningResult: null };
        const query = new URLSearchParams({ date: today, lang, timeZone, vocabularyMode });
        const learningResponse = await fetch(`/api/classes/${encodeURIComponent(classId)}/learning?${query}`, { cache: "no-store" });
        const learningResult = await learningResponse.json().catch(() => ({})) as LearningPayload;
        if (!learningResponse.ok) throw new Error(learningResult.error || t.loadError);
        return { classResult, learningResult };
      })
      .then(result => {
        if (cancelled) return;
        setClassInfo(result.classResult.class ?? result.learningResult?.class ?? null);
        setPlacement(result.learningResult?.placement ?? result.classResult.placement ?? null);
        setLearning(result.learningResult);
        setPlacementChecked(true);
        setLearningError("");
      })
      .catch(cause => {
        if (cancelled) return;
        setPlacementChecked(true);
        setLearningError(cause instanceof Error ? cause.message : t.loadError);
      });
    return () => { cancelled = true; };
  }, [calendarOnly, classId, lang, t.loadError, timeZone, today, vocabularyMode]);

  async function postLearning(payload: Record<string, unknown>, key: string) {
    if (!classId || !placementComplete || busyKey) return null;
    setBusyKey(key);
    setNotice("");
    setLearningError("");
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/learning`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, date: today, lang, timeZone }),
      });
      const result = await response.json().catch(() => ({})) as LearningPayload;
      if (!response.ok) throw new Error(result.error || t.saveError);
      setNotice(t.saved);
      await Promise.all([loadClassAndLearning(), loadLog()]);
      return result;
    } catch (cause) {
      setLearningError(cause instanceof Error ? cause.message : t.saveError);
      return null;
    } finally {
      setBusyKey("");
    }
  }

  function playText(text: string, locale?: string) {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale || classInfo?.targetLanguage || "en-US";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function startDictation(skill: "writing" | "dialogue", locale?: string) {
    const browser = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = locale || classInfo?.targetLanguage || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => setAnswers(current => ({
      ...current,
      [skill]: `${current[skill] || ""}${current[skill] ? " " : ""}${event.results[0]?.[0]?.transcript || ""}`,
    }));
    recognition.onend = () => setDictating(null);
    recognition.onerror = () => setDictating(null);
    setDictating(skill);
    recognition.start();
  }

  function changeVocabularyMode(mode: VocabularyMode) {
    setVocabularyMode(mode);
    setRevealState({ key: "", revealed: false });
    setAnswers(current => ({ ...current, vocabulary: "" }));
  }

  async function gradeVocabulary(grade: VocabularyGrade) {
    if (!vocabulary) return;
    const sampleId = vocabulary.sampleId || vocabulary.stableId || vocabulary.taskId;
    if (!sampleId) return;
    const result = await postLearning({
      action: "vocabulary_review",
      sampleId,
      taskId: vocabulary.taskId,
      mode: vocabularyMode,
      grade,
      answer: answers.vocabulary || "",
    }, `vocabulary:${grade}`);
    if (result) {
      setRevealState({ key: "", revealed: false });
      setAnswers(current => ({ ...current, vocabulary: "" }));
    }
  }

  async function submitTask(task: PracticeTask, skip = false) {
    const answer = answers[task.skill]?.trim() || "";
    if (!skip && !answer) return;
    const result = await postLearning({
      action: skip ? "skip_task" : "submit_task",
      taskId: task.taskId,
      skill: task.skill,
      answer,
    }, `${task.skill}:${skip ? "skip" : "submit"}`);
    if (result) setAnswers(current => ({ ...current, [task.skill]: "" }));
  }

  function recordCommunityOpen(channel: "community" | "live_chat") {
    if (!classId) return;
    void fetch(`/api/classes/${encodeURIComponent(classId)}/learning`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "open_community", channel, date: today, lang, timeZone }),
      keepalive: true,
    }).catch(() => undefined);
  }

  const placementLabel = placement?.recommendedLevel
    ? t.level[placement.recommendedLevel]
    : placement?.status === "completed" && finiteScore(placement.overallScore) !== null
      ? `${finiteScore(placement.overallScore)} / 100`
      : t.placementUnknown;

  return <section className="sl-workspace" data-layout-fill="learning-workspace" data-layout-ready={placementChecked && logLoaded ? "true" : undefined} data-layout-text-fit="learning-workspace">
    <header className="sl-workspace-heading" data-layout-fill="learning-workspace-heading">
      <p className="section-kicker">{calendarOnly ? t.calendarKicker : t.kicker}</p>
      <h1>{calendarOnly ? t.calendarTitle : t.title}</h1>
      <p data-readable-copy="learning-intro">{calendarOnly ? t.calendarIntro : t.intro}</p>
    </header>

    {!calendarOnly && classId ? <section className={`sl-placement-gate ${placementComplete ? "complete" : "pending"}`} data-layout-fill="learning-placement-status">
      <div data-readable-copy>
        <p className="sl-eyebrow">{t.placement}</p>
        <h2>{placementComplete ? t.placementComplete : placement?.status === "in_progress" || placement?.status === "paused" ? t.placementInProgress : t.placementRequired}</h2>
        <p>{classInfo?.title || classId} · {placementLabel}{finiteScore(placement?.overallScore) !== null ? ` · ${finiteScore(placement?.overallScore)} / 100` : ""}</p>
      </div>
      <Link className="sl-primary-action" href={`/${lang}/classes/${encodeURIComponent(classId)}/placement`}>
        {placementComplete ? t.placementComplete : placement?.status === "in_progress" || placement?.status === "paused" ? t.resumePlacement : t.startPlacement} →
      </Link>
    </section> : null}

    {!calendarOnly && classId && !placementChecked && !learningError ? <p className="sl-loading" aria-live="polite">{t.loading}</p> : null}

    {!calendarOnly && classId && placementComplete ? <section className="sl-daily-workspace" data-layout-fill="five-skill-workspace" data-layout-ready={learning ? "true" : undefined}>
      {learning?.quickCourse ? <aside className="sl-course-day" data-layout-fill="quick-course-day">
        <div><p className="sl-eyebrow">{t.quickCourse}</p><h2>{learning.quickCourse.title[lang]}</h2><p>{t.courseDay} {learning.quickCourse.currentDay} / {learning.quickCourse.durationDays} · {learning.quickCourse.estimatedMinutes} {t.minutes}</p></div>
        <div><strong>{learning.quickCourse.scene[lang]}</strong><ul>{learning.quickCourse.skills.map(skill => <li key={skill}>{t[skill]}</li>)}</ul></div>
      </aside> : null}
      <header className="sl-section-heading" data-layout-fill="five-skill-heading">
        <p className="sl-eyebrow">{today}</p>
        <h2>{t.today}</h2>
        <p data-readable-copy="five-skill-intro">{t.todayIntro}</p>
      </header>

      {!learning && !learningError ? <p className="sl-loading" aria-live="polite">{t.loading}</p> : null}

      {learning ? <div className="sl-skill-stack">
        <article className="sl-skill-card sl-vocabulary-card" style={{ "--skill-accent": ACCENTS.vocabulary } as CSSProperties} data-layout-fill="skill-vocabulary">
          <header className="sl-skill-card-head">
            <div><span>01</span><h3>{t.vocabulary}</h3></div>
            <div className="sl-mode-picker" role="group" aria-label={lang === "zh" ? "词汇练习模式" : "Vocabulary practice mode"}>
              {VOCABULARY_MODES.map(mode => <button
                type="button"
                className={vocabularyMode === mode ? "active" : ""}
                aria-pressed={vocabularyMode === mode}
                onClick={() => changeVocabularyMode(mode)}
                key={mode}
              >{t.modes[mode]}</button>)}
            </div>
          </header>

          {vocabulary ? <div className="sl-vocabulary-practice" dir={vocabulary.direction || "ltr"}>
            <p className="sl-mode-help">{t.modeHelp[vocabularyMode]}</p>
            {vocabulary.visualCue ? <div className="sl-vocabulary-cue" aria-label={`${t.visualCue}：${localizedText(vocabulary.visualCue.label, lang)}`}>
              <span role="img" aria-hidden="true">{vocabulary.visualCue.symbol}</span>
              <div><small>{t.visualCue}</small><strong>{localizedText(vocabulary.visualCue.label, lang)}</strong></div>
            </div> : null}
            <div className="sl-word-stage">
              {vocabularyMode === "recall" ? <strong>{localizedText(vocabulary.meaning, lang)}</strong>
                : vocabularyMode === "listening" || vocabularyMode === "spelling" ? <strong aria-hidden="true">•••••</strong>
                  : vocabularyMode === "cloze" ? <strong>{clozeText(vocabulary.example, vocabulary.word || vocabulary.form)}</strong>
                    : <strong>{vocabulary.word || vocabulary.form}</strong>}
              {vocabulary.pronunciation && vocabularyMode !== "listening" && vocabularyMode !== "spelling" ? <span>{vocabulary.pronunciation}</span> : null}
            </div>
            <div className="sl-inline-actions">
              <button type="button" onClick={() => playText(vocabulary.audioText || vocabulary.word || vocabulary.form || "", vocabulary.speechLocale)}>
                ◉ {t.pronounce}
              </button>
              <button type="button" onClick={() => setRevealState({ key: vocabularyKey, revealed: true })}>{t.reveal}</button>
            </div>
            {(vocabularyMode === "spelling" || vocabularyMode === "cloze") && !revealed ? <label className="sl-answer-field">
              <span>{t.answer}</span>
              <input value={answers.vocabulary || ""} maxLength={160} onChange={event => setAnswers(current => ({ ...current, vocabulary: event.target.value }))}/>
            </label> : null}
            {revealed ? <div className="sl-vocabulary-reveal" aria-live="polite">
              <strong>{vocabulary.word || vocabulary.form}</strong>
              {vocabulary.pronunciation ? <span>{vocabulary.pronunciation}</span> : null}
              <p><b>{t.sourceMeaning}：</b>{localizedText(vocabulary.meaning, lang)}</p>
              {vocabulary.example ? <blockquote>{vocabulary.example}</blockquote> : null}
              {localizedText(vocabulary.exampleTranslation, lang) ? <small>{localizedText(vocabulary.exampleTranslation, lang)}</small> : null}
              <p className="sl-grade-help">{t.gradeHelp}</p>
              <div className="sl-grade-actions">
                {VOCABULARY_GRADES.map(grade => <button type="button" disabled={Boolean(busyKey)} onClick={() => gradeVocabulary(grade)} key={grade}>{t.grades[grade]}</button>)}
              </div>
            </div> : null}
          </div> : <p className="sl-empty-task">{t.noTask}</p>}
        </article>

        {PRACTICE_SKILLS.map((skill, index) => {
          const task = tasks.get(skill);
          const done = task?.status === "completed" || task?.status === "skipped";
          const answer = answers[skill] || "";
          return <article className="sl-skill-card" style={{ "--skill-accent": ACCENTS[skill] } as CSSProperties} data-layout-fill={`skill-${skill}`} key={skill}>
            <header className="sl-skill-card-head">
              <div><span>0{index + 2}</span><h3>{t[skill]}</h3></div>
              {task?.estimatedMinutes ? <small>≈ {task.estimatedMinutes} min</small> : null}
            </header>
            {task ? <div className="sl-task-body" dir={task.direction || "ltr"}>
              <p className="sl-task-label">{t.prompt}</p>
              <h4>{task.prompt}</h4>
              {task.context ? <div className="sl-task-context"><span>{t.context}</span><p>{task.context}</p></div> : null}
              {task.audioText ? <button className="sl-audio-action" type="button" onClick={() => playText(task.audioText || "", task.speechLocale)}>▶ {t.play}</button> : null}
              {done ? <p className={`sl-task-status ${task.status}`}>
                {task.status === "completed" ? t.completed : t.skipped}
                {finiteScore(task.score) !== null ? ` · ${t.score} ${finiteScore(task.score)}` : ""}
              </p> : <>
                {task.options?.length ? <div className="sl-task-options">
                  {task.options.map(option => {
                    const value = taskOptionValue(option);
                    return <button className={answer === value ? "selected" : ""} aria-pressed={answer === value} type="button" onClick={() => setAnswers(current => ({ ...current, [skill]: value }))} key={value}>{option.label}</button>;
                  })}
                </div> : <label className="sl-answer-field">
                  <span>{t.response}</span>
                  <textarea value={answer} maxLength={1200} onChange={event => setAnswers(current => ({ ...current, [skill]: event.target.value }))}/>
                </label>}
                {(skill === "writing" || skill === "dialogue") && !task.options?.length ? <button className="sl-voice-action" type="button" disabled={dictating === skill} onClick={() => startDictation(skill, task.speechLocale)}>
                  ◉ {dictating === skill ? t.listeningNow : t.voice}
                </button> : null}
                <div className="sl-task-actions">
                  <button type="button" disabled={Boolean(busyKey)} onClick={() => submitTask(task, true)}>{t.skip}</button>
                  <button className="sl-primary-action" type="button" disabled={Boolean(busyKey) || !answer.trim()} onClick={() => submitTask(task, false)}>{t.submit} →</button>
                </div>
              </>}
            </div> : <p className="sl-empty-task">{t.noTask}</p>}
          </article>;
        })}
      </div> : null}
    </section> : null}

    {!calendarOnly ? <section className="sl-community-entry" data-layout-fill="learning-community-entry">
      <div data-readable-copy>
        <p className="sl-eyebrow">{t.communityKicker}</p>
        <h2>{t.communityTitle}</h2>
        <p>{t.communityIntro}</p>
      </div>
      <nav aria-label={lang === "zh" ? "社区学习入口" : "Community learning links"}>
        <Link className="sl-primary-action" href={`/${lang}/community`} onClick={() => recordCommunityOpen("community")}>{t.openCommunity} →</Link>
        <Link className="sl-secondary-action" href={`/${lang}/messages`} onClick={() => recordCommunityOpen("live_chat")}>{t.openMessages}</Link>
      </nav>
    </section> : null}

    {notice ? <p className="sl-notice" aria-live="polite">{notice}</p> : null}
    {learningError ? <p className="sl-error" role="alert">{learningError}</p> : null}

    <section className="sl-calendar-stack" data-layout-fill="learning-calendar-stack">
      <header className="sl-section-heading" data-layout-fill="learning-calendar-heading">
        <p className="sl-eyebrow">{classId ? t.classCalendar : t.allClasses}</p>
        <h2>{t.calendarTitle}</h2>
        <p data-readable-copy="learning-calendar-intro">{t.calendarIntro}</p>
      </header>
      {logError ? <p className="sl-error" role="alert">{logError}</p> : null}
      {!logError && !logLoaded ? <p className="sl-calendar-loading" aria-live="polite">{t.calendarLoading}</p> : null}
      {!logError && logLoaded && days.length === 0 ? <p className="sl-calendar-loading" aria-live="polite">{t.noActivity}</p> : null}
      {logLoaded ? <LearningLogCalendar lang={lang} days={days} month={calendarMonth} onMonthChange={setMonthOverride}/> : null}
    </section>
    <LearningWorkspaceStyles/>
  </section>;
}

function LearningWorkspaceStyles() {
  return <style>{`
    .sl-workspace,.sl-workspace *{box-sizing:border-box}.sl-workspace{width:100%;max-width:none;min-width:0;margin:0;padding:clamp(48px,7vw,92px) clamp(16px,4vw,58px) clamp(76px,9vw,126px);display:grid;gap:clamp(30px,5vw,64px);color:var(--ink)}.sl-workspace-heading,.sl-section-heading{width:100%;min-width:0;display:grid;gap:12px}.sl-workspace-heading h1{width:100%;max-width:none;margin:0;font:850 clamp(40px,6vw,76px)/1.03 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.055em;overflow-wrap:anywhere}.sl-workspace-heading>p:last-child,.sl-section-heading>p:last-child{max-width:76ch;margin:0;color:var(--muted);font-size:17px;line-height:1.72}.sl-eyebrow{margin:0;color:#087d62;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.sl-placement-gate,.sl-community-entry{width:100%;min-width:0;padding:clamp(24px,4vw,48px);display:flex;align-items:center;justify-content:space-between;gap:24px;border-radius:25px}.sl-placement-gate.pending{background:#fff1cb}.sl-placement-gate.complete{background:#e3f5ed}.sl-placement-gate>div,.sl-community-entry>div{min-width:0}.sl-placement-gate h2,.sl-community-entry h2,.sl-section-heading h2{width:100%;max-width:none;margin:8px 0 10px;font:820 clamp(28px,4vw,47px)/1.08 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.035em;overflow-wrap:anywhere}.sl-placement-gate p:last-child,.sl-community-entry p:last-child{max-width:76ch;margin:0;color:#58706a;line-height:1.65}.sl-primary-action,.sl-secondary-action{min-height:46px;padding:0 19px;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:999px;font-size:16px;font-weight:850;text-align:center;text-decoration:none}.sl-primary-action{background:#0b9473;color:#fff}.sl-secondary-action{border-color:#a8bdb5;background:#fff;color:var(--ink)}button.sl-primary-action{font-family:inherit;cursor:pointer}.sl-daily-workspace,.sl-calendar-stack{width:100%;min-width:0;display:grid;gap:28px}.sl-skill-stack{width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:18px}.sl-skill-card{width:100%;min-width:0;padding:clamp(22px,4vw,44px);border:1px solid #d7e0db;border-left:5px solid var(--skill-accent);border-radius:24px;background:#fffdf8;overflow:hidden}.sl-skill-card-head{width:100%;min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap}.sl-skill-card-head>div:first-child{display:flex;align-items:baseline;gap:12px;min-width:0}.sl-skill-card-head span{color:var(--skill-accent);font-size:12px;font-weight:900}.sl-skill-card-head h3{margin:0;font:830 clamp(27px,4vw,42px)/1.08 Inter,"Noto Sans SC",sans-serif}.sl-skill-card-head>small{color:#65746f}.sl-mode-picker{min-width:0;display:flex;flex-wrap:wrap;gap:7px}.sl-mode-picker button,.sl-inline-actions button,.sl-grade-actions button,.sl-audio-action,.sl-voice-action,.sl-task-actions button{min-height:44px;padding:9px 14px;border:1px solid #bdccc5;border-radius:999px;background:#fff;color:var(--ink);font:800 16px/1.25 inherit;cursor:pointer}.sl-mode-picker button.active{border-color:#087d62;background:#e2f5ed;color:#08745e}.sl-vocabulary-practice,.sl-task-body{width:100%;min-width:0;margin-top:24px}.sl-mode-help{max-width:76ch;margin:0 0 20px;color:#5f706a;line-height:1.65}.sl-word-stage{width:100%;min-width:0;padding:clamp(24px,5vw,54px);display:grid;place-items:center;gap:10px;border-radius:20px;background:#edf7f2;text-align:center;overflow:hidden}.sl-word-stage strong{max-width:100%;font-size:clamp(34px,6vw,70px);line-height:1.12;overflow-wrap:anywhere}.sl-word-stage span{color:#547068;font-size:17px}.sl-inline-actions,.sl-grade-actions,.sl-task-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.sl-vocabulary-reveal{width:100%;min-width:0;margin-top:18px;padding:clamp(20px,3vw,32px);border:1px solid #cfe1d8;border-radius:18px;background:#fff}.sl-vocabulary-reveal>strong{display:block;font-size:clamp(28px,4vw,46px);overflow-wrap:anywhere}.sl-vocabulary-reveal>span,.sl-vocabulary-reveal>small{display:block;margin-top:6px;color:#64736e}.sl-vocabulary-reveal>p,.sl-vocabulary-reveal blockquote{max-width:76ch;line-height:1.65;overflow-wrap:anywhere}.sl-vocabulary-reveal blockquote{margin:16px 0;padding-left:16px;border-left:3px solid #0b9473}.sl-grade-help{color:#5b6d67}.sl-grade-actions button:last-child{color:#9b3e39}.sl-task-label{margin:0 0 8px;color:var(--skill-accent);font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.sl-task-body h4{width:100%;max-width:none;margin:0;font-size:clamp(22px,3vw,34px);line-height:1.25;overflow-wrap:anywhere}.sl-task-context{width:100%;min-width:0;margin-top:18px;padding:18px;border-radius:15px;background:#f1f5f2}.sl-task-context span{font-size:12px;font-weight:900}.sl-task-context p{max-width:76ch;margin:8px 0 0;white-space:pre-wrap;line-height:1.68;overflow-wrap:anywhere}.sl-audio-action,.sl-voice-action{margin-top:16px;border-color:#8cc7b6;background:#eaf8f2;color:#08745e}.sl-answer-field{width:100%;min-width:0;margin-top:18px;display:grid;gap:8px;font-weight:850}.sl-answer-field input,.sl-answer-field textarea{width:100%;min-width:0;padding:15px;border:1px solid #bdccc5;border-radius:13px;background:#fff;color:var(--ink);font:16px/1.55 inherit}.sl-answer-field textarea{min-height:135px;resize:vertical}.sl-task-options{width:100%;min-width:0;margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.sl-task-options button{min-width:0;min-height:52px;padding:12px 15px;border:1px solid #cbd7d1;border-radius:13px;background:#fff;color:var(--ink);font:750 16px/1.4 inherit;text-align:left;overflow-wrap:anywhere}.sl-task-options button.selected{border-color:#0b9473;background:#e7f7f0;box-shadow:inset 0 0 0 1px #0b9473}.sl-task-actions{justify-content:flex-end}.sl-task-actions button{padding-inline:18px}.sl-task-actions button:disabled,.sl-grade-actions button:disabled{cursor:not-allowed;opacity:.55}.sl-task-status{margin:20px 0 0;padding:14px 17px;border-radius:12px;background:#e4f6ed;color:#08745e;font-weight:850}.sl-task-status.skipped{background:#f2eee4;color:#715e3f}.sl-empty-task,.sl-loading,.sl-calendar-loading{width:100%;margin:22px 0 0;padding:18px;border-radius:13px;background:#f2f5f2;color:#5b6b66}.sl-community-entry{background:#103f35;color:#fff}.sl-community-entry .sl-eyebrow{color:#65ddb7}.sl-community-entry h2{color:#fff}.sl-community-entry p:last-child{color:#c8dbd4}.sl-community-entry nav{display:flex;flex-wrap:wrap;gap:9px}.sl-notice,.sl-error{width:100%;margin:0;padding:14px 17px;border-radius:12px}.sl-notice{background:#e3f6ed;color:#08745e}.sl-error{background:#fff0ee;color:#9a3933}.sl-calendar-stack{padding-top:8px}.sl-calendar-stack>.sl-calendar-loading{margin:0}.sl-workspace button:focus-visible,.sl-workspace a:focus-visible,.sl-workspace input:focus-visible,.sl-workspace textarea:focus-visible{outline:3px solid rgba(10,142,111,.28);outline-offset:3px}
    .sl-vocabulary-cue{width:100%;min-width:0;margin:0 0 14px;padding:16px 20px;display:flex;align-items:center;gap:14px;border:1px solid #c9ded5;border-radius:18px;background:#fff}.sl-vocabulary-cue>span{flex:0 0 auto;font-size:clamp(38px,6vw,62px);line-height:1}.sl-vocabulary-cue>div{min-width:0;display:grid;gap:3px}.sl-vocabulary-cue small{color:#5c7169;font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.sl-vocabulary-cue strong{font-size:clamp(18px,3vw,25px);overflow-wrap:anywhere}
    @media(max-width:760px){.sl-workspace{padding-inline:16px}.sl-placement-gate,.sl-community-entry{display:grid;grid-template-columns:minmax(0,1fr)}.sl-placement-gate>.sl-primary-action,.sl-community-entry nav,.sl-community-entry nav a{width:100%}.sl-task-options{grid-template-columns:minmax(0,1fr)}.sl-task-actions{display:grid;grid-template-columns:minmax(0,1fr)}.sl-task-actions button,.sl-inline-actions button,.sl-grade-actions button{width:100%}.sl-mode-picker{display:grid;grid-template-columns:1fr 1fr;width:100%}.sl-mode-picker button:last-child{grid-column:1/-1}.sl-skill-card{padding:20px 16px}.sl-skill-card-head{display:grid;grid-template-columns:minmax(0,1fr)}.sl-word-stage{padding:28px 16px}.sl-community-entry nav{display:grid;grid-template-columns:minmax(0,1fr)}}
    @media(max-width:430px){.sl-workspace-heading h1{font-size:40px}.sl-workspace-heading>p:last-child,.sl-section-heading>p:last-child{font-size:16px}.sl-placement-gate,.sl-community-entry{padding:22px 17px}.sl-mode-picker button{padding-inline:8px}.sl-grade-actions{display:grid;grid-template-columns:minmax(0,1fr)}}
    .sl-course-day{width:100%;min-width:0;padding:clamp(22px,4vw,42px);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;border-radius:24px;background:#102f2a;color:#fff}.sl-course-day h2{width:100%;margin:8px 0;font:820 clamp(27px,4vw,44px)/1.08 Inter,"Noto Sans SC",sans-serif;overflow-wrap:anywhere}.sl-course-day p{margin:0;color:#cce0d9}.sl-course-day>div:last-child{min-width:0;padding:18px;border-radius:16px;background:rgba(255,255,255,.08)}.sl-course-day strong{display:block;font-size:clamp(21px,3vw,31px);line-height:1.25;overflow-wrap:anywhere}.sl-course-day ul{margin:18px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:7px;list-style:none}.sl-course-day li{padding:7px 10px;border-radius:999px;background:#dff5ec;color:#075d4a;font-size:12px;font-weight:850}@media(max-width:760px){.sl-course-day{grid-template-columns:minmax(0,1fr)}}
  `}</style>;
}

export default LearningWorkspace;
