export const SMARTLINGO_PLATFORM_PRODUCTS = [
  { id: "max_6m", kind: "max", months: 6, credits: 0, usdCents: 11_900, displayPrice: "$119" },
  { id: "max_12m", kind: "max", months: 12, credits: 0, usdCents: 19_900, displayPrice: "$199" },
  { id: "aigc_1000", kind: "aigc", months: 0, credits: 1_000, usdCents: 1_000, displayPrice: "$10" },
] as const;

export const SMARTLINGO_AIGC_CREDIT_COSTS = { image: 20, audio: 10, video: 200 } as const;

export type SmartLingoPlatformProductId = typeof SMARTLINGO_PLATFORM_PRODUCTS[number]["id"];
export type SmartLingoPlatformProduct = typeof SMARTLINGO_PLATFORM_PRODUCTS[number];

export function platformProduct(value: unknown): SmartLingoPlatformProduct | null {
  return SMARTLINGO_PLATFORM_PRODUCTS.find(item => item.id === value) || null;
}

export function platformProductMainId(product: SmartLingoPlatformProductId) {
  return `smartlingo_platform_${product}`;
}

export function platformProductForIds(mainId: string, secondId: string) {
  if (secondId !== "platform") return null;
  return SMARTLINGO_PLATFORM_PRODUCTS.find(item => platformProductMainId(item.id) === mainId) || null;
}

export function platformProductTerm(product: SmartLingoPlatformProduct, zh = false) {
  if (product.kind === "aigc") return zh ? "1,000 个人工智能生成额度" : "1,000 AIGC credits";
  return zh ? `Max · ${product.months} 个月` : `Max · ${product.months} months`;
}
