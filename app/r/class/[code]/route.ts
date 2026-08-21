/**
 * Legacy class links formerly coupled invitations to unrelated signup rewards. Keep the
 * path closed so an old URL cannot create attribution, access, or points.
 */
export async function GET() {
  return Response.json({
    active: false,
    rewardPoints: 0,
    error: "This legacy course referral link has been retired.",
    code: "SMARTLINGO_LEGACY_CLASS_LINK_RETIRED",
  }, { status: 410 });
}
