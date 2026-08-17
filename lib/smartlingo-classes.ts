/**
 * Small, side-effect-free sanitizers shared by the language-class APIs.
 *
 * Course eligibility and fixed monthly pricing are server-authoritative.
 * MVP members may subscribe to platform courses but cannot create courses.
 */
export function cleanText(value: unknown, maximum: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maximum);
}

export function cleanMultiline(value: unknown, maximum: number) {
  return String(value ?? "").trim().replace(/\r\n?/g, "\n").slice(0, maximum);
}
