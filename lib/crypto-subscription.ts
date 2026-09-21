import {
  courseSubscriptionMainId,
  courseSubscriptionPackageForMainId,
  type SmartLingoPackageTier,
} from "./smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "./smartlingo-language-communities";
import { platformProduct, platformProductForIds, platformProductMainId, type SmartLingoPlatformProductId } from "./platform-commerce";

export type CryptoSubscriptionPlan = SmartLingoPackageTier;
export type SmartPayPlan = CryptoSubscriptionPlan | SmartLingoPlatformProductId;
export const SMARTLINGO_CRYPTO_MONTHS = 3 as const;

export function normalizeCryptoSubscriptionPlan(value: unknown): CryptoSubscriptionPlan {
  return value === "intermediate" || value === "advanced" ? value : "basic";
}

export function cryptoSubscriptionIdsForCourse(languageCode: string, plan: CryptoSubscriptionPlan) {
  if (!isSmartLingoCommunityLanguage(languageCode)) throw new Error("INVALID_SMARTLINGO_LANGUAGE");
  return { mainId: courseSubscriptionMainId(plan, SMARTLINGO_CRYPTO_MONTHS), secondId: languageCode };
}

export function cryptoSubscriptionRuleIds(plan: CryptoSubscriptionPlan) {
  return { mainId: courseSubscriptionMainId(plan, SMARTLINGO_CRYPTO_MONTHS), secondId: "" } as const;
}

export function cryptoSubscriptionPlanForIds(mainId: string, secondId: string): CryptoSubscriptionPlan | null {
  if (!isSmartLingoCommunityLanguage(secondId)) return null;
  const item = courseSubscriptionPackageForMainId(mainId);
  return item?.months === SMARTLINGO_CRYPTO_MONTHS ? item.tier : null;
}

export function smartPayIdsForPlan(plan: SmartPayPlan, languageCode = "") {
  const product = platformProduct(plan);
  if (product) return { mainId: platformProductMainId(product.id), secondId: "platform" } as const;
  return cryptoSubscriptionIdsForCourse(languageCode, plan as CryptoSubscriptionPlan);
}

export function smartPayRuleIdsForPlan(plan: SmartPayPlan) {
  const product = platformProduct(plan);
  return product ? { mainId: platformProductMainId(product.id), secondId: "" } as const : cryptoSubscriptionRuleIds(plan as CryptoSubscriptionPlan);
}

export function smartPayPlanForIds(mainId: string, secondId: string): SmartPayPlan | null {
  return platformProductForIds(mainId, secondId)?.id || cryptoSubscriptionPlanForIds(mainId, secondId);
}
