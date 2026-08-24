export type CollegeSupervisorTier = "basic" | "premium" | "supreme";

export const COLLEGE_SUPERVISOR_PLANS = {
  basic: { tier: "basic", priceCents: 99_900, maxDepartments: 3, nameEn: "Gold Supervisor", nameZh: "黄金总监" },
  premium: { tier: "premium", priceCents: 299_900, maxDepartments: 9, nameEn: "Platinum Supervisor", nameZh: "白金总监" },
  supreme: { tier: "supreme", priceCents: 499_900, maxDepartments: 15, nameEn: "Diamond Supervisor", nameZh: "钻石总监" },
} as const satisfies Record<CollegeSupervisorTier, {
  tier: CollegeSupervisorTier; priceCents: number; maxDepartments: number; nameEn: string; nameZh: string;
}>;

export function collegeSupervisorPlan(value: unknown) {
  return typeof value === "string" && value in COLLEGE_SUPERVISOR_PLANS
    ? COLLEGE_SUPERVISOR_PLANS[value as CollegeSupervisorTier]
    : null;
}

