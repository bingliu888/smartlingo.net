import { getDatabase, type SessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-access";

export async function canAddClassAudioNote(user: SessionUser) {
  if (await isAdminUser(user)) return true;
  const now = Math.floor(Date.now() / 1000);
  return Boolean(await getDatabase().prepare(`SELECT 1 FROM subscriptions
    WHERE user_id=? AND cadence='max' AND status='active'
      AND current_period_ends_at>? LIMIT 1`)
    .bind(user.id, now + 7 * 86400).first());
}
