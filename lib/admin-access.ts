import { BOOTSTRAP_ADMIN_EMAIL, getDatabase, getSessionUser, type SessionUser } from "./auth";

export function isAdmin(user: SessionUser | null): user is SessionUser & { role: "admin" } {
  return user?.role === "admin";
}

export function isBootstrapAdminEmail(email: string) {
  return email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
}

export async function isAdminUser(user: SessionUser | null) {
  return Boolean(user && (isAdmin(user) || isBootstrapAdminEmail(user.email)));
}

export async function getAdminUser(request?: Request) {
  const user = await getSessionUser(request);
  return user && isBootstrapAdminEmail(user.email) ? user : null;
}

export async function isTeacherUser(user: Parameters<typeof isAdminUser>[0]) {
  if (!user) return false;
  if (await isAdminUser(user)) return true;
  const database = getDatabase();
  const row = await database.prepare("SELECT subscriber_override AS subscriberOverride FROM platform_member_access WHERE user_id=? AND status='active' LIMIT 1").bind(user.id).first() as { subscriberOverride?: number } | null;
  return Number(row?.subscriberOverride || 0) === 1;
}
