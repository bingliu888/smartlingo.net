import { platformProduct, platformProductForIds, platformProductMainId, type SmartLingoPlatformProductId } from "./platform-commerce";

export type SmartPayPlan = SmartLingoPlatformProductId;

export function smartPayIdsForPlan(plan: SmartPayPlan) {
  const product = platformProduct(plan);
  if (!product) throw new Error("INVALID_SMARTLINGO_PLATFORM_PRODUCT");
  return { mainId: platformProductMainId(product.id), secondId: "platform" } as const;
}

export function smartPayRuleIdsForPlan(plan: SmartPayPlan) {
  const product = platformProduct(plan);
  if (!product) throw new Error("INVALID_SMARTLINGO_PLATFORM_PRODUCT");
  return { mainId: platformProductMainId(product.id), secondId: "" } as const;
}

export function smartPayPlanForIds(mainId: string, secondId: string): SmartPayPlan | null {
  return platformProductForIds(mainId, secondId)?.id || null;
}
