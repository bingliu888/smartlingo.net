import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities.ts";
import type { BilingualText, SmartLingoSkill } from "./smartlingo-learning.ts";

export const SMARTLINGO_QUICK_COURSE_VERSION = "2026-08-02.1" as const;
export const SMARTLINGO_QUICK_COURSE_DAYS = [7, 14, 30] as const;
export type SmartLingoQuickCourseDays = (typeof SMARTLINGO_QUICK_COURSE_DAYS)[number];

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
  readonly days: SmartLingoQuickCourseDays;
  readonly level: "beginner";
  readonly title: BilingualText;
  readonly summary: BilingualText;
  readonly isFreeDefault: boolean;
  readonly curriculumVersion: typeof SMARTLINGO_QUICK_COURSE_VERSION;
  readonly schedule: readonly SmartLingoQuickCourseDay[];
  readonly sourceType: "smartlingo_original";
};

function skillsForDay(courseDays: SmartLingoQuickCourseDays, day: number): readonly SmartLingoSkill[] {
  const skills: SmartLingoSkill[] = ["vocabulary", "listening", "dialogue"];
  if (courseDays >= 14 && day >= 4) skills.splice(1, 0, "reading");
  if (courseDays === 30 && day >= 8) skills.splice(2, 0, "writing");
  return skills;
}

export function buildQuickCourse(
  language: SmartLingoCommunityLanguage,
  days: SmartLingoQuickCourseDays,
): SmartLingoQuickCourse {
  const title = days === 7
    ? { zh: "七天旅行生存课", en: "7-day Travel Essentials" }
    : days === 14
      ? { zh: "十四天旅行交流课", en: "14-day Travel Confidence" }
      : { zh: "三十天实用入门课", en: "30-day Practical Beginner" };
  const summary = days === 7
    ? { zh: "免费建立旅行所需的核心词汇、听力与对话能力。", en: "Build core travel vocabulary, listening, and dialogue skills for free." }
    : days === 14
      ? { zh: "在七天课程上加入路牌、菜单、通知和短消息阅读。", en: "Add signs, menus, notices, and short-message reading to the 7-day foundation." }
      : { zh: "在完整五项技能中加入实用写作、复习与综合旅行任务。", en: "Add practical writing, review, and integrated travel missions across all five skills." };
  return {
    stableId: `sl-quick-${language}-beginner-${days}d-v1`,
    language,
    days,
    level: "beginner",
    title,
    summary,
    isFreeDefault: days === 7,
    curriculumVersion: SMARTLINGO_QUICK_COURSE_VERSION,
    sourceType: "smartlingo_original",
    schedule: SCENES.slice(0, days).map((scene, index) => ({
      day: index + 1,
      scene,
      skills: skillsForDay(days, index + 1),
      estimatedMinutes: days === 7 ? 10 : days === 14 ? 15 : 20,
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
