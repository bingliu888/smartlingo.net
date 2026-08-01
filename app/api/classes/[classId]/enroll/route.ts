import { getSessionUser } from "../../../../../lib/auth";

/**
 * Retires the migrated license/referral record-only enrollment endpoint. The
 * replacement will enroll only after a verified free invitation or Stripe
 * Connect class-order webhook; this route must not manufacture access.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({
    enrolled: false,
    charged: false,
    error: "Legacy class enrollment is retired pending the verified SmartLingo invitation and checkout flow.",
    code: "SMARTLINGO_LEGACY_ENROLLMENT_RETIRED",
  }, { status: 410 });
}
