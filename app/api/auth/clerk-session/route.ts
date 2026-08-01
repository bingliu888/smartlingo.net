import { createClerkClient, verifyToken } from "@clerk/backend";
import { clearReferralCookie, createSessionForClerkUser, referralCodeFromRequest } from "../../../../lib/auth";
import { handleClerkSessionBridgeRequest } from "../../../../lib/clerk-session-bridge";

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as Record<string, string | undefined>;

  return handleClerkSessionBridgeRequest(request, {
    runtime,
    verifyClerkToken: (token, options) => verifyToken(
      token,
      options.jwtKey
        ? { jwtKey: options.jwtKey, authorizedParties: options.authorizedParties }
        : { secretKey: options.secretKey!, authorizedParties: options.authorizedParties },
    ),
    getClerkUser: (userId, keys) => createClerkClient(keys).users.getUser(userId),
    createAppSession: createSessionForClerkUser,
    referralCodeFromRequest,
    clearReferralCookie,
    logError: details => console.error("Clerk session bridge failed", details),
  });
}
