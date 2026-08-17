import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities";

export type SmartLingoPackageTier = "basic" | "intermediate" | "advanced";

export const SMARTLINGO_COURSE_PACKAGES = [
  {
    tier: "basic", level: "A1", monthlyPriceCents: 2_000,
    name: { zh: "基础课程", en: "Basic" },
    features: { zh: ["核心词汇", "发音与听力", "引导式口语"], en: ["Core vocabulary", "Pronunciation and listening", "Guided speaking"] },
  },
  {
    tier: "intermediate", level: "A2", monthlyPriceCents: 10_000,
    name: { zh: "中级课程", en: "Intermediate" },
    features: { zh: ["包含基础课程", "日常生活对话", "写作训练"], en: ["Everything in Basic", "Daily-life dialogue", "Writing training"] },
  },
  {
    tier: "advanced", level: "B1+", monthlyPriceCents: 30_000,
    name: { zh: "高级课程", en: "Advanced" },
    features: { zh: ["包含中级课程", "口音校正", "演讲训练", "演讲稿修改"], en: ["Everything in Intermediate", "Accent correction", "Speech training", "Speech-draft revision"] },
  },
] as const;

export function fixedCourseId(language: SmartLingoCommunityLanguage, tier: SmartLingoPackageTier) {
  return `course_${language}_${tier}`;
}
