"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { LearningLogCalendar, type LearningLogDay } from "./LearningLogCalendar";

type Lang = "zh" | "en";
type Skill = "vocabulary" | "reading" | "writing" | "listening" | "dialogue";
type TrainingTab = Skill | "exam";
type VocabularyMode = "recognition" | "recall" | "listening" | "spelling" | "cloze";
type VocabularyGrade = "again" | "hard" | "good" | "easy" | "suspend";
type SessionStatus = "idle" | "running" | "paused" | "completing";
type BilingualText = { zh: string; en: string };
type CheckpointDraft = {
  answers?: Partial<Record<Skill, string>>;
  quizAnswers?: Record<string, string>;
  vocabularyMode?: VocabularyMode;
  vocabularyIndex?: number;
};
type StoredCheckpointDraft = {
  checkpointId: string | null;
  enrollmentId: string;
  courseDay: number;
  sessionDate: string;
  contentVersion: string;
  clientOperationId: string;
  baseRevision: number;
  baseDraft: CheckpointDraft;
  draft: CheckpointDraft;
  activeStep: TrainingTab;
  conflict?: boolean;
  serverRevision?: number;
  serverDraft?: CheckpointDraft;
  serverActiveStep?: TrainingTab;
  savedAt: number;
};

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
  feedback?: {
    correctness: "correct" | "partial" | "incorrect" | "skipped" | string;
    score: number | null;
    explanation: BilingualText;
    hint: BilingualText;
    disclaimer: BilingualText;
    contentVersion: string;
  } | null;
};

