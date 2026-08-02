import {
  SMARTLINGO_LANGUAGE_COMMUNITIES,
  type SmartLingoCommunityLanguage,
} from "./smartlingo-language-communities.ts";
import {
  SMARTLINGO_LEARNING_CONTENT_VERSION,
  SMARTLINGO_SKILLS,
  type BilingualText,
  type SmartLingoLevel,
  type SmartLingoSkill,
} from "./smartlingo-learning.ts";

export const SMARTLINGO_PATH_CONTENT_VERSION = "2026-08-02.1" as const;

export const SMARTLINGO_STAGE_IDS = ["foundation", "everyday", "independent"] as const;
export type SmartLingoStageId = (typeof SMARTLINGO_STAGE_IDS)[number];

export const SMARTLINGO_USE_CASES = [
  "daily_life",
  "travel",
  "work",
  "study",
  "community",
] as const;
export type SmartLingoUseCase = (typeof SMARTLINGO_USE_CASES)[number];

export const SMARTLINGO_DAILY_MINUTES = [5, 10, 15, 20] as const;
export type SmartLingoDailyMinutes = (typeof SMARTLINGO_DAILY_MINUTES)[number];

export const SMARTLINGO_ENTRY_MODES = ["adaptive", "self_selected", "fundamentals"] as const;
export type SmartLingoEntryMode = (typeof SMARTLINGO_ENTRY_MODES)[number];

export type SmartLingoContentStatus = "foundation_ready";
export type SmartLingoUnitAvailability = "available" | "preview";

export type SmartLingoLanguageCatalogEntry = {
  readonly stableId: `sl-language-${SmartLingoCommunityLanguage}`;
  readonly code: SmartLingoCommunityLanguage;
  readonly pathId: string;
  readonly classId: string;
  readonly nameZh: string;
  readonly nameEn: string;
  readonly nativeName: string;
  readonly speechLocale: string;
  readonly direction: "ltr" | "rtl";
  readonly speech: {
    readonly playback: "device_dependent";
    readonly microphone: "device_dependent_signed_in";
    readonly liveAudio: "signed_in";
  };
  readonly stageIds: readonly SmartLingoStageId[];
  readonly contentStatus: SmartLingoContentStatus;
  readonly contentVersion: typeof SMARTLINGO_PATH_CONTENT_VERSION;
  readonly learningContentVersion: typeof SMARTLINGO_LEARNING_CONTENT_VERSION;
  readonly sourceType: "smartlingo_original";
};

/**
 * The catalog is deliberately text-only: languages are not countries, so a
 * national flag is never used as a language identifier. Speech support is a
 * capability statement, not a promise that every browser has a matching
 * voice or recognition engine installed.
 */
export const SMARTLINGO_LANGUAGE_CATALOG: readonly SmartLingoLanguageCatalogEntry[] =
  SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => ({
    ...language,
    stableId: `sl-language-${language.code}`,
    speech: {
      playback: "device_dependent",
      microphone: "device_dependent_signed_in",
      liveAudio: "signed_in",
    },
    stageIds: SMARTLINGO_STAGE_IDS,
    contentStatus: "foundation_ready",
    contentVersion: SMARTLINGO_PATH_CONTENT_VERSION,
    learningContentVersion: SMARTLINGO_LEARNING_CONTENT_VERSION,
    sourceType: "smartlingo_original",
  }));

type UnitTemplate = {
  readonly key: string;
  readonly title: BilingualText;
  readonly summary: BilingualText;
  readonly scenario: BilingualText;
  readonly skills: readonly SmartLingoSkill[];
  readonly prerequisiteKey: string | null;
};

type StageTemplate = {
  readonly id: SmartLingoStageId;
  readonly level: "A1" | "A2" | "B1+";
  readonly title: BilingualText;
  readonly summary: BilingualText;
  readonly availability: SmartLingoUnitAvailability;
  readonly units: readonly UnitTemplate[];
};

