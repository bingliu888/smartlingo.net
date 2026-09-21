import type { SmartPayPlan } from "./crypto-subscription";
export type SubscriptionPlan = { id: SmartPayPlan; months: number; price: string; amountCents: number };
export const SMARTLINGO_CRYPTO_PLANS: SubscriptionPlan[] = [
  { id: "basic", months: 3, price: "30", amountCents: 3_000 },
  { id: "intermediate", months: 3, price: "60", amountCents: 6_000 },
  { id: "advanced", months: 3, price: "120", amountCents: 12_000 },
  { id: "max_6m", months: 6, price: "59", amountCents: 5_900 },
  { id: "max_12m", months: 12, price: "99", amountCents: 9_900 },
  { id: "aigc_1000", months: 0, price: "10", amountCents: 1_000 },
];