type LearningPayload = {
  class?: ClassSummary;
  placement?: Placement | null;
  date?: string;
  vocabulary?: VocabularyItem | null;
  vocabularyDeck?: VocabularyItem[];
  vocabularyDeckMeta?: {
    day: number;
    total: number;
    activeIndex: number;
    scene?: { zh: string; en: string } | null;
  };
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
  courseProgress?: {
    enrollmentId: string;
    courseDay: number;
    durationDays: number;
    dailyScore: number | null;
    dailyComplete: boolean;
    requiredSkills: Skill[];
    completedDays: number;
    currentScore: number | null;
    passScore: 60;
    earlyMasteryScore: 95;
    passed: boolean;
    completionReason: "course_complete" | "early_mastery" | null;
    certificate: { id: string; certificateNumber: string; finalScore: number; issuedAt: number } | null;
  } | null;
  sessionPreference?: { minutes: 15 | 30 | 45 | 60 };
  preferredDailyMinutes?: number;
  dailySessionPlan?: {
    id: string;
    date: string;
    contentVersion: string;
    totalMinutes: number;
    useCase: BilingualText;
    stage: BilingualText;
    dueVocabularyCount: number;
    blocks: {
      id: string;
      kind: string;
      minutes: number;
      skill?: Skill;
      rationale: BilingualText;
    }[];
  } | null;
  motivation?: {
    todayXp: number;
    totalXp: number;
    currentStreak: number;
    longestStreak: number;
    repairedDate?: string | null;
    notice: BilingualText;
  } | null;
  checkpoint?: {
    id: string | null;
    enrollmentId: string;
    courseDay: number;
    localDate: string;
    revision: number;
    drafts: CheckpointDraft;
    activeStep: string;
    contentVersion: string;
    syncStatus?: string;
  } | null;
  sessionState?: {
    enrollmentId: string;
    courseDay: number;
    durationSeconds: 3600;
    remainingSeconds: number;
    status: "ready" | "running" | "paused" | "completed";
  } | null;
  teachingPlan?: { skill: Skill | "quiz" | "community"; minutes: number; title: { zh: string; en: string }; itemCount?: number }[];
  dailyQuiz?: {
    contentVersion: string;
    questions: { id: string; prompt: string; pronunciation?: string; responseMode: "choice" | "image_free"; imageUrl?: string; options: { id: string; label: string }[] }[];
  };
  dailyQuizStatus?: { attemptNumber: number; score: number; correctCount: number; questionCount: number } | null;
  dailyQuizResult?: {
    attemptNumber: number;
    score: number;
    correctCount: number;
    questionCount: number;
    responses?: {
      questionId: string;
      correctness: string;
      score: number;
      explanation: BilingualText;
      hint: BilingualText;
      disclaimer: BilingualText;
      contentVersion: string;
    }[];
  };
  pronunciationFeedback?: {
    score: number;
    target: string;
    heard: string;
    feedback: { zh: string; en: string };
    provisional: true;
    basis: "device_transcript_match";
  };
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
const SMART_SKILLS: Skill[] = ["vocabulary", "reading", "writing", "listening", "dialogue"];
const TRAINING_TABS: TrainingTab[] = ["vocabulary", "reading", "writing", "listening", "dialogue", "exam"];
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
    sessionTitle: "开始今天的 60 分钟课程",
    sessionIntro: "系统会保存剩余时间；暂停或跨日后仍从当前课程日继续。",
    sessionSaved: "今日学习时长已保存。",
    skillsOverviewTitle: "开始前先看清今天练什么",
    skillsOverviewIntro: "五项语言能力与每日测验都在同一个学习流程中；选择时长后点击开始，系统会显示剩余时间。",
    skillDetails: {
      vocabulary: "10 个词汇闪卡：看图或提示、听标准发音、跟读比较并安排复习。",
      reading: "阅读真实生活情境短文，回答理解问题并学习常用表达。",
      writing: "从短句到实用留言，在引导下写作并获得清晰的修改建议。",
      listening: "听目标语言的词语和情境表达，训练辨音与理解。",
      dialogue: "与人工智能导师进行生活对话，练习回应、跟读和表达。",
      quiz: "完成当日词汇测验，由服务器判分并保存到学习日历。",
    },
    startSession: "开始今天的学习",
    trainingTitle: "今天的五项技能训练",
    trainingIntro: "按顺序完成五项训练，或直接选择任一标签开始。每次只显示当前技能，避免信息拥挤。",
    nextSkill: "下一项",
    previousSkill: "上一项",
    backToPlan: "返回学习计划",
    pauseSession: "暂停",
    resumeSession: "继续",
    quitSession: "退出本次学习",
    timeLeft: "剩余时间",
    sessionPaused: "已暂停",
    sessionComplete: "本次计时学习已完成。",
    sessionConfirming: "计时结束，正在由服务器核验本次学习…",
    planKicker: "原创双语学习编排",
    planTitle: "今天的新学、复习与结束回顾",
    planIntro: "系统结合学习目标、当前阶段、薄弱技能与到期复习，编排五项技能；每个模块都说明学习理由。",
    useCase: "学习目标",
    stage: "当前阶段",
    dueReviews: "到期词汇",
    preferredMinutes: "偏好时长",
    planKinds: { new: "新学", review: "间隔复习", practice: "技能练习", recap: "结束回顾" },
    motivationKicker: "学习动力",
    motivationTitle: "经验值与连续学习",
    todayXp: "今日 XP",
    totalXp: "累计 XP",
    currentStreak: "当前连续",
    longestStreak: "最长连续",
    streakDays: "天",
    xpNoCash: "XP 只用于展示学习进度，没有现金价值，也不能兑换、转让或提现。",
    repairedDate: "已使用一次连续学习修复",
    syncSaved: "草稿已跨设备同步",
    syncSaving: "正在同步草稿…",
    syncOffline: "网络暂不可用；草稿已保存在本设备，恢复后会重试。",
    syncConflict: "另一台设备已更新本课。本地草稿仍被保留，请检查后再次编辑以重试同步。",
    feedbackTitle: "本题人工智能练习反馈",
    correctness: "判定",
    explanation: "讲解",
    hint: "下一步提示",
    contentVersion: "内容版本",
    vocabularyItems: "10 个词汇",
    teachingPlan: "今日连续学习安排",
    quickCourse: "语言课程",
    courseDay: "课程日",
    courseScore: "当前课程分",
    todayScore: "今日练习分",
    passStandard: "60 分达标",
    earlyMastery: "95 分可提前结业",
    dayIncomplete: "完成今日必修技能与测验后锁定今日成绩。",
    passedCourse: "课程已通过",
    viewCertificate: "查看结业证书",
    visualCue: "视觉提示",
    sourceMeaning: "中文释义",
    flashcard: "闪卡",
    previousCard: "上一张",
    nextCard: "下一张",
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
    speakCompare: "开始跟读",
    speakingNow: "请读出上方目标词语",
    repeatHelp: "先播放标准发音，再点击“开始跟读”并清楚读出目标词语。系统会把设备识别到的语音与目标词比较，并用当前界面语言给出人工智能练习反馈。",
    pronunciationBasis: "练习评分依据设备语音转写与目标内容的匹配，并由人工智能给出纠正说明；目前不是完整的声学或口音测评。",
    recordingPreview: "本地录音试听",
    deleteRecording: "删除录音",
    recordingPrivacy: "录音仅在本页供您试听，不会上传或长期保存；评分使用设备生成的语音转写。",
    heard: "设备听到",
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
    quizKicker: "每日巩固",
    quizTitle: "每日词汇测验",
    quizIntro: "题目来自今天的词汇闪卡，由服务器判分并保存成绩。",
    quizSubmit: "提交每日测验",
    quizResult: "本次测验成绩",
    quizFeedbackTitle: "每日测验逐题反馈",
    quizRequired: "请先完成全部题目。",
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
    sessionTitle: "Start today's 60-minute course day",
    sessionIntro: "SmartLingo saves remaining time and resumes the same course day after a pause or on another date.",
    sessionSaved: "Today's study time is saved.",
    skillsOverviewTitle: "See exactly what you will practice",
    skillsOverviewIntro: "All five language skills and the daily quiz belong to one guided session. Choose a duration, press Start, and keep the remaining time visible as you learn.",
    skillDetails: {
      vocabulary: "10 vocabulary cards with visual cues, model pronunciation, speak-and-compare practice, and spaced review.",
      reading: "Read practical real-life passages, answer comprehension prompts, and notice useful expressions.",
      writing: "Build useful messages from short sentences and receive clear guided revision prompts.",
      listening: "Hear target words and situational phrases while training sound recognition and understanding.",
      dialogue: "Practice real-life responses with the AI Guru through speaking, repetition, and guided conversation.",
      quiz: "Take the daily vocabulary quiz; the server grades it and saves the score to your learning log.",
    },
    startSession: "Start today's learning",
    trainingTitle: "Today's five-skill training",
    trainingIntro: "Work in order or select any skill tab. Only the current skill is shown so the lesson stays focused.",
    nextSkill: "Next skill",
    previousSkill: "Previous skill",
    backToPlan: "Back to study plan",
    pauseSession: "Pause",
    resumeSession: "Resume",
    quitSession: "Quit this session",
    timeLeft: "Time left",
    sessionPaused: "Paused",
    sessionComplete: "This timed learning session is complete.",
    sessionConfirming: "Time is up. The server is verifying this learning session…",
    planKicker: "ORIGINAL BILINGUAL LEARNING PLAN",
    planTitle: "New learning, spaced review, and a closing recap",
    planIntro: "SmartLingo combines your goal, current stage, weaker skills, and due reviews across all five skills, with a reason for every block.",
    useCase: "Learning goal",
    stage: "Current stage",
    dueReviews: "Due vocabulary",
    preferredMinutes: "Preferred duration",
    planKinds: { new: "New material", review: "Spaced review", practice: "Skill practice", recap: "Closing recap" },
    motivationKicker: "LEARNING MOTIVATION",
    motivationTitle: "XP and learning streak",
    todayXp: "XP today",
    totalXp: "Total XP",
    currentStreak: "Current streak",
    longestStreak: "Longest streak",
    streakDays: "days",
    xpNoCash: "XP only represents learning progress. It has no cash value and cannot be redeemed, transferred, or withdrawn.",
    repairedDate: "One streak repair was used",
    syncSaved: "Draft synced across devices",
    syncSaving: "Syncing draft…",
    syncOffline: "The network is unavailable. This draft remains on this device and will retry after you edit again.",
    syncConflict: "Another device updated this lesson. Your local draft is preserved; review it and edit again to retry sync.",
    feedbackTitle: "AI practice feedback for this answer",
    correctness: "Result",
    explanation: "Explanation",
    hint: "Next-step hint",
    contentVersion: "Content version",
    vocabularyItems: "10 vocabulary items",
    teachingPlan: "Today's continuous learning plan",
    quickCourse: "LANGUAGE COURSE",
    courseDay: "Course day",
    courseScore: "Current course score",
    todayScore: "Today's practice score",
    passStandard: "60 to pass",
    earlyMastery: "95 unlocks early completion",
    dayIncomplete: "Complete today's required skills and quiz to lock the daily score.",
    passedCourse: "Course passed",
    viewCertificate: "View certificate",
    visualCue: "Visual cue",
    sourceMeaning: "English meaning",
    flashcard: "Flashcard",
    previousCard: "Previous",
    nextCard: "Next",
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
    speakCompare: "Start repetition",
    speakingNow: "Say the target word above",
    repeatHelp: "Play the model first, then select Start repetition and say the target word clearly. SmartLingo compares the device transcript with the target and returns AI practice feedback in your interface language.",
    pronunciationBasis: "The practice score uses device speech transcription matched to the target, with an AI correction explanation. It is not yet a full acoustic or accent assessment.",
    recordingPreview: "Local recording preview",
    deleteRecording: "Delete recording",
    recordingPrivacy: "The recording stays on this page for your preview and is not uploaded or retained. Scoring uses the device-generated speech transcript.",
    heard: "Device heard",
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
    quizKicker: "DAILY REVIEW",
    quizTitle: "Daily vocabulary quiz",
    quizIntro: "Questions come from today's flashcards. The server grades and saves each score.",
    quizSubmit: "Submit daily quiz",
    quizResult: "Quiz result",
    quizFeedbackTitle: "Answer-by-answer quiz feedback",
    quizRequired: "Answer every question first.",
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

function isTrainingTab(value: unknown): value is TrainingTab {
  return typeof value === "string" && TRAINING_TABS.includes(value as TrainingTab);
}

function normalizeCheckpointDraft(value: CheckpointDraft | null | undefined): CheckpointDraft {
  const answers = value?.answers && typeof value.answers === "object" ? value.answers : {};
  const quizAnswers = value?.quizAnswers && typeof value.quizAnswers === "object" ? value.quizAnswers : {};
  return {
    answers: Object.fromEntries(SMART_SKILLS.map(skill => [skill, typeof answers[skill] === "string" ? answers[skill]!.slice(0, 1200) : ""])),
    quizAnswers: Object.fromEntries(Object.entries(quizAnswers).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    vocabularyMode: value?.vocabularyMode && VOCABULARY_MODES.includes(value.vocabularyMode) ? value.vocabularyMode : "recognition",
    vocabularyIndex: Number.isInteger(value?.vocabularyIndex) ? Math.max(0, Number(value?.vocabularyIndex)) : 0,
  };
}

function createClientOperationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function planKindLabel(kind: string, lang: Lang) {
  if (kind === "new" || kind === "new_material") return lang === "zh" ? "新学" : "New material";
  if (kind === "review" || kind === "spaced_review") return lang === "zh" ? "间隔复习" : "Spaced review";
  if (kind === "recap" || kind === "closing_recap") return lang === "zh" ? "结束回顾" : "Closing recap";
  return lang === "zh" ? "技能练习" : "Skill practice";
}

function feedbackCorrectnessLabel(value: string, lang: Lang) {
  if (value === "correct") return lang === "zh" ? "正确" : "Correct";
  if (value === "partial" || value === "partially_correct") return lang === "zh" ? "部分正确" : "Partially correct";
  if (value === "skipped") return lang === "zh" ? "已跳过" : "Skipped";
  return lang === "zh" ? "需要再练习" : "Needs more practice";
}

export function LearningWorkspace({ lang, classId = "", calendarOnly = false, view = "dashboard" }: {
  lang: Lang;
  classId?: string;
  calendarOnly?: boolean;
  view?: "dashboard" | "session";
}) {
  const router = useRouter();
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
  const [vocabularyIndex, setVocabularyIndex] = useState(0);
  const [revealState, setRevealState] = useState({ key: "", revealed: false });
  const [answers, setAnswers] = useState<Partial<Record<Skill, string>>>({});
  const [busyKey, setBusyKey] = useState("");
  const [learningError, setLearningError] = useState("");
  const [logError, setLogError] = useState("");
  const [notice, setNotice] = useState("");
  const [dictating, setDictating] = useState<Skill | null>(null);
  const [pronouncing, setPronouncing] = useState(false);
  const [pronunciationFeedback, setPronunciationFeedback] = useState<LearningPayload["pronunciationFeedback"]>(undefined);
  const [pronunciationAudioUrl, setPronunciationAudioUrl] = useState("");
  const pronunciationRecorder = useRef<MediaRecorder | null>(null);
  const pronunciationStream = useRef<MediaStream | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizListeningId, setQuizListeningId] = useState("");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(view === "session" ? "running" : "idle");
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState(view === "session" ? 3600 : 0);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [activeSkill, setActiveSkill] = useState<TrainingTab>("vocabulary");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [checkpointSyncStatus, setCheckpointSyncStatus] = useState<"synced" | "saving" | "offline" | "conflict">("synced");
  const [draftRetryNonce, setDraftRetryNonce] = useState(0);
  const checkpointBaseRef = useRef<{ revision: number; draft: CheckpointDraft }>({ revision: 0, draft: {} });
  const hydratedCheckpointRef = useRef("");
  const lastDraftJsonRef = useRef("");
  const currentDraftRef = useRef<CheckpointDraft>({});
  const currentDraftStateJsonRef = useRef("");
  const conflictDraftJsonRef = useRef("");
  const checkpointConflictRef = useRef(false);
  const draftSaveTimerRef = useRef<number | null>(null);
  const draftSaveInFlightRef = useRef(false);
  const pendingOperationIdRef = useRef("");
  const pendingCheckpointIdRef = useRef<string | null | undefined>(undefined);
  const quizOperationIdRef = useRef("");
  const checkpointSyncStatusRef = useRef(checkpointSyncStatus);
  const logRequestKey = `${calendarMonth}:${classId || "all"}:${timeZone}`;
  const logLoaded = loadedLogKey === logRequestKey;
  const checkpointScopeKey = learning?.sessionState && learning.dailySessionPlan
    ? `${learning.sessionState.enrollmentId}:${learning.sessionState.courseDay}:${learning.dailySessionPlan.date}:${learning.dailySessionPlan.contentVersion}`
    : "pending";
  const checkpointScopeKeyRef = useRef("pending");
  const checkpointStorageKey = `smartlingo:learning-draft:${classId || "none"}:${checkpointScopeKey}`;

  const placementComplete = placement?.status === "completed";
  const trainingView = view === "session";
  const vocabularyDeck = learning?.vocabularyDeck?.length ? learning.vocabularyDeck : learning?.vocabulary ? [learning.vocabulary] : [];
  const vocabulary = vocabularyDeck[Math.min(vocabularyIndex, Math.max(0, vocabularyDeck.length - 1))] ?? null;
  const vocabularyKey = `${vocabulary?.sampleId || vocabulary?.stableId || vocabulary?.taskId || vocabulary?.word || vocabulary?.form || "none"}:${vocabularyMode}`;
  const revealed = revealState.key === vocabularyKey && revealState.revealed;
  const tasks = useMemo(
    () => {
      const taskList = learning?.tasks ?? learning?.dailyTasks ?? [];
      return new Map(taskList.filter(task => PRACTICE_SKILLS.includes(task.skill)).map(task => [task.skill, task]));
    },
    [learning],
  );
  const currentCheckpointDraft = useMemo<CheckpointDraft>(() => ({
    answers,
    quizAnswers,
    vocabularyMode,
    vocabularyIndex,
  }), [answers, quizAnswers, vocabularyIndex, vocabularyMode]);

  useEffect(() => {
    currentDraftRef.current = currentCheckpointDraft;
    currentDraftStateJsonRef.current = JSON.stringify({ draft: currentCheckpointDraft, activeStep: activeSkill });
    checkpointSyncStatusRef.current = checkpointSyncStatus;
    checkpointScopeKeyRef.current = checkpointScopeKey;
  }, [activeSkill, checkpointScopeKey, checkpointSyncStatus, currentCheckpointDraft]);

  useEffect(() => {
    if (sessionStatus !== "running") return undefined;
    const timer = window.setTimeout(() => {
      if (sessionRemainingSeconds <= 1) {
        setSessionRemainingSeconds(0);
        setSessionStatus("completing");
        setNotice(t.sessionConfirming);
        void (async () => {
          try {
            const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/learning`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "complete_session", remainingSeconds: 0, date: today, lang, timeZone }),
            });
            const result = await response.json().catch(() => ({})) as LearningPayload;
            if (!response.ok || !result.sessionState) throw new Error(result.error || t.saveError);
            setLearning(result);
            setSessionRemainingSeconds(Math.max(0, Math.min(3600, Number(result.sessionState.remainingSeconds))));
            if (result.sessionState.status === "completed") {
              setSessionStatus("idle");
              setSessionPanelOpen(false);
              setNotice(t.sessionComplete);
            } else {
              setSessionStatus(result.sessionState.status === "running" ? "running" : result.sessionState.status === "paused" ? "paused" : "idle");
              setNotice(t.sessionSaved);
            }
          } catch (cause) {
            setSessionStatus("paused");
            setLearningError(cause instanceof Error ? cause.message : t.saveError);
            setNotice("");
          }
        })();
        return;
      }
      setSessionRemainingSeconds(sessionRemainingSeconds - 1);
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [classId, lang, sessionRemainingSeconds, sessionStatus, t.saveError, t.sessionComplete, t.sessionConfirming, t.sessionSaved, timeZone, today]);

  useEffect(() => () => {
    pronunciationRecorder.current?.stop();
    pronunciationStream.current?.getTracks().forEach(track => track.stop());
    if (pronunciationAudioUrl) URL.revokeObjectURL(pronunciationAudioUrl);
  }, [pronunciationAudioUrl]);

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
        if (result.learningResult?.sessionState) {
          setSessionRemainingSeconds(Math.max(0, Math.min(3600, Number(result.learningResult.sessionState.remainingSeconds))));
          setSessionStatus(result.learningResult.sessionState.status === "running" ? "running" : result.learningResult.sessionState.status === "paused" ? "paused" : "idle");
        }
        if (!result.learningResult?.checkpoint) setVocabularyIndex(result.learningResult?.vocabularyDeckMeta?.activeIndex ?? 0);
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

  useEffect(() => {
    const checkpoint = learning?.checkpoint;
    const sessionState = learning?.sessionState;
    const dailyPlan = learning?.dailySessionPlan;
    if (!dailyPlan || !sessionState) return;
    const hydrationKey = `${checkpointScopeKey}:${checkpoint?.id || "pending"}:${checkpoint?.contentVersion || learning.dailyQuiz?.contentVersion || dailyPlan.id}`;
    if (hydratedCheckpointRef.current === hydrationKey) return;
    const serverRawDraft = checkpoint?.drafts ?? {};
    const serverDraft = normalizeCheckpointDraft(serverRawDraft);
    const serverStep = isTrainingTab(checkpoint?.activeStep) ? checkpoint.activeStep : "vocabulary";
    let stored: StoredCheckpointDraft | null = null;
    try {
      const raw = window.sessionStorage.getItem(checkpointStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredCheckpointDraft>;
        if (
          typeof parsed.clientOperationId === "string"
          && typeof parsed.baseRevision === "number"
          && parsed.draft
          && parsed.enrollmentId === sessionState.enrollmentId
          && parsed.courseDay === sessionState.courseDay
          && parsed.sessionDate === dailyPlan.date
          && parsed.contentVersion === dailyPlan.contentVersion
          && (parsed.checkpointId === (checkpoint?.id ?? null) || parsed.checkpointId === null)
          && (!parsed.conflict || (
            Number.isInteger(parsed.serverRevision)
            && Number(parsed.serverRevision) >= 1
            && parsed.serverDraft
            && isTrainingTab(parsed.serverActiveStep)
          ))
        ) stored = parsed as StoredCheckpointDraft;
      }
    } catch {
      stored = null;
    }
    const selectedDraft = normalizeCheckpointDraft(stored?.draft ?? serverDraft);
    const selectedStep = stored && isTrainingTab(stored.activeStep) ? stored.activeStep : serverStep;
    const selectedSerialized = JSON.stringify({ draft: selectedDraft, activeStep: selectedStep });
    const serverSerialized = JSON.stringify({ draft: serverDraft, activeStep: serverStep });
    const storedConflict = Boolean(stored?.conflict);
    const storedAlreadyAligned = Boolean(stored && !storedConflict && selectedSerialized === serverSerialized);
    setAnswers(selectedDraft.answers ?? {});
    setQuizAnswers(selectedDraft.quizAnswers ?? {});
    setVocabularyMode(selectedDraft.vocabularyMode ?? "recognition");
    setVocabularyIndex(selectedDraft.vocabularyIndex ?? 0);
    setActiveSkill(selectedStep);
    checkpointBaseRef.current = storedConflict
      ? { revision: stored!.serverRevision!, draft: stored!.serverDraft! }
      : stored && !storedAlreadyAligned
        ? { revision: stored.baseRevision, draft: stored.baseDraft }
      : { revision: checkpoint?.revision ?? 0, draft: serverRawDraft };
    pendingOperationIdRef.current = storedConflict || storedAlreadyAligned ? "" : stored?.clientOperationId ?? "";
    pendingCheckpointIdRef.current = storedConflict || storedAlreadyAligned ? undefined : stored ? stored.checkpointId : undefined;
    checkpointConflictRef.current = storedConflict;
    conflictDraftJsonRef.current = storedConflict
      ? selectedSerialized
      : "";
    lastDraftJsonRef.current = serverSerialized;
    hydratedCheckpointRef.current = hydrationKey;
    if (storedAlreadyAligned) window.sessionStorage.removeItem(checkpointStorageKey);
    setCheckpointSyncStatus(storedConflict ? "conflict" : stored && !storedAlreadyAligned ? "offline" : checkpoint?.syncStatus === "conflict" ? "conflict" : "synced");
    setDraftHydrated(true);
  }, [checkpointScopeKey, checkpointStorageKey, learning?.checkpoint, learning?.dailyQuiz?.contentVersion, learning?.dailySessionPlan, learning?.sessionState]);

  useEffect(() => {
    if (checkpointSyncStatus !== "offline") return undefined;
    const retry = () => setDraftRetryNonce(value => value + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [checkpointSyncStatus]);

  useEffect(() => {
    const checkpoint = learning?.checkpoint;
    if (!draftHydrated || !learning?.dailySessionPlan || !learning.sessionState) return undefined;
    const requestEnrollmentId = learning.sessionState.enrollmentId;
    const requestCourseDay = learning.sessionState.courseDay;
    const requestSessionDate = learning.dailySessionPlan.date;
    const requestContentVersion = learning.dailySessionPlan.contentVersion;
    const requestScopeKey = checkpointScopeKey;
    const serialized = JSON.stringify({ draft: currentCheckpointDraft, activeStep: activeSkill });
    if (serialized === lastDraftJsonRef.current) return undefined;
    if (checkpointConflictRef.current && serialized === conflictDraftJsonRef.current) return undefined;
    if (checkpointConflictRef.current) checkpointConflictRef.current = false;
    if (!pendingOperationIdRef.current) {
      pendingOperationIdRef.current = createClientOperationId();
      pendingCheckpointIdRef.current = checkpoint?.id ?? null;
    }
    const operationId = pendingOperationIdRef.current;
    const requestCheckpointId = pendingCheckpointIdRef.current === undefined
      ? checkpoint?.id ?? null
      : pendingCheckpointIdRef.current;
    const baseRevision = checkpointBaseRef.current.revision;
    const baseDraft = checkpointBaseRef.current.draft;
    const stored: StoredCheckpointDraft = {
      checkpointId: requestCheckpointId,
      enrollmentId: requestEnrollmentId,
      courseDay: requestCourseDay,
      sessionDate: requestSessionDate,
      contentVersion: requestContentVersion,
      clientOperationId: operationId,
      baseRevision,
      baseDraft,
      draft: currentCheckpointDraft,
      activeStep: activeSkill,
      savedAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(checkpointStorageKey, JSON.stringify(stored));
    } catch {
      // Session storage is only a weak-network backup; server sync still proceeds.
    }
    setCheckpointSyncStatus("saving");
    if (draftSaveTimerRef.current !== null) window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = window.setTimeout(() => {
      if (draftSaveInFlightRef.current) {
        setDraftRetryNonce(value => value + 1);
        return;
      }
      draftSaveInFlightRef.current = true;
      void (async () => {
        try {
          const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/learning`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "save_checkpoint",
              checkpointId: requestCheckpointId,
              enrollmentId: requestEnrollmentId,
              courseDay: requestCourseDay,
              checkpointDate: requestSessionDate,
              checkpointContentVersion: requestContentVersion,
              clientOperationId: operationId,
              baseRevision,
              baseDraft,
              draft: currentCheckpointDraft,
              activeStep: activeSkill,
              date: today,
              lang,
              timeZone,
            }),
          });
          const result = await response.json().catch(() => ({})) as LearningPayload;
          const nextCheckpoint = result.checkpoint;
          if (checkpointScopeKeyRef.current !== requestScopeKey) {
            if (response.ok) window.sessionStorage.removeItem(checkpointStorageKey);
            return;
          }
          if (nextCheckpoint && (nextCheckpoint.enrollmentId !== requestEnrollmentId
            || nextCheckpoint.courseDay !== requestCourseDay
            || nextCheckpoint.localDate !== requestSessionDate
            || nextCheckpoint.contentVersion !== requestContentVersion)) {
            throw new Error(t.saveError);
          }
          if (response.status === 409 && nextCheckpoint) {
            const latestDraft = nextCheckpoint.drafts ?? {};
            checkpointBaseRef.current = { revision: nextCheckpoint.revision, draft: latestDraft };
            pendingOperationIdRef.current = "";
            pendingCheckpointIdRef.current = undefined;
            checkpointConflictRef.current = true;
            conflictDraftJsonRef.current = currentDraftStateJsonRef.current;
            setLearning(current => current ? { ...current, checkpoint: nextCheckpoint } : current);
            setCheckpointSyncStatus("conflict");
            try {
              window.sessionStorage.setItem(checkpointStorageKey, JSON.stringify({
                ...stored,
                checkpointId: nextCheckpoint.id,
                clientOperationId: "",
                conflict: true,
                serverRevision: nextCheckpoint.revision,
                serverDraft: latestDraft,
                serverActiveStep: isTrainingTab(nextCheckpoint.activeStep) ? nextCheckpoint.activeStep : "vocabulary",
                draft: currentDraftRef.current,
                savedAt: Date.now(),
              } satisfies StoredCheckpointDraft));
            } catch {
              // The in-memory local draft remains intact even when storage is blocked.
            }
            return;
          }
          if (!response.ok || !nextCheckpoint) throw new Error(result.error || t.saveError);
          const latestDraft = nextCheckpoint.drafts ?? {};
          checkpointBaseRef.current = { revision: nextCheckpoint.revision, draft: latestDraft };
          pendingOperationIdRef.current = "";
          pendingCheckpointIdRef.current = undefined;
          checkpointConflictRef.current = false;
          conflictDraftJsonRef.current = "";
          setLearning(current => current ? { ...current, ...result, checkpoint: nextCheckpoint } : result);
          if (currentDraftStateJsonRef.current === serialized) {
            lastDraftJsonRef.current = serialized;
            window.sessionStorage.removeItem(checkpointStorageKey);
            setCheckpointSyncStatus("synced");
          } else {
            setDraftRetryNonce(value => value + 1);
          }
        } catch {
          setCheckpointSyncStatus("offline");
        } finally {
          draftSaveInFlightRef.current = false;
        }
      })();
    }, 750);
    return () => {
      if (draftSaveTimerRef.current !== null) window.clearTimeout(draftSaveTimerRef.current);
    };
  }, [activeSkill, checkpointScopeKey, checkpointStorageKey, classId, currentCheckpointDraft, draftHydrated, draftRetryNonce, lang, learning?.checkpoint, learning?.dailySessionPlan, learning?.sessionState, t.saveError, timeZone, today]);

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
      setLearning(result);
      if (result.checkpoint) {
        checkpointBaseRef.current = {
          revision: result.checkpoint.revision,
          draft: result.checkpoint.drafts ?? {},
        };
      }
      if (result.sessionState) {
        setSessionRemainingSeconds(Math.max(0, Math.min(3600, Number(result.sessionState.remainingSeconds))));
        setSessionStatus(result.sessionState.status === "running" ? "running" : result.sessionState.status === "paused" ? "paused" : "idle");
      }
      setClassInfo(current => result.class ?? current);
      setPlacement(current => result.placement ?? current);
      await loadLog();
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

  async function startPronunciationPractice(item: VocabularyItem) {
    const sampleId = item.sampleId || item.stableId || item.taskId;
    if (!sampleId) return;
    const browser = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) {
      setLearningError(lang === "zh" ? "当前浏览器不支持语音转写，请使用 Safari 或 Chrome 的最新版本。" : "Speech transcription is unavailable in this browser. Try the latest Safari or Chrome.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setLearningError(lang === "zh" ? "无法使用麦克风，请检查浏览器权限。" : "The microphone is unavailable. Check browser permission.");
      return;
    }
    if (pronunciationAudioUrl) {
      URL.revokeObjectURL(pronunciationAudioUrl);
      setPronunciationAudioUrl("");
    }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    pronunciationRecorder.current = recorder;
    pronunciationStream.current = stream;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      pronunciationStream.current = null;
      if (chunks.length) setPronunciationAudioUrl(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" })));
    };
    const recognition = new Recognition();
    recognition.lang = item.speechLocale || classInfo?.targetLanguage || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      void postLearning({ action: "pronunciation_review", sampleId, transcript }, `pronunciation:${sampleId}`).then(result => {
        if (result?.pronunciationFeedback) setPronunciationFeedback(result.pronunciationFeedback);
      });
    };
    recognition.onend = () => {
      setPronouncing(false);
      if (recorder.state !== "inactive") recorder.stop();
    };
    recognition.onerror = () => {
      setPronouncing(false);
      if (recorder.state !== "inactive") recorder.stop();
    };
    setPronunciationFeedback(undefined);
    setPronouncing(true);
    recorder.start();
    recognition.start();
  }

  async function startSession() {
    const result = await postLearning({ action: "start_session" }, "session-start");
    if (result) router.push(`/${lang}/classes/${encodeURIComponent(classId)}/learn/session`);
  }

  async function toggleSession() {
    const nextAction = sessionStatus === "paused" ? "resume_session" : "pause_session";
    const result = await postLearning({ action: nextAction, remainingSeconds: sessionRemainingSeconds }, `session-${nextAction}`);
    if (result) setSessionPanelOpen(false);
  }

  async function quitSession() {
    await postLearning({ action: "pause_session", remainingSeconds: sessionRemainingSeconds }, "session-quit");
    setSessionStatus("idle");
    setSessionPanelOpen(false);
    router.push(`/${lang}/classes/${encodeURIComponent(classId)}/learn`);
  }

  function formattedSessionTime() {
    const minutes = Math.floor(sessionRemainingSeconds / 60);
    const seconds = sessionRemainingSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function selectTrainingTab(nextTab: TrainingTab, focus = false) {
    setActiveSkill(nextTab);
    if (focus) window.requestAnimationFrame(() => document.getElementById(`sl-learning-tab-${nextTab}`)?.focus());
  }

  function handleTrainingTabKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TRAINING_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + TRAINING_TABS.length) % TRAINING_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TRAINING_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTrainingTab(TRAINING_TABS[nextIndex], true);
  }

  async function submitDailyQuiz() {
    const questions = learning?.dailyQuiz?.questions || [];
    if (!questions.length || questions.some(question => !quizAnswers[question.id])) {
      setNotice(t.quizRequired);
      return;
    }
    if (!quizOperationIdRef.current) quizOperationIdRef.current = crypto.randomUUID();
    const result = await postLearning({ action: "submit_daily_quiz", answers: quizAnswers, clientOperationId: quizOperationIdRef.current }, "daily-quiz");
    if (result?.dailyQuizResult) {
      quizOperationIdRef.current = "";
      setQuizAnswers({});
    }
  }

  function startQuizSpeech(questionId: string) {
    const browser = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) {
      setLearningError(lang === "zh" ? "当前浏览器不支持语音转写，请直接书写答案。" : "Speech transcription is unavailable. Type your answer instead.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = vocabulary?.speechLocale || classInfo?.targetLanguage || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => setQuizAnswers(current => ({ ...current, [questionId]: `free:${event.results[0]?.[0]?.transcript || ""}` }));
    recognition.onend = () => setQuizListeningId("");
    recognition.onerror = () => setQuizListeningId("");
    setQuizListeningId(questionId);
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
      setVocabularyIndex(current => Math.min(current + 1, Math.max(0, (result.vocabularyDeck?.length || 1) - 1)));
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

  return <section className="sl-workspace" data-layout-fill="learning-workspace" data-layout-ready={placementChecked && logLoaded ? "true" : undefined}>
    <header className="sl-workspace-heading" data-layout-fill="learning-workspace-heading">
      <p className="section-kicker">{calendarOnly ? t.calendarKicker : t.kicker}</p>
      <h1 data-layout-text-fit="learning-workspace-title">{calendarOnly ? t.calendarTitle : t.title}</h1>
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
        {learning.courseProgress ? <div className="sl-course-score" aria-live="polite">
          <div><span>{t.courseScore}</span><strong>{learning.courseProgress.currentScore ?? "—"}<small> / 100</small></strong></div>
          <div><span>{t.todayScore}</span><strong>{learning.courseProgress.dailyScore ?? "—"}<small> / 100</small></strong></div>
          <p>{learning.courseProgress.dailyComplete ? `${t.passStandard} · ${t.earlyMastery}` : t.dayIncomplete}</p>
          {learning.courseProgress.certificate ? <Link href={`/${lang}/certificates/${encodeURIComponent(learning.courseProgress.certificate.id)}`} className="sl-certificate-link">{t.passedCourse} · {t.viewCertificate} →</Link> : null}
        </div> : null}
      </aside> : null}
      {learning?.motivation ? <section className="sl-motivation-card" data-layout-fill="learning-motivation" aria-labelledby="sl-motivation-title">
        <header>
          <p className="sl-eyebrow">{t.motivationKicker}</p>
          <h2 id="sl-motivation-title">{t.motivationTitle}</h2>
          <p>{learning.motivation.notice.zh}</p>
          <p lang="en">{learning.motivation.notice.en}</p>
        </header>
        <dl>
          <div><dt>{t.todayXp}</dt><dd>{learning.motivation.todayXp} XP</dd></div>
          <div><dt>{t.totalXp}</dt><dd>{learning.motivation.totalXp} XP</dd></div>
          <div><dt>{t.currentStreak}</dt><dd>{learning.motivation.currentStreak} {t.streakDays}</dd></div>
          <div><dt>{t.longestStreak}</dt><dd>{learning.motivation.longestStreak} {t.streakDays}</dd></div>
        </dl>
        {learning.motivation.repairedDate ? <p className="sl-streak-repair">{t.repairedDate} · {learning.motivation.repairedDate}</p> : null}
        <small>{t.xpNoCash}</small>
        <small lang={lang === "zh" ? "en" : "zh"}>{lang === "zh" ? COPY.en.xpNoCash : COPY.zh.xpNoCash}</small>
      </section> : null}
      {learning?.dailySessionPlan ? <section className="sl-daily-plan" data-layout-fill="daily-learning-plan" aria-labelledby="sl-daily-plan-title">
        <header>
          <p className="sl-eyebrow">{t.planKicker}</p>
          <h2 id="sl-daily-plan-title">{t.planTitle}</h2>
          <p>{t.planIntro}</p>
        </header>
        <dl className="sl-plan-context">
          <div><dt>{t.useCase}</dt><dd><strong>{learning.dailySessionPlan.useCase.zh}</strong><span lang="en">{learning.dailySessionPlan.useCase.en}</span></dd></div>
          <div><dt>{t.stage}</dt><dd><strong>{learning.dailySessionPlan.stage.zh}</strong><span lang="en">{learning.dailySessionPlan.stage.en}</span></dd></div>
          <div><dt>{t.dueReviews}</dt><dd><strong>{learning.dailySessionPlan.dueVocabularyCount}</strong></dd></div>
          <div><dt>{t.preferredMinutes}</dt><dd><strong>{learning.preferredDailyMinutes ?? learning.dailySessionPlan.totalMinutes} {t.minutes}</strong></dd></div>
        </dl>
        <ol className="sl-plan-blocks">
          {learning.dailySessionPlan.blocks.map((block, index) => <li className={block.kind.toLowerCase().includes("recap") ? "recap" : ""} key={block.id}>
            <span className="sl-plan-number">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p><strong>{planKindLabel(block.kind, lang)}</strong>{block.skill ? <span>{t[block.skill]}</span> : null}<b>{block.minutes} {t.minutes}</b></p>
              <p>{block.rationale.zh}</p>
              <p lang="en">{block.rationale.en}</p>
            </div>
          </li>)}
        </ol>
        <p className={`sl-checkpoint-status ${checkpointSyncStatus}`} aria-live="polite">
          {checkpointSyncStatus === "saving" ? t.syncSaving : checkpointSyncStatus === "offline" ? t.syncOffline : checkpointSyncStatus === "conflict" ? t.syncConflict : t.syncSaved}
          <small>{t.contentVersion} {learning.checkpoint?.contentVersion || learning.dailyQuiz?.contentVersion || learning.dailySessionPlan.id} · r{learning.checkpoint?.revision ?? 0}</small>
        </p>
      </section> : null}
      {!trainingView && learning ? <section className="sl-session-planner" data-layout-fill="daily-session-planner">
        <header><p className="sl-eyebrow">{t.teachingPlan}</p><h2>{t.sessionTitle}</h2><p>{lang === "zh" ? "每个课程日固定 60 分钟。未完成会保存剩余时间，明天从同一课程日继续；考试标签始终开放。" : "Every course day is a fixed 60-minute session. Unfinished time is saved across days, and the Exam tab always remains available."}</p></header>
        <div className="sl-fixed-duration" style={{ width: "100%", padding: 18, display: "grid", gridTemplateColumns: "auto auto minmax(0,1fr)", alignItems: "baseline", gap: 8, border: "1px solid #c8ddd4", borderRadius: 16, background: "#fff" }}><strong style={{ fontSize: 38, color: "#087d62" }}>60</strong><span>{t.minutes}</span><small style={{ justifySelf: "end", color: "#60716b" }}>{learning.sessionState?.remainingSeconds === 3600 ? (lang === "zh" ? "尚未开始" : "Not started") : `${lang === "zh" ? "剩余" : "Remaining"} ${Math.ceil((learning.sessionState?.remainingSeconds ?? 3600) / 60)} ${t.minutes}`}</small></div>
        <button type="button" className="sl-session-start" disabled={Boolean(busyKey) || learning.sessionState?.status === "completed"} onClick={startSession}><span aria-hidden="true">▶</span>{learning.sessionState?.status === "paused" ? t.resumeSession : t.startSession}</button>
      </section> : null}
      {trainingView ? <><header className="sl-section-heading" id="today-five-skills" data-layout-fill="five-skill-heading">
        <p className="sl-eyebrow">{today}</p>
        <h2>{t.trainingTitle}</h2>
        <p data-readable-copy="five-skill-intro">{t.trainingIntro}</p>
      </header>
      <nav className="sl-skill-tabs" role="tablist" aria-label={t.trainingTitle}>
        {TRAINING_TABS.map((skill, index) => <button
          type="button"
          role="tab"
          id={`sl-learning-tab-${skill}`}
          aria-controls={`sl-learning-panel-${skill}`}
          aria-selected={activeSkill === skill}
          tabIndex={activeSkill === skill ? 0 : -1}
          className={activeSkill === skill ? "active" : ""}
          onClick={() => selectTrainingTab(skill)}
          onKeyDown={event => handleTrainingTabKey(event, index)}
          key={skill}
        ><span>0{index + 1}</span>{skill === "exam" ? (lang === "zh" ? "考试" : "Exam") : t[skill]}</button>)}
      </nav></> : null}

      {!learning && !learningError ? <p className="sl-loading" aria-live="polite">{t.loading}</p> : null}

      {trainingView && learning && activeSkill !== "exam" ? <div
        className="sl-skill-stack"
        role="tabpanel"
        id={`sl-learning-panel-${activeSkill}`}
        aria-labelledby={`sl-learning-tab-${activeSkill}`}
        tabIndex={0}
      >
        {activeSkill === "vocabulary" ? <article className="sl-skill-card sl-vocabulary-card" style={{ "--skill-accent": ACCENTS.vocabulary } as CSSProperties} data-layout-fill="skill-vocabulary">
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
            <div className="sl-flashcard-progress">
              <strong>{t.flashcard} {vocabularyIndex + 1} / {vocabularyDeck.length}</strong>
              <div>
                <button type="button" disabled={vocabularyIndex === 0} onClick={() => { setVocabularyIndex(current => Math.max(0, current - 1)); setRevealState({ key: "", revealed: false }); }}>{t.previousCard}</button>
                <button type="button" disabled={vocabularyIndex >= vocabularyDeck.length - 1} onClick={() => { setVocabularyIndex(current => Math.min(vocabularyDeck.length - 1, current + 1)); setRevealState({ key: "", revealed: false }); }}>{t.nextCard}</button>
              </div>
            </div>
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
              <button type="button" disabled={pronouncing || Boolean(busyKey)} onClick={() => startPronunciationPractice(vocabulary)}>◉ {pronouncing ? t.speakingNow : t.speakCompare}</button>
              <button type="button" onClick={() => setRevealState({ key: vocabularyKey, revealed: true })}>{t.reveal}</button>
            </div>
            <p className="sl-repeat-help">{t.repeatHelp}</p>
            {pronunciationFeedback ? <div className="sl-pronunciation-feedback" aria-live="polite">
              <strong>{t.score} {pronunciationFeedback.score} / 100</strong>
              <p>{localizedText(pronunciationFeedback.feedback, lang)}</p>
              <p><b>{t.heard}：</b>{pronunciationFeedback.heard}</p>
              <small>{t.pronunciationBasis}</small>
            </div> : null}
            {pronunciationAudioUrl ? <div className="sl-recording-preview">
              <strong>{t.recordingPreview}</strong>
              <audio controls preload="metadata" src={pronunciationAudioUrl}/>
              <button type="button" onClick={() => { URL.revokeObjectURL(pronunciationAudioUrl); setPronunciationAudioUrl(""); }}>{t.deleteRecording}</button>
              <small>{t.recordingPrivacy}</small>
            </div> : null}
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
        </article> : null}

        {PRACTICE_SKILLS.filter(skill => skill === activeSkill).map((skill, index) => {
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
              {done ? <>
                <p className={`sl-task-status ${task.status}`}>
                  {task.status === "completed" ? t.completed : t.skipped}
                  {finiteScore(task.score) !== null ? ` · ${t.score} ${finiteScore(task.score)}` : ""}
                </p>
                {task.feedback ? <section className={`sl-answer-feedback ${task.feedback.correctness === "partially_correct" ? "partial" : task.feedback.correctness}`} aria-label={t.feedbackTitle} aria-live="polite">
                  <header><p className="sl-eyebrow">{t.feedbackTitle}</p><strong>{t.correctness}：{feedbackCorrectnessLabel(task.feedback.correctness, lang)} · {t.score} {finiteScore(task.feedback.score) ?? 0} / 100</strong></header>
                  <div><b>{t.explanation}</b><p>{task.feedback.explanation.zh}</p><p lang="en">{task.feedback.explanation.en}</p></div>
                  <div><b>{t.hint}</b><p>{task.feedback.hint.zh}</p><p lang="en">{task.feedback.hint.en}</p></div>
                  <small>{task.feedback.disclaimer.zh}</small>
                  <small lang="en">{task.feedback.disclaimer.en}</small>
                  <small>{t.contentVersion} {task.feedback.contentVersion}</small>
                </section> : null}
              </> : <>
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
        <nav className="sl-skill-stepper" aria-label={t.trainingTitle}>
          <button type="button" disabled={activeSkill === "vocabulary"} onClick={() => setActiveSkill(SMART_SKILLS[Math.max(0, SMART_SKILLS.indexOf(activeSkill as Skill) - 1)])}>← {t.previousSkill}</button>
          <Link href={`/${lang}/classes/${encodeURIComponent(classId)}/learn`}>{t.backToPlan}</Link>
          <button type="button" onClick={() => setActiveSkill(activeSkill === "dialogue" ? "exam" : SMART_SKILLS[Math.min(SMART_SKILLS.length - 1, SMART_SKILLS.indexOf(activeSkill as Skill) + 1)])}>{activeSkill === "dialogue" ? (lang === "zh" ? "前往考试" : "Go to exam") : t.nextSkill} →</button>
        </nav>
      </div> : null}
      {trainingView && activeSkill === "exam" && learning?.dailyQuiz?.questions?.length ? <section
        className="sl-daily-quiz"
        data-layout-fill="daily-vocabulary-quiz"
        role="tabpanel"
        id="sl-learning-panel-exam"
        aria-labelledby="sl-learning-tab-exam"
        tabIndex={0}
      >
        <header><p className="sl-eyebrow">{t.quizKicker}</p><h2>{t.quizTitle}</h2><p>{t.quizIntro}</p></header>
        {learning.dailyQuizStatus ? <p className="sl-quiz-status">{t.quizResult}：{learning.dailyQuizStatus.score} / 100 · {learning.dailyQuizStatus.correctCount} / {learning.dailyQuizStatus.questionCount}</p> : null}
        <div className="sl-quiz-questions">{learning.dailyQuiz.questions.map((question, index) => <fieldset key={question.id}>
          <legend>{index + 1}. <span dir={learning.class?.targetLanguage === "ar" ? "rtl" : "ltr"}>{question.prompt}</span>{question.pronunciation ? <small>{question.pronunciation}</small> : null}</legend>
          {question.imageUrl ? <figure className="sl-quiz-image"><img src={question.imageUrl} alt={lang === "zh" ? "本题情境图" : "Visual prompt for this question"} /><figcaption>{lang === "zh" ? "观察图片后，选择、说出或写出最合适的答案。" : "Study the image, then choose, say, or write the best answer."}</figcaption></figure> : null}
          {question.responseMode === "image_free" ? <div className="sl-quiz-free-answer"><label><span>{lang === "zh" ? "用所学语言说出或写出图片内容" : "Say or write the image answer in the language you are learning"}</span><input value={(quizAnswers[question.id] || "").replace(/^free:/, "")} maxLength={75} autoComplete="off" onChange={event => setQuizAnswers(current => ({ ...current, [question.id]: `free:${event.target.value}` }))}/></label><button type="button" className={quizListeningId === question.id ? "selected" : ""} onClick={() => startQuizSpeech(question.id)}>{quizListeningId === question.id ? (lang === "zh" ? "正在聆听…" : "Listening…") : (lang === "zh" ? "使用麦克风回答" : "Answer by microphone")}</button></div> : <div>{question.options.map(option => <button type="button" className={quizAnswers[question.id] === option.id ? "selected" : ""} aria-pressed={quizAnswers[question.id] === option.id} key={option.id} onClick={() => setQuizAnswers(current => ({ ...current, [question.id]: option.id }))}>{option.label}</button>)}</div>}
        </fieldset>)}</div>
        {learning.dailyQuizResult?.responses?.length ? <section className="sl-quiz-feedback" aria-live="polite">
          <h3>{t.quizFeedbackTitle}</h3>
          <ol>{learning.dailyQuizResult.responses.map((feedback, index) => <li className={feedback.correctness === "partially_correct" ? "partial" : feedback.correctness} key={feedback.questionId}>
            <header><strong>{index + 1}. {feedbackCorrectnessLabel(feedback.correctness, lang)}</strong><span>{t.score} {finiteScore(feedback.score) ?? 0} / 100</span></header>
            <div><b>{t.explanation}</b><p>{feedback.explanation.zh}</p><p lang="en">{feedback.explanation.en}</p></div>
            <div><b>{t.hint}</b><p>{feedback.hint.zh}</p><p lang="en">{feedback.hint.en}</p></div>
            <small>{feedback.disclaimer.zh}</small><small lang="en">{feedback.disclaimer.en}</small>
            <small>{t.contentVersion} {feedback.contentVersion}</small>
          </li>)}</ol>
        </section> : null}
        <button type="button" className="sl-primary-action" disabled={Boolean(busyKey)} onClick={submitDailyQuiz}>{t.quizSubmit} →</button>
      </section> : null}
      {trainingView && activeSkill === "exam" && learning && !learning.dailyQuiz?.questions?.length ? <section
        className="sl-daily-quiz"
        data-layout-fill="daily-vocabulary-quiz-empty"
        role="tabpanel"
        id="sl-learning-panel-exam"
        aria-labelledby="sl-learning-tab-exam"
        tabIndex={0}
      ><p className="sl-empty-task">{t.noTask}</p></section> : null}
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

    {trainingView && sessionStatus !== "idle" ? <aside className={`sl-session-timer ${sessionStatus}`} data-layout-allow-overlap="intentional" aria-label={`${t.timeLeft} ${formattedSessionTime()}`}>
      <button type="button" className="sl-session-timer-summary" disabled={sessionStatus === "completing"} onClick={() => setSessionPanelOpen(open => !open)} aria-expanded={sessionPanelOpen}>
        <strong>{sessionStatus === "completing" ? "•••" : formattedSessionTime()}</strong>
      </button>
      {sessionPanelOpen && sessionStatus !== "completing" ? <div className="sl-session-timer-controls">
        <button type="button" onClick={toggleSession}>{sessionStatus === "paused" ? `▶ ${t.resumeSession}` : `Ⅱ ${t.pauseSession}`}</button>
        <button type="button" onClick={quitSession}>× {t.quitSession}</button>
      </div> : null}
    </aside> : null}

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
    <style>{`.sl-skill-tabs{grid-template-columns:repeat(6,minmax(0,1fr))}@media(max-width:760px){.sl-skill-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}`}</style>
  </section>;
}

function LearningWorkspaceStyles() {
  return <style>{`
    .sl-quiz-image{width:min(100%,720px);margin:14px 0 18px;display:grid;gap:8px}.sl-quiz-image img{display:block;width:100%;max-height:420px;object-fit:contain;border-radius:14px;background:#eef6f2}.sl-quiz-image figcaption{color:#5f706a;font-size:14px;line-height:1.5}.sl-quiz-free-answer{width:min(100%,720px);display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:end;gap:10px}.sl-quiz-free-answer label{min-width:0;display:grid;gap:7px;color:#536760;font-weight:800}.sl-quiz-free-answer input{width:100%;min-width:0;min-height:50px;padding:11px 14px;border:1px solid #bdccc5;border-radius:12px;background:#fff;color:var(--ink);font:17px/1.35 inherit}.sl-quiz-free-answer>button{min-height:50px!important;text-align:center!important}@media(max-width:760px){.sl-quiz-free-answer{grid-template-columns:minmax(0,1fr)!important}.sl-quiz-free-answer>button{width:100%}}
    .sl-workspace,.sl-workspace *{box-sizing:border-box}.sl-workspace{width:100%;max-width:none;min-width:0;margin:0;padding:clamp(48px,7vw,92px) clamp(16px,4vw,58px) clamp(76px,9vw,126px);display:grid;gap:clamp(30px,5vw,64px);color:var(--ink)}.sl-workspace-heading,.sl-section-heading{width:100%;min-width:0;display:grid;gap:12px}.sl-workspace-heading h1{width:100%;max-width:none;margin:0;font:850 clamp(40px,6vw,76px)/1.03 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.055em;overflow-wrap:anywhere}.sl-workspace-heading>p:last-child,.sl-section-heading>p:last-child{max-width:76ch;margin:0;color:var(--muted);font-size:17px;line-height:1.72}.sl-eyebrow{margin:0;color:#087d62;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.sl-placement-gate,.sl-community-entry{width:100%;min-width:0;padding:clamp(24px,4vw,48px);display:flex;align-items:center;justify-content:space-between;gap:24px;border-radius:25px}.sl-placement-gate.pending{background:#fff1cb}.sl-placement-gate.complete{background:#e3f5ed}.sl-placement-gate>div,.sl-community-entry>div{min-width:0}.sl-placement-gate h2,.sl-community-entry h2,.sl-section-heading h2{width:100%;max-width:none;margin:8px 0 10px;font:820 clamp(28px,4vw,47px)/1.08 Inter,"Noto Sans SC",sans-serif;letter-spacing:-.035em;overflow-wrap:anywhere}.sl-placement-gate p:last-child,.sl-community-entry p:last-child{max-width:76ch;margin:0;color:#58706a;line-height:1.65}.sl-primary-action,.sl-secondary-action{min-height:46px;padding:0 19px;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:999px;font-size:16px;font-weight:850;text-align:center;text-decoration:none}.sl-primary-action{background:#0b9473;color:#fff}.sl-secondary-action{border-color:#a8bdb5;background:#fff;color:var(--ink)}button.sl-primary-action{font-family:inherit;cursor:pointer}.sl-daily-workspace,.sl-calendar-stack{width:100%;min-width:0;display:grid;gap:28px}.sl-skill-stack{width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:18px}.sl-skill-card{width:100%;min-width:0;padding:clamp(22px,4vw,44px);border:1px solid #d7e0db;border-left:5px solid var(--skill-accent);border-radius:24px;background:#fffdf8;overflow:hidden}.sl-skill-card-head{width:100%;min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap}.sl-skill-card-head>div:first-child{display:flex;align-items:baseline;gap:12px;min-width:0}.sl-skill-card-head span{color:var(--skill-accent);font-size:12px;font-weight:900}.sl-skill-card-head h3{margin:0;font:830 clamp(27px,4vw,42px)/1.08 Inter,"Noto Sans SC",sans-serif}.sl-skill-card-head>small{color:#65746f}.sl-mode-picker{min-width:0;display:flex;flex-wrap:wrap;gap:7px}.sl-mode-picker button,.sl-inline-actions button,.sl-grade-actions button,.sl-audio-action,.sl-voice-action,.sl-task-actions button{min-height:44px;padding:9px 14px;border:1px solid #bdccc5;border-radius:999px;background:#fff;color:var(--ink);font:800 16px/1.25 inherit;cursor:pointer}.sl-mode-picker button.active{border-color:#087d62;background:#e2f5ed;color:#08745e}.sl-vocabulary-practice,.sl-task-body{width:100%;min-width:0;margin-top:24px}.sl-mode-help{max-width:76ch;margin:0 0 20px;color:#5f706a;line-height:1.65}.sl-word-stage{width:100%;min-width:0;padding:clamp(24px,5vw,54px);display:grid;place-items:center;gap:10px;border-radius:20px;background:#edf7f2;text-align:center;overflow:hidden}.sl-word-stage strong{max-width:100%;font-size:clamp(34px,6vw,70px);line-height:1.12;overflow-wrap:anywhere}.sl-word-stage span{color:#547068;font-size:17px}.sl-inline-actions,.sl-grade-actions,.sl-task-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.sl-vocabulary-reveal{width:100%;min-width:0;margin-top:18px;padding:clamp(20px,3vw,32px);border:1px solid #cfe1d8;border-radius:18px;background:#fff}.sl-vocabulary-reveal>strong{display:block;font-size:clamp(28px,4vw,46px);overflow-wrap:anywhere}.sl-vocabulary-reveal>span,.sl-vocabulary-reveal>small{display:block;margin-top:6px;color:#64736e}.sl-vocabulary-reveal>p,.sl-vocabulary-reveal blockquote{max-width:76ch;line-height:1.65;overflow-wrap:anywhere}.sl-vocabulary-reveal blockquote{margin:16px 0;padding-left:16px;border-left:3px solid #0b9473}.sl-grade-help{color:#5b6d67}.sl-grade-actions button:last-child{color:#9b3e39}.sl-task-label{margin:0 0 8px;color:var(--skill-accent);font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.sl-task-body h4{width:100%;max-width:none;margin:0;font-size:clamp(22px,3vw,34px);line-height:1.25;overflow-wrap:anywhere}.sl-task-context{width:100%;min-width:0;margin-top:18px;padding:18px;border-radius:15px;background:#f1f5f2}.sl-task-context span{font-size:12px;font-weight:900}.sl-task-context p{max-width:76ch;margin:8px 0 0;white-space:pre-wrap;line-height:1.68;overflow-wrap:anywhere}.sl-audio-action,.sl-voice-action{margin-top:16px;border-color:#8cc7b6;background:#eaf8f2;color:#08745e}.sl-answer-field{width:100%;min-width:0;margin-top:18px;display:grid;gap:8px;font-weight:850}.sl-answer-field input,.sl-answer-field textarea{width:100%;min-width:0;padding:15px;border:1px solid #bdccc5;border-radius:13px;background:#fff;color:var(--ink);font:16px/1.55 inherit}.sl-answer-field textarea{min-height:135px;resize:vertical}.sl-task-options{width:100%;min-width:0;margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.sl-task-options button{min-width:0;min-height:52px;padding:12px 15px;border:1px solid #cbd7d1;border-radius:13px;background:#fff;color:var(--ink);font:750 16px/1.4 inherit;text-align:left;overflow-wrap:anywhere}.sl-task-options button.selected{border-color:#0b9473;background:#e7f7f0;box-shadow:inset 0 0 0 1px #0b9473}.sl-task-actions{justify-content:flex-end}.sl-task-actions button{padding-inline:18px}.sl-task-actions button:disabled,.sl-grade-actions button:disabled{cursor:not-allowed;opacity:.55}.sl-task-status{margin:20px 0 0;padding:14px 17px;border-radius:12px;background:#e4f6ed;color:#08745e;font-weight:850}.sl-task-status.skipped{background:#f2eee4;color:#715e3f}.sl-empty-task,.sl-loading,.sl-calendar-loading{width:100%;margin:22px 0 0;padding:18px;border-radius:13px;background:#f2f5f2;color:#5b6b66}.sl-community-entry{background:#103f35;color:#fff}.sl-community-entry .sl-eyebrow{color:#65ddb7}.sl-community-entry h2{color:#fff}.sl-community-entry p:last-child{color:#c8dbd4}.sl-community-entry nav{display:flex;flex-wrap:wrap;gap:9px}.sl-notice,.sl-error{width:100%;margin:0;padding:14px 17px;border-radius:12px}.sl-notice{background:#e3f6ed;color:#08745e}.sl-error{background:#fff0ee;color:#9a3933}.sl-calendar-stack{padding-top:8px}.sl-calendar-stack>.sl-calendar-loading{margin:0}.sl-workspace button:focus-visible,.sl-workspace a:focus-visible,.sl-workspace input:focus-visible,.sl-workspace textarea:focus-visible{outline:3px solid rgba(10,142,111,.28);outline-offset:3px}
    .sl-vocabulary-cue{width:100%;min-width:0;margin:0 0 14px;padding:16px 20px;display:flex;align-items:center;gap:14px;border:1px solid #c9ded5;border-radius:18px;background:#fff}.sl-vocabulary-cue>span{flex:0 0 auto;font-size:clamp(38px,6vw,62px);line-height:1}.sl-vocabulary-cue>div{min-width:0;display:grid;gap:3px}.sl-vocabulary-cue small{color:#5c7169;font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.sl-vocabulary-cue strong{font-size:clamp(18px,3vw,25px);overflow-wrap:anywhere}
    .sl-feature-overview,.sl-session-planner,.sl-daily-quiz{width:100%;min-width:0;padding:clamp(22px,4vw,42px);display:grid;gap:20px;border:1px solid #cfded7;border-radius:24px;background:#f6fbf8}.sl-feature-overview{background:#fffdf8}.sl-feature-overview header,.sl-session-planner header,.sl-daily-quiz header{width:100%;min-width:0;display:grid;gap:8px}.sl-feature-overview h2,.sl-session-planner h2,.sl-daily-quiz h2{width:100%;margin:0;font:820 clamp(27px,4vw,43px)/1.1 Inter,"Noto Sans SC",sans-serif;overflow-wrap:anywhere}.sl-feature-overview header>p:last-child,.sl-session-planner header>p:last-child,.sl-daily-quiz header>p:last-child{max-width:76ch;margin:0;color:#5f706a;line-height:1.65}.sl-feature-overview>ol{width:100%;min-width:0;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;list-style:none}.sl-feature-overview li{min-width:0;padding:18px;display:flex;align-items:flex-start;gap:13px;border:1px solid #d8e1dc;border-top:4px solid var(--skill-accent);border-radius:15px;background:#fff}.sl-feature-overview li>span{flex:0 0 auto;color:var(--skill-accent);font-size:12px;font-weight:950}.sl-feature-overview li>div{min-width:0}.sl-feature-overview strong{display:block;font-size:19px;overflow-wrap:anywhere}.sl-feature-overview li p{max-width:60ch;margin:7px 0 0;color:#5f706a;line-height:1.55;overflow-wrap:anywhere}.sl-duration-picker{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.sl-duration-picker button{min-width:0;min-height:48px;padding:10px;border:1px solid #afc7bc;border-radius:13px;background:#fff;color:var(--ink);font:850 15px/1.2 inherit;cursor:pointer}.sl-duration-picker button.active{border-color:#087d62;background:#087d62;color:#fff}.sl-session-start{width:100%;min-height:54px;padding:12px 20px;display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:14px;background:#087d62;color:#fff;font:900 17px/1.2 inherit;cursor:pointer}.sl-session-start:disabled{cursor:not-allowed;opacity:.48}.sl-session-start span{font-size:15px}.sl-section-heading#today-five-skills{scroll-margin-top:120px}.sl-skill-tabs{width:100%;min-width:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.sl-skill-tabs button{min-width:0;min-height:62px;padding:10px 8px;display:grid;place-items:center;gap:3px;border:1px solid #c5d3cd;border-radius:14px;background:#fff;color:#30423c;font:850 15px/1.2 inherit;cursor:pointer}.sl-skill-tabs button span{font-size:10px;color:#75847f}.sl-skill-tabs button.active{border-color:#087d62;background:#087d62;color:#fff}.sl-skill-tabs button.active span{color:#c8efe2}.sl-skill-stepper{width:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}.sl-skill-stepper button,.sl-skill-stepper a{min-height:46px;padding:10px 15px;border:1px solid #b9cbc3;border-radius:999px;background:#fff;color:#173d34;font:800 14px/1.2 inherit;text-align:center;text-decoration:none;cursor:pointer}.sl-skill-stepper button:last-child{background:#087d62;color:#fff;border-color:#087d62}.sl-skill-stepper button:disabled{cursor:not-allowed;opacity:.4}.sl-session-timer{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(94px,calc(env(safe-area-inset-bottom) + 76px));z-index:170;width:auto;min-width:92px;padding:5px;border:1px solid rgba(255,255,255,.75);border-radius:999px;background:#0d4138;color:#fff;box-shadow:0 18px 42px rgba(11,45,39,.3)}.sl-session-timer.paused{background:#755d23}.sl-session-timer-summary{width:100%;min-height:48px;padding:6px 14px;border:0;background:transparent;color:inherit;cursor:pointer}.sl-session-timer-summary strong{font-size:20px;font-variant-numeric:tabular-nums}.sl-session-timer-controls{position:absolute;right:0;bottom:calc(100% + 9px);width:210px;padding:8px;display:grid;gap:7px;border-radius:15px;background:#0d4138;box-shadow:0 14px 36px rgba(11,45,39,.3)}.sl-session-timer.paused .sl-session-timer-controls{background:#755d23}.sl-session-timer-controls button{min-height:42px;padding:8px 12px;border:1px solid rgba(255,255,255,.32);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font:800 14px/1.2 inherit;cursor:pointer}.sl-session-timer-controls button:last-child{background:#fff;color:#7d332e}.sl-repeat-help{max-width:76ch;margin:14px 0 0;color:#536760;line-height:1.6}.sl-pronunciation-feedback{width:100%;min-width:0;margin-top:16px;padding:17px;border-radius:14px;background:#fff6d8}.sl-pronunciation-feedback strong{font-size:20px}.sl-pronunciation-feedback p{max-width:76ch;margin:8px 0;line-height:1.55;overflow-wrap:anywhere}.sl-pronunciation-feedback small{display:block;color:#6f6448;line-height:1.5}.sl-quiz-status{margin:0;padding:14px;border-radius:12px;background:#e2f5ed;color:#08745e;font-weight:850}.sl-quiz-questions{width:100%;min-width:0;display:grid;gap:12px}.sl-quiz-questions fieldset{min-width:0;margin:0;padding:18px;border:1px solid #cfdbd5;border-radius:16px;background:#fff}.sl-quiz-questions legend{max-width:100%;padding:0 5px;font:800 clamp(18px,2.5vw,25px)/1.35 inherit;overflow-wrap:anywhere}.sl-quiz-questions legend small{display:block;color:#64736e;font-size:14px;font-weight:600}.sl-quiz-questions fieldset>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sl-quiz-questions button{min-width:0;min-height:48px;padding:10px 13px;border:1px solid #cbd7d1;border-radius:12px;background:#fff;color:var(--ink);font:750 15px/1.35 inherit;text-align:left;overflow-wrap:anywhere;cursor:pointer}.sl-quiz-questions button.selected{border-color:#0b9473;background:#e7f7f0;box-shadow:inset 0 0 0 1px #0b9473}
    .sl-flashcard-progress{width:100%;min-width:0;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.sl-flashcard-progress>strong{color:#08745e;font-size:15px}.sl-flashcard-progress>div{display:flex;gap:7px}.sl-flashcard-progress button{min-height:40px;padding:8px 13px;border:1px solid #bdccc5;border-radius:999px;background:#fff;color:var(--ink);font:800 14px/1.2 inherit;cursor:pointer}.sl-flashcard-progress button:disabled{cursor:not-allowed;opacity:.45}.sl-recording-preview{width:100%;min-width:0;margin-top:14px;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid #d4dfda;border-radius:14px;background:#fff}.sl-recording-preview>strong,.sl-recording-preview>small{grid-column:1/-1}.sl-recording-preview audio{width:100%;min-width:0}.sl-recording-preview button{min-height:42px;padding:8px 13px;border:1px solid #d1aaa5;border-radius:999px;background:#fff;color:#8e3730;font:800 14px/1.2 inherit;cursor:pointer}.sl-recording-preview small{color:#61716b;line-height:1.5}
    .sl-motivation-card,.sl-daily-plan{width:100%;min-width:0;padding:clamp(22px,4vw,42px);display:grid;gap:20px;border:1px solid #cfded7;border-radius:24px;background:#fff}.sl-motivation-card{background:linear-gradient(135deg,#123f36,#17584a);color:#fff}.sl-motivation-card header,.sl-daily-plan header{width:100%;min-width:0;display:grid;gap:8px}.sl-motivation-card h2,.sl-daily-plan h2{width:100%;margin:0;font:820 clamp(27px,4vw,43px)/1.1 Inter,"Noto Sans SC",sans-serif;overflow-wrap:anywhere}.sl-motivation-card h2{color:#fff}.sl-motivation-card header>p:not(.sl-eyebrow),.sl-daily-plan header>p:last-child{max-width:76ch;margin:0;line-height:1.65;overflow-wrap:anywhere}.sl-motivation-card header>p:not(.sl-eyebrow){color:#d6ebe4}.sl-motivation-card dl{width:100%;min-width:0;margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.sl-motivation-card dl>div{min-width:0;padding:16px;border-radius:15px;background:rgba(255,255,255,.1)}.sl-motivation-card dt{color:#bfe1d6;font-size:12px;font-weight:850}.sl-motivation-card dd{margin:6px 0 0;font-size:clamp(21px,3vw,31px);font-weight:900;overflow-wrap:anywhere}.sl-motivation-card>small{max-width:76ch;color:#c8ddd6;line-height:1.55}.sl-streak-repair{width:100%;margin:0;padding:12px 14px;border-radius:12px;background:#f8d981;color:#2c443c;font-weight:850}.sl-plan-context{width:100%;min-width:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sl-plan-context>div{min-width:0;padding:16px;border-radius:15px;background:#edf7f2}.sl-plan-context dt{color:#4f6a62;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.sl-plan-context dd{min-width:0;margin:7px 0 0;display:grid;gap:4px}.sl-plan-context dd strong,.sl-plan-context dd span{overflow-wrap:anywhere}.sl-plan-context dd span{color:#5d7069;line-height:1.45}.sl-plan-blocks{width:100%;min-width:0;margin:0;padding:0;display:grid;gap:10px;list-style:none}.sl-plan-blocks li{width:100%;min-width:0;padding:18px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:14px;border:1px solid #d5e0db;border-radius:16px;background:#fffdf8}.sl-plan-blocks li.recap{border-color:#97cdbb;background:#e6f6ef}.sl-plan-number{width:34px;height:34px;display:grid;place-items:center;border-radius:999px;background:#173f36;color:#fff;font-size:11px;font-weight:900}.sl-plan-blocks li>div{min-width:0}.sl-plan-blocks p{max-width:76ch;margin:0;color:#536760;line-height:1.55;overflow-wrap:anywhere}.sl-plan-blocks p:first-child{max-width:none;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--ink)}.sl-plan-blocks p:first-child strong{font-size:18px}.sl-plan-blocks p:first-child span{padding:4px 8px;border-radius:999px;background:#e8f0ec;color:#276052;font-size:12px;font-weight:850}.sl-plan-blocks p:first-child b{margin-left:auto;color:#08745e;font-size:13px}.sl-checkpoint-status{width:100%;min-width:0;margin:0;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;border-radius:13px;background:#e4f6ed;color:#08745e;font-weight:850;overflow-wrap:anywhere}.sl-checkpoint-status small{font-weight:700}.sl-checkpoint-status.saving{background:#fff5d8;color:#735b1d}.sl-checkpoint-status.offline,.sl-checkpoint-status.conflict{background:#fff0ee;color:#923c35}.sl-answer-feedback{width:100%;min-width:0;margin-top:14px;padding:18px;display:grid;gap:14px;border:1px solid #bdd8cd;border-radius:15px;background:#eef8f3}.sl-answer-feedback header,.sl-answer-feedback>div{width:100%;min-width:0;display:grid;gap:5px}.sl-answer-feedback header strong,.sl-answer-feedback p,.sl-answer-feedback small{max-width:76ch;margin:0;line-height:1.55;overflow-wrap:anywhere}.sl-answer-feedback>div>b{color:#315c50}.sl-answer-feedback>small{display:block;color:#5e706a}.sl-answer-feedback.incorrect{border-color:#e4b4ae;background:#fff2ef}.sl-answer-feedback.partial,.sl-answer-feedback.partially_correct{border-color:#e0cb91;background:#fff9e7}.sl-session-timer.completing{background:#315b52}.sl-session-timer-summary:disabled{cursor:wait}
    .sl-quiz-feedback{width:100%;min-width:0;padding:18px;border:1px solid #bdd8cd;border-radius:16px;background:#edf8f3}.sl-quiz-feedback h3{width:100%;margin:0 0 14px;font-size:clamp(21px,3vw,29px);overflow-wrap:anywhere}.sl-quiz-feedback ol{width:100%;min-width:0;margin:0;padding:0;display:grid;gap:10px;list-style:none}.sl-quiz-feedback li{width:100%;min-width:0;padding:16px;display:grid;gap:10px;border-radius:13px;background:#fff}.sl-quiz-feedback li.incorrect{background:#fff2ef}.sl-quiz-feedback li.partial,.sl-quiz-feedback li.partially_correct{background:#fff9e7}.sl-quiz-feedback li header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.sl-quiz-feedback li>div{display:grid;gap:4px}.sl-quiz-feedback p,.sl-quiz-feedback small{max-width:76ch;margin:0;line-height:1.5;overflow-wrap:anywhere}.sl-quiz-feedback small{display:block;color:#5e706a}
    @media(max-width:760px){.sl-workspace{padding-inline:16px}.sl-placement-gate,.sl-community-entry{display:grid;grid-template-columns:minmax(0,1fr)}.sl-placement-gate>.sl-primary-action,.sl-community-entry nav,.sl-community-entry nav a{width:100%}.sl-feature-overview>ol,.sl-task-options,.sl-quiz-questions fieldset>div,.sl-plan-context{grid-template-columns:minmax(0,1fr)}.sl-motivation-card dl{grid-template-columns:1fr 1fr}.sl-duration-picker{grid-template-columns:1fr 1fr}.sl-skill-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.sl-skill-stepper{grid-template-columns:1fr 1fr}.sl-skill-stepper a{grid-column:1/-1;grid-row:2}.sl-task-actions{display:grid;grid-template-columns:minmax(0,1fr)}.sl-task-actions button,.sl-inline-actions button,.sl-grade-actions button{width:100%}.sl-mode-picker{display:grid;grid-template-columns:1fr 1fr;width:100%}.sl-mode-picker button:last-child{grid-column:1/-1}.sl-skill-card{padding:20px 16px}.sl-skill-card-head{display:grid;grid-template-columns:minmax(0,1fr)}.sl-word-stage{padding:28px 16px}.sl-community-entry nav{display:grid;grid-template-columns:minmax(0,1fr)}}
    @media(max-width:430px){.sl-workspace-heading h1{font-size:40px}.sl-workspace-heading>p:last-child,.sl-section-heading>p:last-child{font-size:16px}.sl-placement-gate,.sl-community-entry{padding:22px 17px}.sl-mode-picker button{padding-inline:8px}.sl-grade-actions{display:grid;grid-template-columns:minmax(0,1fr)}.sl-motivation-card dl{grid-template-columns:minmax(0,1fr)}.sl-plan-blocks li{padding:15px;grid-template-columns:minmax(0,1fr)}.sl-plan-number{width:30px;height:30px}.sl-plan-blocks p:first-child b{width:100%;margin-left:0}}
    .sl-course-day{width:100%;min-width:0;padding:clamp(22px,4vw,42px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;border-radius:24px;background:#102f2a;color:#fff}.sl-course-day h2{width:100%;margin:8px 0;font:820 clamp(27px,4vw,44px)/1.08 Inter,"Noto Sans SC",sans-serif;overflow-wrap:anywhere}.sl-course-day p{margin:0;color:#cce0d9}.sl-course-day>div{min-width:0}.sl-course-day>div:not(:first-child){padding:18px;border-radius:16px;background:rgba(255,255,255,.08)}.sl-course-day strong{display:block;font-size:clamp(21px,3vw,31px);line-height:1.25;overflow-wrap:anywhere}.sl-course-day ul{margin:18px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:7px;list-style:none}.sl-course-day li{padding:7px 10px;border-radius:999px;background:#dff5ec;color:#075d4a;font-size:12px;font-weight:850}.sl-course-score{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sl-course-score>div span{display:block;color:#bad5cc;font-size:12px;font-weight:800;text-transform:uppercase}.sl-course-score>div strong{margin-top:5px;font-size:clamp(28px,4vw,42px)}.sl-course-score small{font-size:13px}.sl-course-score>p,.sl-certificate-link{grid-column:1/-1}.sl-certificate-link{display:block;padding:11px 13px;border-radius:11px;background:#f3c969;color:#173d34;font-weight:900;text-decoration:none}@media(max-width:980px){.sl-course-day{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.sl-course-score{grid-column:1/-1}}@media(max-width:760px){.sl-course-day{grid-template-columns:minmax(0,1fr)}.sl-course-score{grid-column:auto}}
  `}</style>;
}

export default LearningWorkspace;
