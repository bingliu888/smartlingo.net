export type CollegeAccessType = "public" | "trial" | "private";

export function normalizeCollegePricing(input: { accessType?: unknown; tuition?: unknown; trialDays?: unknown }) {
  const accessType: CollegeAccessType = input.accessType === "trial" ? "trial" : input.accessType === "private" ? "private" : "public";
  let tuitionCents = Math.max(0, Math.min(10_000_000, Math.round(Number(input.tuition || 0) * 100)));
  let trialDays = Math.max(0, Math.min(365, Math.round(Number(input.trialDays ?? 7))));
  if (accessType === "public") tuitionCents = 0;
  if (accessType === "trial" && (tuitionCents < 100 || trialDays < 1)) throw new Error("INVALID_COLLEGE_PRICE");
  if (accessType === "private") trialDays = 0;
  if (tuitionCents > 0 && tuitionCents < 100) throw new Error("INVALID_COLLEGE_PRICE");
  return { accessType, tuitionCents, trialDays };
}