/** Original bilingual curriculum architecture shared by all twelve paths. */
export const SMARTLINGO_STAGE_TEMPLATES: readonly StageTemplate[] = [
  {
    id: "foundation",
    level: "A1",
    title: { zh: "建立第一组可用表达", en: "Build your first usable expressions" },
    summary: {
      zh: "从问候、个人信息与日常需要开始，把五项技能连接成短而完整的交流。",
      en: "Start with greetings, personal information, and everyday needs, joining all five skills into short complete exchanges.",
    },
    availability: "available",
    units: [
      {
        key: "first-contact",
        title: { zh: "第一次见面", en: "A first meeting" },
        summary: { zh: "识别问候，听懂回应，并完成一轮简短介绍。", en: "Recognize a greeting, understand the reply, and complete a short introduction." },
        scenario: { zh: "在新班级里向一位同学问好并介绍自己。", en: "Greet a classmate and introduce yourself in a new class." },
        skills: ["vocabulary", "listening", "dialogue"],
        prerequisiteKey: null,
      },
      {
        key: "personal-details",
        title: { zh: "交换基本信息", en: "Exchange basic details" },
        summary: { zh: "阅读简短资料，写出自己的信息，并确认关键词。", en: "Read a short profile, write your own details, and confirm key words." },
        scenario: { zh: "填写活动名牌，再核对姓名、语言和所在地。", en: "Complete an event badge, then confirm a name, language, and location." },
        skills: ["vocabulary", "reading", "writing"],
        prerequisiteKey: "first-contact",
      },
      {
        key: "everyday-needs",
        title: { zh: "表达一个日常需要", en: "Express an everyday need" },
        summary: { zh: "听懂一个简单选择，读写关键信息，并用对话完成请求。", en: "Understand a simple choice, read and write key details, and complete a request in dialogue." },
        scenario: { zh: "在咖啡店点单、询问一种配料并确认选择。", en: "Order at a café, ask about one ingredient, and confirm the choice." },
        skills: SMARTLINGO_SKILLS,
        prerequisiteKey: "personal-details",
      },
    ],
  },
  {
    id: "everyday",
    level: "A2",
    title: { zh: "处理常见生活场景", en: "Handle common daily situations" },
    summary: {
      zh: "围绕路线、时间与问题处理扩大输入和输出长度，同时保留清楚的先决关系。",
      en: "Extend input and output around directions, schedules, and problem solving while keeping prerequisites explicit.",
    },
    availability: "preview",
    units: [
      {
        key: "directions-and-services",
        title: { zh: "找到地点与服务", en: "Find a place and a service" },
        summary: { zh: "理解路线词汇，阅读指示，并确认下一步。", en: "Understand direction words, read signs, and confirm the next step." },
        scenario: { zh: "在车站问路，听取两步指示并复述目的地。", en: "Ask for directions at a station, follow two steps, and restate the destination." },
        skills: ["vocabulary", "reading", "listening", "dialogue"],
        prerequisiteKey: "everyday-needs",
      },
      {
        key: "plans-and-time",
        title: { zh: "安排时间与计划", en: "Arrange time and plans" },
        summary: { zh: "比较日程、写一条确认消息，并协商可行时间。", en: "Compare schedules, write a confirmation, and negotiate a workable time." },
        scenario: { zh: "和同学调整学习会面时间，并写下最终安排。", en: "Reschedule a study meeting with a classmate and write the final arrangement." },
        skills: ["vocabulary", "reading", "writing", "dialogue"],
        prerequisiteKey: "directions-and-services",
      },
      {
        key: "solve-a-problem",
        title: { zh: "说明并解决问题", en: "Explain and solve a problem" },
        summary: { zh: "综合听说读写词汇，说明错误、确认方案并记录结果。", en: "Combine all five skills to explain an error, confirm a solution, and record the outcome." },
        scenario: { zh: "收到错误订单后，礼貌说明问题并确认更正。", en: "Politely explain an incorrect order and confirm the correction." },
        skills: SMARTLINGO_SKILLS,
        prerequisiteKey: "plans-and-time",
      },
    ],
  },
  {
    id: "independent",
    level: "B1+",
    title: { zh: "独立完成多步骤沟通", en: "Communicate independently across multiple steps" },
    summary: {
      zh: "从表达理由到协作决策，再完成一个整合五项技能的真实任务。",
      en: "Move from giving reasons to collaborative decisions, then complete one real task integrating all five skills.",
    },
    availability: "preview",
    units: [
      {
        key: "explain-a-choice",
        title: { zh: "解释选择与理由", en: "Explain a choice and its reasons" },
        summary: { zh: "比较观点，提取证据，并用清楚段落支持一个选择。", en: "Compare viewpoints, extract evidence, and support a choice in a clear paragraph." },
        scenario: { zh: "为小组活动比较两个方案并推荐其一。", en: "Compare two options for a group activity and recommend one." },
        skills: ["vocabulary", "reading", "writing", "dialogue"],
        prerequisiteKey: "solve-a-problem",
      },
      {
        key: "collaborate-on-a-plan",
        title: { zh: "协作形成计划", en: "Collaborate on a plan" },
        summary: { zh: "听取不同意见、提出澄清问题并写出一致结论。", en: "Listen to different views, ask clarifying questions, and write the agreed conclusion." },
        scenario: { zh: "在群组会议中分配任务、确认期限并总结决定。", en: "Assign tasks, confirm deadlines, and summarize decisions in a group meeting." },
        skills: ["listening", "dialogue", "reading", "writing"],
        prerequisiteKey: "explain-a-choice",
      },
      {
        key: "complete-a-real-task",
        title: { zh: "完成综合真实任务", en: "Complete an integrated real task" },
        summary: { zh: "用五项技能完成准备、沟通、调整与复盘，不把练习结果冒充考试成绩。", en: "Use all five skills to prepare, communicate, adjust, and reflect without presenting practice results as exam scores." },
        scenario: { zh: "策划一次社区活动，发送邀请、回答问题并公布最终安排。", en: "Plan a community event, send an invitation, answer questions, and publish the final arrangement." },
        skills: SMARTLINGO_SKILLS,
        prerequisiteKey: "collaborate-on-a-plan",
      },
    ],
  },
] as const;

