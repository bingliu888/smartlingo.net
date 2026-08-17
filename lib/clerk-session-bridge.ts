export type ClerkBridgeRuntime = {
  CLERK_SECRET_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_JWT_KEY?: string;
};

type ClerkBridgeClaims = {
  sub?: string | null;
  sid?: string | null;
};

type ClerkBridgeUser = {
  banned?: boolean;
  locked?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: {
    emailAddress: string;
    verification?: { status?: string | null } | null;
  } | null;
};

type ClerkBridgeSession = { cookie: string };

type ClerkVerificationOptions = {
  authorizedParties: string[];
  jwtKey?: string;
  secretKey?: string;
};

export type ClerkSessionBridgeDependencies = {
  runtime: ClerkBridgeRuntime;
  verifyClerkToken: (token: string, options: ClerkVerificationOptions) => Promise<ClerkBridgeClaims>;
  getClerkUser: (
    userId: string,
    keys: { secretKey: string; publishableKey: string },
  ) => Promise<ClerkBridgeUser>;
  createAppSession: (
    clerkUserId: string,
    email: string,
    name: string,
    language: "en" | "zh",
    clerkSessionId: string,
    referralCode: string | null,
  ) => Promise<ClerkBridgeSession>;
  referralCodeFromRequest: (request: Request) => string | null;
  clearReferralCookie: () => string;
  logError?: (details: { name: string; message: string }) => void;
};

const PRODUCTION_AUTHORIZED_PARTIES = [
  "https://smartlingo.net",
  "https://www.smartlingo.net",
];

export function clerkAuthorizedParties(request: Request, publishableKey: string) {
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
    : [...PRODUCTION_AUTHORIZED_PARTIES];
}

async function readBridgeLanguage(request: Request): Promise<"en" | "zh" | null> {
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

function bridgeErrorCode(error: unknown) {
  const candidate = typeof error === "object" && error && "reason" in error && typeof error.reason === "string"
    ? error.reason
    : error instanceof Error
      ? error.name
      : "UnknownError";
  return /^[A-Za-z0-9._-]{1,64}$/.test(candidate) ? candidate : "verification_failed";
}

function bridgeLogDetails(error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof Error ? error.message : "Unknown session bridge error";
  return {
    name: name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64) || "UnknownError",
    message: message.replace(/[\r\n\t]+/g, " ").slice(0, 160),
  };
}

export async function handleClerkSessionBridgeRequest(
  request: Request,
  dependencies: ClerkSessionBridgeDependencies,
) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  const secretKey = dependencies.runtime.CLERK_SECRET_KEY;
  const publishableKey = dependencies.runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const jwtKey = dependencies.runtime.CLERK_JWT_KEY;
  if (!token || !secretKey || !publishableKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const language = await readBridgeLanguage(request);
  if (!language) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const authorizedParties = clerkAuthorizedParties(request, publishableKey);
    const claims = await dependencies.verifyClerkToken(
      token,
      jwtKey
        ? { jwtKey, authorizedParties }
        : { secretKey, authorizedParties },
    );
    const userId = claims.sub;
    const clerkSessionId = claims.sid;
    if (!userId || !clerkSessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerkUser = await dependencies.getClerkUser(userId, { secretKey, publishableKey });
    if (clerkUser.banned || clerkUser.locked) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const primaryEmail = clerkUser.primaryEmailAddress;
    const email = primaryEmail?.verification?.status === "verified"
      ? primaryEmail.emailAddress.trim().toLowerCase()
      : "";
    if (!email) return Response.json({ error: "Verified email required" }, { status: 400 });

    const name = email === "bingliu@cybeye.com"
      ? "Admin"
      : [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ")
        || clerkUser.username
        || email.split("@")[0]
        || "SmartLingo";
    const session = await dependencies.createAppSession(
      userId,
      email,
      name,
      language,
      clerkSessionId,
      dependencies.referralCodeFromRequest(request),
    );
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", session.cookie);
    response.headers.append("Set-Cookie", dependencies.clearReferralCookie());
    return response;
  } catch (error) {
    dependencies.logError?.(bridgeLogDetails(error));
    return Response.json({ error: "Unauthorized", code: bridgeErrorCode(error) }, { status: 401 });
  }
}
