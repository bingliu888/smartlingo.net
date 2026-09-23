import { consumeAccountRequestLimit } from "../../../../lib/account-request-limit";
import { isPermanentAdmin } from "../../../../lib/admin-access";
import { getDatabase, getSessionUser } from "../../../../lib/auth";
import { boundedJsonBody } from "../../../../lib/bounded-request-body";
import { confirmVerifiedClerkGrantTarget } from "../../../../lib/clerk-grant-target";
import { normalizeEmailAddress } from "../../../../lib/email-address";
import { AdminMaxSubscriptionError, changeAdminMaxSubscription } from "../../../../lib/platform-entitlements";

type Body = { action?: string; email?: string; months?: number; requestId?: string };

export async function POST(request: Request) {
  const admin = await getSessionUser(request);
  if (!admin) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (!isPermanentAdmin(admin)) return Response.json({ error: "Administrator access required" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const limited = await consumeAccountRequestLimit({
    request,
    scope: "admin.members",
    limit: 60,
    windowSeconds: 60 * 60,
    userId: admin.id,
  });
  if (limited) return limited;
  let body: Body;
  try {
    body = await boundedJsonBody<Body>(request, 8 * 1024);
  } catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = normalizeEmailAddress(body.email);
  if (!email) return Response.json({ error: "Valid email required" }, { status: 400 });
  if (body.action !== "grant-admin" && body.action !== "grant-subscriber") {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const target = await db.prepare(`SELECT id,email FROM users
    WHERE lower(email)=? AND email_verified=1
      AND clerk_identity_checked_at>? AND clerk_user_id=id LIMIT 1`)
    .bind(email, now - 5 * 60)
    .first<{ id: string; email: string }>();
  if (!target) return Response.json({ error: "Verified existing member not found" }, { status: 404 });
  if (!await confirmVerifiedClerkGrantTarget(target)) {
    return Response.json({ error: "Verified existing member not found" }, { status: 409 });
  }
  if (body.action === "grant-admin") {
    await db.prepare("UPDATE users SET role='admin' WHERE id=?").bind(target.id).run();
    await db.prepare("INSERT INTO platform_admin_audit(id,admin_user_id,target_user_id,action,created_at) VALUES(?,?,?,?,?)")
      .bind(crypto.randomUUID(), admin.id, target.id, `role.${body.action}`, now).run();
    return Response.json({ ok: true, id: target.id });
  }
  try {
    const result = await changeAdminMaxSubscription({
      actor: admin, userId: target.id, action: "grant", months: body.months as 6 | 12,
      requestId: body.requestId || "", now,
    });
    return Response.json({ ok: true, id: target.id, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminMaxSubscriptionError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
