import { getSessionUser } from "../../../../../lib/auth";

/**
 * Class referrals must never mint introducer points. Introducer rewards are
 * created only from successful platform-subscription invoice webhooks.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({
    claimed: false,
    points: 0,
    error: "Class referral rewards are retired.",
    code: "SMARTLINGO_CLASS_REWARD_FORBIDDEN",
  }, { status: 410 });
}
