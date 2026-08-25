import { BOOTSTRAP_ADMIN_EMAIL, getSessionUser, type SessionUser } from "./auth";

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
