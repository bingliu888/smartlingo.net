/**
 * Small, side-effect-free sanitizers shared by the language-class APIs.
 *
 * Class eligibility and money rules deliberately live elsewhere: every
 * authenticated member may create a class, while pricing and the 70/30 split
 * are server-authoritative in `smartlingo-commerce.ts`.
 */
export function cleanText(value: unknown, maximum: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maximum);
}

export function cleanMultiline(value: unknown, maximum: number) {
  return String(value ?? "").trim().replace(/\r\n?/g, "\n").slice(0, maximum);
}
