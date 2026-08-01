export const FIRST_CLASS_PAYMENT_DISCOUNT_BPS = 1_500;
export const CLASS_OWNER_SHARE_BPS = 7_000;
export const PLATFORM_SHARE_BPS = 3_000;
export const BASIS_POINTS = 10_000;

export type ClassOrderQuote = {
  subtotalCents: number;
  firstClassPayment: boolean;
  discountBasisPoints: 0 | typeof FIRST_CLASS_PAYMENT_DISCOUNT_BPS;
  discountCents: number;
  discountedPreTaxCents: number;
  ownerShareCents: number;
  platformFeeCents: number;
};

function wholeCents(value: unknown, field: string) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`${field} must be a non-negative integer number of cents.`);
  }
  return cents;
}

/**
 * Quotes a member-created class payment in integer cents.
 *
 * The 15% promotion is determined only by whether this learner already has a
 * successfully paid order for this exact class. The 70/30 split is then
 * applied to the discounted, pre-tax amount. Any indivisible remainder cent
 * stays with the platform so both shares always add up exactly.
 */
export function quoteClassOrder(input: {
  subtotalCents: number;
  hasPriorPaidOrderForLearnerAndClass: boolean;
}): ClassOrderQuote {
  const subtotalCents = wholeCents(input.subtotalCents, "subtotalCents");
  const firstClassPayment = !input.hasPriorPaidOrderForLearnerAndClass;
  const discountBasisPoints = firstClassPayment ? FIRST_CLASS_PAYMENT_DISCOUNT_BPS : 0;
  const discountCents = Math.floor(subtotalCents * discountBasisPoints / BASIS_POINTS);
  const discountedPreTaxCents = subtotalCents - discountCents;
  const ownerShareCents = Math.floor(discountedPreTaxCents * CLASS_OWNER_SHARE_BPS / BASIS_POINTS);
  const platformFeeCents = discountedPreTaxCents - ownerShareCents;

  return {
    subtotalCents,
    firstClassPayment,
    discountBasisPoints,
    discountCents,
    discountedPreTaxCents,
    ownerShareCents,
    platformFeeCents,
  };
}

export type RewardablePayment = {
  source: "platform_subscription" | "member_class";
  eventType: string;
  status: string;
  amountCents: number;
  subscriberUserId: string;
  introducerUserId: string | null | undefined;
};

/**
 * Introducer points are deliberately isolated from class commerce. A reward
 * may be created only after the platform subscription invoice-paid webhook is
 * the source of truth. Class checkout/payment events always return false.
 */
export function canCreateIntroducerReward(payment: RewardablePayment) {
  if (payment.source !== "platform_subscription") return false;
  if (payment.eventType !== "invoice.paid" || payment.status !== "paid") return false;
  if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) return false;
  if (!payment.introducerUserId || payment.introducerUserId === payment.subscriberUserId) return false;
  return true;
}

export function connectedAccountCanReceiveClassPayments(account: {
  onboardingStatus: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}) {
  return account.onboardingStatus === "ready"
    && account.chargesEnabled === true
    && account.payoutsEnabled === true;
}
