import type { SmartLingoPackageTier } from "./smartlingo-course-packages";

export const SMARTLINGO_CRYPTO_COURSE_MAIN_ID = "smartlingo_course_annual";
export type CryptoSubscriptionPlan = SmartLingoPackageTier;

export function normalizeCryptoSubscriptionPlan(value: unknown): CryptoSubscriptionPlan {
  return value === "intermediate" || value === "advanced" ? value : "basic";
}

export function cryptoSubscriptionIdsForCourse(classId: string) {
  if (!/^course_(zh|en|es|ja|ko|fr|de|ru|it|pt|ar|hi)_(basic|intermediate|advanced)$/.test(classId)) {
    throw new Error("INVALID_SMARTLINGO_COURSE_ID");
  }
  return { mainId: SMARTLINGO_CRYPTO_COURSE_MAIN_ID, secondId: classId };
}

export function cryptoSubscriptionPlanForIds(mainId: string, secondId: string): CryptoSubscriptionPlan | null {
  if (mainId !== SMARTLINGO_CRYPTO_COURSE_MAIN_ID) return null;
  const match = /^course_(?:zh|en|es|ja|ko|fr|de|ru|it|pt|ar|hi)_(basic|intermediate|advanced)$/.exec(secondId);
  return match?.[1] as CryptoSubscriptionPlan | undefined || null;
}
