import {
  courseSubscriptionMainId,
  courseSubscriptionPackageForMainId,
  type SmartLingoPackageTier,
} from "./smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "./smartlingo-language-communities";

export type CryptoSubscriptionPlan = SmartLingoPackageTier;
export const SMARTLINGO_CRYPTO_MONTHS = 3 as const;

export function normalizeCryptoSubscriptionPlan(value: unknown): CryptoSubscriptionPlan {
  return value === "intermediate" || value === "advanced" ? value : "basic";
}

export function cryptoSubscriptionIdsForCourse(languageCode: string, plan: CryptoSubscriptionPlan) {
  if (!isSmartLingoCommunityLanguage(languageCode)) throw new Error("INVALID_SMARTLINGO_LANGUAGE");
  return { mainId: courseSubscriptionMainId(plan, SMARTLINGO_CRYPTO_MONTHS), secondId: languageCode };
}

export function cryptoSubscriptionRuleIds(plan: CryptoSubscriptionPlan) {
  return { mainId: courseSubscriptionMainId(plan, SMARTLINGO_CRYPTO_MONTHS), secondId: "" };
}

export function cryptoSubscriptionPlanForIds(mainId: string, secondId: string): CryptoSubscriptionPlan | null {
  if (!isSmartLingoCommunityLanguage(secondId)) return null;
  const item = courseSubscriptionPackageForMainId(mainId);
  return item?.months === SMARTLINGO_CRYPTO_MONTHS ? item.tier : null;
}
