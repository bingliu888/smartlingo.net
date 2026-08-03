import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities.ts";
import type { BilingualText, SmartLingoSkill } from "./smartlingo-learning.ts";

export const SMARTLINGO_QUICK_COURSE_VERSION = "2026-08-02.3" as const;
export const SMARTLINGO_COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type SmartLingoCourseLevel = (typeof SMARTLINGO_COURSE_LEVELS)[number];
export const SMARTLINGO_COURSE_DURATIONS = {
  beginner: [7, 14, 30],
  intermediate: [30, 60, 90],
  advanced: [90, 180, 365],
} as const satisfies Record<SmartLingoCourseLevel, readonly number[]>;
export const SMARTLINGO_QUICK_COURSE_DAYS = SMARTLINGO_COURSE_DURATIONS.beginner;
export type SmartLingoQuickCourseDays = (typeof SMARTLINGO_QUICK_COURSE_DAYS)[number];
export type SmartLingoCourseDays = 7 | 14 | 30 | 60 | 90 | 180 | 365;

const SCENES: readonly BilingualText[] = [
  { zh: "问候与礼貌表达", en: "Greetings and courtesy" },
  { zh: "介绍自己与同行者", en: "Introduce yourself and your companion" },
  { zh: "机场、车站与交通", en: "Airports, stations, and transport" },
  { zh: "问路与确认地点", en: "Ask for and confirm directions" },
  { zh: "餐厅点餐与饮食需要", en: "Order food and explain dietary needs" },
  { zh: "购物、数字与付款", en: "Shopping, numbers, and payment" },
  { zh: "求助、复习与旅行演练", en: "Ask for help, review, and travel rehearsal" },
  { zh: "阅读路牌与营业信息", en: "Read signs and opening information" },
  { zh: "酒店入住与房间需要", en: "Hotel check-in and room needs" },
  { zh: "时间、日期与预约", en: "Time, dates, and appointments" },
  { zh: "购买车票与比较选择", en: "Buy tickets and compare options" },
  { zh: "描述身体不适与药房需求", en: "Describe discomfort and pharmacy needs" },
  { zh: "阅读短消息与旅行通知", en: "Read short messages and travel notices" },
  { zh: "完成一次日常旅行任务", en: "Complete an everyday travel mission" },
  { zh: "写一条简短问候", en: "Write a short greeting" },
  { zh: "说明计划与偏好", en: "Explain plans and preferences" },
  { zh: "处理订单或预订问题", en: "Handle an order or booking problem" },
  { zh: "理解较长的公共通知", en: "Understand a longer public notice" },
  { zh: "与当地人进行简短对话", en: "Hold a short conversation with a local" },
  { zh: "写住宿或交通请求", en: "Write a lodging or transport request" },
  { zh: "听懂价格、时间与变更", en: "Hear prices, times, and changes" },
  { zh: "阅读菜单并提出问题", en: "Read a menu and ask questions" },
  { zh: "礼貌拒绝并提出替代方案", en: "Decline politely and suggest an alternative" },
  { zh: "讲述当天的旅行经历", en: "Describe the day's travel experience" },
  { zh: "写一则简单旅行记录", en: "Write a simple travel note" },
  { zh: "理解当地活动信息", en: "Understand local event information" },
  { zh: "完成紧急情况角色扮演", en: "Complete an emergency role-play" },
  { zh: "规划并说明一日行程", en: "Plan and explain a day itinerary" },
  { zh: "五项技能综合复习", en: "Integrated five-skill review" },
  { zh: "完成旅行者毕业情景", en: "Complete the traveler finale scenario" },
] as const;

export type SmartLingoQuickCourseDay = {
  readonly day: number;
  readonly scene: BilingualText;
  readonly skills: readonly SmartLingoSkill[];
  readonly estimatedMinutes: number;
};

export type SmartLingoQuickCourse = {
  readonly stableId: string;
  readonly language: SmartLingoCommunityLanguage;
  readonly days: SmartLingoCourseDays;
  readonly level: SmartLingoCourseLevel;
  readonly title: BilingualText;
  readonly summary: BilingualText;
  readonly isFreeDefault: boolean;
  readonly curriculumVersion: typeof SMARTLINGO_QUICK_COURSE_VERSION;
  readonly schedule: readonly SmartLingoQuickCourseDay[];
  readonly sourceType: "smartlingo_original";
};

