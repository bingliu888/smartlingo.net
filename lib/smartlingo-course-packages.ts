import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities";

export type SmartLingoPackageTier = "basic" | "intermediate" | "advanced";
export type SmartLingoCourseDurationMonths = 3 | 6 | 12;

export type SmartLingoCourseSubscriptionPackage = {
  id: `${SmartLingoPackageTier}_${SmartLingoCourseDurationMonths}m`;
  tier: SmartLingoPackageTier;
  months: SmartLingoCourseDurationMonths;
  priceCents: number;
};

const PACKAGE_PRICES: Record<SmartLingoPackageTier, Record<SmartLingoCourseDurationMonths, number>> = {
  basic: { 3: 3_000, 6: 5_000, 12: 8_000 },
  intermediate: { 3: 6_000, 6: 10_000, 12: 16_000 },
  advanced: { 3: 12_000, 6: 20_000, 12: 32_000 },
};

export const SMARTLINGO_COURSE_DURATIONS = [3, 6, 12] as const;

export const SMARTLINGO_COURSE_PACKAGES = [
  {
    tier: "basic", level: "A1", startingPriceCents: 3_000,
    name: { zh: "初期课程", en: "Beginner" },
    features: { zh: ["核心词汇", "发音与听力", "引导式口语", "Webinar 教课室", "小组语音练习室"], en: ["Core vocabulary", "Pronunciation and listening", "Guided speaking", "Webinar teaching room", "Group-audio practice room"] },
  },
  {
    tier: "intermediate", level: "A2", startingPriceCents: 6_000,
    name: { zh: "中级课程", en: "Intermediate" },
    features: { zh: ["包含初期课程", "日常生活对话", "写作训练"], en: ["Everything in Beginner", "Daily-life dialogue", "Writing training"] },
  },
  {
    tier: "advanced", level: "B1+", startingPriceCents: 12_000,
    name: { zh: "高级课程", en: "Advanced" },
    features: { zh: ["包含中级课程", "口音校正", "演讲训练", "演讲稿修改"], en: ["Everything in Intermediate", "Accent correction", "Speech training", "Speech-draft revision"] },
  },
] as const;

export const SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES: SmartLingoCourseSubscriptionPackage[] =
  SMARTLINGO_COURSE_PACKAGES.flatMap(course => SMARTLINGO_COURSE_DURATIONS.map(months => ({
    id: `${course.tier}_${months}m` as const,
    tier: course.tier,
    months,
    priceCents: PACKAGE_PRICES[course.tier][months],
  })));

export function courseSubscriptionPackage(tier: SmartLingoPackageTier, months: SmartLingoCourseDurationMonths) {
  return SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES.find(item => item.tier === tier && item.months === months) || null;
}

export function normalizeCourseDurationMonths(value: unknown): SmartLingoCourseDurationMonths | null {
  const months = Number(value);
  return months === 3 || months === 6 || months === 12 ? months : null;
}

export function courseSubscriptionMainId(tier: SmartLingoPackageTier, months: SmartLingoCourseDurationMonths) {
  return `smartlingo_course_${tier}_${months}m`;
}

export function courseSubscriptionPackageForMainId(value: string) {
  const match = /^smartlingo_course_(basic|intermediate|advanced)_(3|6|12)m$/.exec(value);
  if (!match) return null;
  return courseSubscriptionPackage(match[1] as SmartLingoPackageTier, Number(match[2]) as SmartLingoCourseDurationMonths);
}

export function addCourseSubscriptionMonths(timestampSeconds: number, months: SmartLingoCourseDurationMonths) {
  const source = new Date(timestampSeconds * 1000);
  const day = source.getUTCDate();
  const end = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1,
    source.getUTCHours(), source.getUTCMinutes(), source.getUTCSeconds()));
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return Math.floor(end.getTime() / 1000);
}

export function fixedCourseId(language: SmartLingoCommunityLanguage, tier: SmartLingoPackageTier) {
  return `course_${language}_${tier}`;
}
