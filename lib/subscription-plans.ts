import type { SmartPayPlan } from "./crypto-subscription";
export type SubscriptionPlan = { id: SmartPayPlan; months: number; price: string; amountCents: number };
export const SMARTLINGO_CRYPTO_PLANS: SubscriptionPlan[] = [
  { id: "max_6m", months: 6, price: "119", amountCents: 11_900 },
  { id: "max_12m", months: 12, price: "199", amountCents: 19_900 },
  { id: "aigc_1000", months: 0, price: "10", amountCents: 1_000 },
];
