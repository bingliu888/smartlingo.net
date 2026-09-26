import { getDatabase, type SessionUser } from "./auth";
import { isAdminUser } from "./admin-access";
export async function maxLiveTutorDailyLimit(user: SessionUser, now = Math.floor(Date.now() / 1_000)) {
  if (await isAdminUser(user)) return 15 * 60;
  const row = await getDatabase().prepare(`SELECT cadence,status,trial_ends_at AS trialEndsAt,
    current_period_ends_at AS endsAt FROM subscriptions WHERE user_id=? LIMIT 1`)
    .bind(user.id).first<{ cadence: string; status: string; trialEndsAt: number | null; endsAt: number | null }>();
  if (row?.cadence !== "max" || row.status !== "active" || Number(row.endsAt || 0) <= now) return 0;
  return Number(row.trialEndsAt || 0) > 0 && Number(row.trialEndsAt) === Number(row.endsAt)
    ? 5 * 60 : 15 * 60;
}