function skillsForDay(level: SmartLingoCourseLevel, courseDays: SmartLingoCourseDays, day: number): readonly SmartLingoSkill[] {
  const skills: SmartLingoSkill[] = ["vocabulary", "listening", "dialogue"];
  if (level !== "beginner" || (courseDays >= 14 && day >= 4)) skills.splice(1, 0, "reading");
  if (level !== "beginner" || (courseDays >= 30 && day >= 8)) skills.splice(2, 0, "writing");
  return skills;
}

export function buildQuickCourse(
  language: SmartLingoCommunityLanguage,
  days: SmartLingoCourseDays,
  level: SmartLingoCourseLevel = "beginner",
): SmartLingoQuickCourse {
  const levelName = level === "beginner"
    ? { zh: "入门", en: "Beginner" }
    : level === "intermediate"
      ? { zh: "中级", en: "Intermediate" }
      : { zh: "高级", en: "Advanced" };
  const durationName = days < 30
    ? { zh: `${days} 天`, en: `${days}-day` }
    : days === 365
      ? { zh: "12 个月", en: "12-month" }
      : { zh: `${Math.round(days / 30)} 个月`, en: `${Math.round(days / 30)}-month` };
  const title = {
    zh: `${durationName.zh}${levelName.zh}课程`,
    en: `${durationName.en} ${levelName.en} Course`,
  };
  const summary = level === "beginner"
    ? days === 7
      ? { zh: "免费建立旅行所需的核心词汇、听力与对话能力。", en: "Build core travel vocabulary, listening, and dialogue skills for free." }
      : days === 14
        ? { zh: "承接七天基础，并加入路牌、菜单、通知和短消息阅读。", en: "Continue from the 7-day foundation and add signs, menus, notices, and short-message reading." }
        : { zh: "承接十四天基础，加入实用写作、复习与五项技能综合任务。", en: "Continue from the 14-day foundation with practical writing, review, and integrated five-skill missions." }
    : level === "intermediate"
      ? { zh: "用真实生活与工作场景提升五项语言技能的准确度、流利度和理解深度。", en: "Improve accuracy, fluency, and comprehension across five skills in real-life and work scenarios." }
      : { zh: "通过复杂表达、专业材料和长篇任务训练接近熟练使用者的综合能力。", en: "Build near-proficient command through complex expression, professional materials, and extended tasks." };
  return {
    stableId: `sl-course-${language}-${level}-${days}d-v1`,
    language,
    days,
    level,
    title,
    summary,
    isFreeDefault: days === 7,
    curriculumVersion: SMARTLINGO_QUICK_COURSE_VERSION,
    sourceType: "smartlingo_original",
    schedule: Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      scene: SCENES[index % SCENES.length],
      skills: skillsForDay(level, days, index + 1),
      estimatedMinutes: 60,
    })),
  };
}

export const SMARTLINGO_SHOWCASE_LEARNERS = [
  "en", "zh", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi",
].map((interfaceLanguage, index) => ({
  testId: `test${index + 1}`,
  interfaceLanguage,
  targetLanguages: ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"] as SmartLingoCommunityLanguage[],
  startingTarget: index === 0 ? "zh" as const : undefined,
  level: "beginner" as const,
  courseDays: 7 as const,
  accountKind: "qa_fixture_not_identity" as const,
}));

export function isQuickCourseDays(value: unknown): value is SmartLingoQuickCourseDays {
  return SMARTLINGO_QUICK_COURSE_DAYS.includes(Number(value) as SmartLingoQuickCourseDays);
}

export function isCourseLevel(value: unknown): value is SmartLingoCourseLevel {
  return SMARTLINGO_COURSE_LEVELS.includes(value as SmartLingoCourseLevel);
}

export function isCourseDuration(level: SmartLingoCourseLevel, value: unknown): value is SmartLingoCourseDays {
  return (SMARTLINGO_COURSE_DURATIONS[level] as readonly number[]).includes(Number(value));
}

export function previousCourseDuration(level: SmartLingoCourseLevel, days: SmartLingoCourseDays): SmartLingoCourseDays | null {
  const durations = SMARTLINGO_COURSE_DURATIONS[level] as readonly SmartLingoCourseDays[];
  const index = durations.indexOf(days);
  return index > 0 ? durations[index - 1] : null;
}
