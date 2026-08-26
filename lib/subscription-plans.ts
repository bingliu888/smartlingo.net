import type { SmartLingoPackageTier } from "./smartlingo-course-packages";
export type SubscriptionPlan = { id: SmartLingoPackageTier; months: 12; price: string; amountCents: number };
export const SMARTLINGO_ANNUAL_CRYPTO_PLANS: SubscriptionPlan[] = [
  { id: "basic", months: 12, price: "240", amountCents: 24_000 },
  { id: "intermediate", months: 12, price: "1200", amountCents: 120_000 },
  { id: "advanced", months: 12, price: "3600", amountCents: 360_000 },
];
