export const SUBSCRIPTION_LOCALES = [
  "zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi",
  "id", "bn", "ur", "pa", "ta", "te", "ne", "si", "tr",
] as const;

export type SubscriptionLocale = (typeof SUBSCRIPTION_LOCALES)[number];

const labels: Record<SubscriptionLocale, string> = {
  zh: "订阅",
  en: "Subscription",
  es: "Suscripción",
  ja: "サブスクリプション",
  ko: "구독",
  fr: "Abonnement",
  de: "Abonnement",
  ru: "Подписка",
  it: "Abbonamento",
  pt: "Assinatura",
  ar: "الاشتراك",
  hi: "सदस्यता",
  id: "Langganan",
  bn: "সাবস্ক্রিপশন",
  ur: "سبسکرپشن",
  pa: "ਗਾਹਕੀ",
  ta: "சந்தா",
  te: "సభ్యత్వం",
  ne: "सदस्यता",
  si: "දායකත්වය",
  tr: "Abonelik",
};

export function subscriptionLabelFor(locale: string): string {
  return labels[locale as SubscriptionLocale] ?? labels.en;
}
