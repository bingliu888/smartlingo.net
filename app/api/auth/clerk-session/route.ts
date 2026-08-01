import { createClerkClient, verifyToken } from "@clerk/backend";
import { clearReferralCookie, createSessionForClerkUser, referralCodeFromRequest } from "../../../../lib/auth";

const PRODUCTION_AUTHORIZED_PARTIES = [
  "https://smartlingo.net",
  "https://www.smartlingo.net",
];

function authorizedParties(request: Request, publishableKey: string) {
  const requestUrl = new URL(request.url);
  const safeLocalHost = requestUrl.hostname === "localhost"
    || requestUrl.hostname === "127.0.0.1"
    || requestUrl.hostname === "[::1]";
  const safeLocalProtocol = requestUrl.protocol === "http:" || requestUrl.protocol === "https:";
  const allowDevelopmentOrigin = publishableKey.startsWith("pk_test_")
    && safeLocalHost
    && safeLocalProtocol;
  return allowDevelopmentOrigin
    ? [...PRODUCTION_AUTHORIZED_PARTIES, requestUrl.origin]
    : PRODUCTION_AUTHORIZED_PARTIES;
}

async function readLanguage(request: Request): Promise<"en" | "zh" | null> {
  try {
    const payload = await request.json() as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const entries = Object.entries(payload);
    if (entries.length !== 1 || entries[0][0] !== "language") return null;
    return entries[0][1] === "en" || entries[0][1] === "zh" ? entries[0][1] : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as Record<string, string | undefined>;
  const secretKey = runtime.CLERK_SECRET_KEY;
  const publishableKey = runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const jwtKey = runtime.CLERK_JWT_KEY;
  if (!token || !secretKey || !publishableKey) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const language = await readLanguage(request);
  if (!language) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    // Prefer networkless JWT verification when a public key is configured.
    // Clerk also supports verification through the production secret key, so
    // first deployment does not need a separate JWT public-key setting.
    const parties = authorizedParties(request, publishableKey);
    const claims = await verifyToken(
      token,
      jwtKey
        ? { jwtKey, authorizedParties: parties }
        : { secretKey, authorizedParties: parties },
    );
    const userId = claims.sub;
    const clerkSessionId = claims.sid;
    if (!userId || !clerkSessionId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const clerkUser = await createClerkClient({ secretKey, publishableKey }).users.getUser(userId);
    if (clerkUser.banned || clerkUser.locked) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const primaryEmail = clerkUser.primaryEmailAddress;
    const email = primaryEmail?.verification?.status === "verified"
      ? primaryEmail.emailAddress.trim().toLowerCase()
      : "";
    if (!email) return Response.json({ error: "Verified email required" }, { status: 400 });
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ")
      || clerkUser.username
      || email.split("@")[0]
      || "SmartLingo";
    const session = await createSessionForClerkUser(
      userId,
      email,
      name,
      language,
      clerkSessionId,
      referralCodeFromRequest(request),
    );
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", session.cookie);
    response.headers.append("Set-Cookie", clearReferralCookie());
    return response;
  } catch (error) {
    const code =
      typeof error === "object" && error && "reason" in error && typeof error.reason === "string"
        ? error.reason
        : error instanceof Error
          ? error.name
          : "UnknownError";
    console.error("Clerk session bridge failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown session bridge error",
    });
    return Response.json({ error: "Unauthorized", code }, { status: 401 });
  }
}
