export type StripeCommerceEnvironment = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

export async function stripeCommerceEnvironment() {
  const { env } = await import("cloudflare:workers");
  return env as typeof env & StripeCommerceEnvironment;
}

export async function stripeCommerceConfigured(input?: StripeCommerceEnvironment) {
  const env = input ?? await stripeCommerceEnvironment();
  return Boolean(env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_WEBHOOK_SECRET?.trim());
}
