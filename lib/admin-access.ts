import { BOOTSTRAP_ADMIN_EMAIL, getSessionUser, type SessionUser } from "./auth";

export function isAdmin(user: SessionUser | null): user is SessionUser & { role: "admin" } {
  return user?.role === "admin" && (!isBootstrapAdminEmail(user.email) || user.emailVerified === 1);
}

export function isBootstrapAdminEmail(email: string) {
  return email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
}

export function isPermanentAdmin(user: SessionUser | null): user is SessionUser & { role: "admin" } {
  return Boolean(user && user.emailVerified === 1 && isBootstrapAdminEmail(user.email));
}

export async function isAdminUser(user: SessionUser | null) {
  return Boolean(user && (isAdmin(user) || isPermanentAdmin(user)));
}

export async function getAdminUser(request?: Request) {
  const user = await getSessionUser(request);
  return isPermanentAdmin(user) ? user : null;
}
