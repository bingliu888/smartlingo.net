import type { SmartLingoPackageTier } from "./smartlingo-course-packages";
export type SubscriptionPlan = { id: SmartLingoPackageTier; months: 3; price: string; amountCents: number };
export const SMARTLINGO_CRYPTO_PLANS: SubscriptionPlan[] = [
  { id: "basic", months: 3, price: "30", amountCents: 3_000 },
  { id: "intermediate", months: 3, price: "60", amountCents: 6_000 },
  { id: "advanced", months: 3, price: "120", amountCents: 12_000 },
];