export type SmartLingoPathUnit = UnitTemplate & {
  readonly id: string;
  readonly prerequisiteUnitId: string | null;
  readonly stageId: SmartLingoStageId;
  readonly availability: SmartLingoUnitAvailability;
  readonly contentVersion: typeof SMARTLINGO_PATH_CONTENT_VERSION;
  readonly sourceType: "smartlingo_original";
};

export type SmartLingoPathStage = Omit<StageTemplate, "units"> & {
  readonly units: readonly SmartLingoPathUnit[];
};

export function buildLanguagePath(language: SmartLingoCommunityLanguage): readonly SmartLingoPathStage[] {
  return SMARTLINGO_STAGE_TEMPLATES.map(stage => ({
    ...stage,
    units: stage.units.map(unit => ({
      ...unit,
      id: `sl-unit-${language}-${unit.key}`,
      prerequisiteUnitId: unit.prerequisiteKey ? `sl-unit-${language}-${unit.prerequisiteKey}` : null,
      stageId: stage.id,
      availability: stage.availability,
      contentVersion: SMARTLINGO_PATH_CONTENT_VERSION,
      sourceType: "smartlingo_original",
    })),
  }));
}

export function languageCatalogEntry(value: string) {
  return SMARTLINGO_LANGUAGE_CATALOG.find(language => language.code === value) ?? null;
}

export function speechLocaleForLanguage(value: SmartLingoCommunityLanguage) {
  return languageCatalogEntry(value)?.speechLocale ?? "en-US";
}

export type SmartLingoOnboardingInput = {
  readonly targetLanguage: SmartLingoCommunityLanguage;
  readonly useCase: SmartLingoUseCase;
  readonly dailyMinutes: SmartLingoDailyMinutes;
  readonly selfReportedLevel: SmartLingoLevel;
  readonly entryMode: SmartLingoEntryMode;
};

export type SmartLingoOnboardingValidation =
  | { readonly ok: true; readonly value: SmartLingoOnboardingInput }
  | { readonly ok: false; readonly issues: readonly string[] };

export function validateLearningOnboarding(input: Record<string, unknown>): SmartLingoOnboardingValidation {
  const issues: string[] = [];
  const targetLanguage = typeof input.targetLanguage === "string" ? languageCatalogEntry(input.targetLanguage) : null;
  if (!targetLanguage) issues.push("target_language");
  if (!SMARTLINGO_USE_CASES.includes(input.useCase as SmartLingoUseCase)) issues.push("use_case");
  if (!SMARTLINGO_DAILY_MINUTES.includes(Number(input.dailyMinutes) as SmartLingoDailyMinutes)) issues.push("daily_minutes");
  if (!["beginner", "intermediate", "advanced"].includes(String(input.selfReportedLevel))) issues.push("self_reported_level");
  if (!SMARTLINGO_ENTRY_MODES.includes(input.entryMode as SmartLingoEntryMode)) issues.push("entry_mode");
  if (issues.length || !targetLanguage) return { ok: false, issues };
  return {
    ok: true,
    value: {
      targetLanguage: targetLanguage.code,
      useCase: input.useCase as SmartLingoUseCase,
      dailyMinutes: Number(input.dailyMinutes) as SmartLingoDailyMinutes,
      selfReportedLevel: input.selfReportedLevel as SmartLingoLevel,
      entryMode: input.entryMode as SmartLingoEntryMode,
    },
  };
}

export function startingPointForOnboarding(input: SmartLingoOnboardingInput) {
  if (input.entryMode === "adaptive") return null;
  const stageId: SmartLingoStageId = input.entryMode === "fundamentals" || input.selfReportedLevel === "beginner"
    ? "foundation"
    : input.selfReportedLevel === "intermediate" ? "everyday" : "independent";
  const stage = buildLanguagePath(input.targetLanguage).find(item => item.id === stageId)!;
  return { stageId, unitId: stage.units[0].id } as const;
}

export function canEnterPathUnit(
  language: SmartLingoCommunityLanguage,
  unitId: string,
  completedUnitIds: readonly string[],
) {
  const unit = buildLanguagePath(language).flatMap(stage => stage.units).find(item => item.id === unitId);
  if (!unit) return false;
  return !unit.prerequisiteUnitId || completedUnitIds.includes(unit.prerequisiteUnitId);
}

export function resolveLearningPath(value: string, interfaceLanguage: "zh" | "en") {
  const language = languageCatalogEntry(value);
  if (!language) {
    return {
      kind: "content_unavailable" as const,
      code: "SMARTLINGO_CONTENT_UNAVAILABLE" as const,
      message: interfaceLanguage === "zh"
        ? "这条学习路径目前没有可用内容。请选择目录中的语言，学习记录不会丢失。"
        : "This learning path has no available content yet. Choose a catalog language; saved progress is retained.",
    };
  }
  return { kind: "path" as const, language, stages: buildLanguagePath(language.code) };
}
