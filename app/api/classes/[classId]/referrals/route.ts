import { getSessionUser } from "../../../../../lib/auth";

/**
 * The previous referral URL mixed invitations with reward points. It is
 * disabled until the replacement invitation-only flow is complete.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({
    created: false,
    rewardPoints: 0,
    error: "Legacy course referral URLs are retired. Course invitations will not create introducer rewards.",
    code: "SMARTLINGO_CLASS_REFERRAL_RETIRED",
  }, { status: 410 });
}
