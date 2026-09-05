import { isBootstrapAdminEmail, isPermanentAdmin } from "../../../../../lib/admin-access";
import { consumeAccountRequestLimit } from "../../../../../lib/account-request-limit";
import { getDatabase, getSessionUser } from "../../../../../lib/auth";
import { boundedJsonBody } from "../../../../../lib/bounded-request-body";
import { confirmVerifiedClerkGrantTarget } from "../../../../../lib/clerk-grant-target";

type Target = {
  id: string;
  email: string;
  role: "member" | "admin";
  emailVerified: number;
  identityCheckedAt: number;
  clerkUserId: string | null;
};
type RoleAction = "grant-admin" | "revoke-admin" | "grant-subscriber" | "revoke-subscriber";

async function context(request: Request, memberId: string) {
  const admin = await getSessionUser(request);
  if (!admin) return { response: Response.json({ error: "Authentication required" }, { status: 401 }) };
  if (!isPermanentAdmin(admin)) return { response: Response.json({ error: "Administrator access required" }, { status: 403 }) };
  const target = await getDatabase().prepare(`SELECT id,email,role,
      email_verified AS emailVerified,
      clerk_identity_checked_at AS identityCheckedAt,
      clerk_user_id AS clerkUserId
    FROM users WHERE id=? LIMIT 1`)
    .bind(memberId)
    .first<Target>();
  if (!target) return { response: Response.json({ error: "Member not found" }, { status: 404 }) };
  return { admin, target };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const value = await context(request, memberId);
  if ("response" in value) return value.response;
  const limited = await consumeAccountRequestLimit({
    request,
    scope: "admin.members",
    limit: 60,
    windowSeconds: 60 * 60,
    userId: value.admin.id,
  });
  if (limited) return limited;
  let body: { action?: RoleAction };
  try {
    body = await boundedJsonBody<{ action?: RoleAction }>(request, 4 * 1024);
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const action = body.action;
  if (!action || !["grant-admin", "revoke-admin", "grant-subscriber", "revoke-subscriber"].includes(action)) {
    return Response.json({ error: "Choose a specific role action" }, { status: 400 });
  }
  if (action === "revoke-admin" && (isBootstrapAdminEmail(value.target.email) || value.target.id === value.admin.id)) {
    return Response.json({ error: "This administrator role is protected" }, { status: 409 });
  }
  const now = Math.floor(Date.now() / 1000);
  if ((action === "grant-admin" || action === "grant-subscriber") && (
    value.target.emailVerified !== 1
      || value.target.identityCheckedAt <= now - 5 * 60
      || value.target.clerkUserId !== value.target.id
  )) {
    return Response.json({ error: "Verified existing member not found" }, { status: 409 });
  }
  if (
    (action === "grant-admin" || action === "grant-subscriber")
      && !await confirmVerifiedClerkGrantTarget(value.target)
  ) {
    return Response.json({ error: "Verified existing member not found" }, { status: 409 });
  }

  const db = getDatabase();
  const statements = [];
  if (action === "grant-admin" || action === "revoke-admin") {
    statements.push(db.prepare("UPDATE users SET role=? WHERE id=?").bind(action === "grant-admin" ? "admin" : "member", value.target.id));
  } else if (action === "grant-subscriber" || action === "revoke-subscriber") {
    statements.push(db.prepare(`INSERT INTO platform_member_access
      (user_id,status,subscriber_override,updated_by_user_id,created_at,updated_at)
      VALUES(?,'active',?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET status='active',subscriber_override=excluded.subscriber_override,
      updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`)
      .bind(value.target.id, action === "grant-subscriber" ? 1 : -1, value.admin.id, now, now));
  }
  statements.push(db.prepare("INSERT INTO platform_admin_audit(id,admin_user_id,target_user_id,action,created_at) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(), value.admin.id, value.target.id, `role.${action}`, now));
  await db.batch(statements);
  return Response.json({ ok: true, action });
}
