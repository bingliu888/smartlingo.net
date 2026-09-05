import { headers } from "next/headers";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
};

type Database = {
  prepare: (query: string) => Statement;
};

type LayoutFixtureEnvironment = {
  SMARTLINGO_RUNTIME_LAYOUT_FIXTURE_TOKEN?: string;
};

function fixtureToken() {
  const environment = (globalThis as typeof globalThis & {
    __CLASS_RUNTIME_ENV__?: LayoutFixtureEnvironment;
  }).__CLASS_RUNTIME_ENV__;
  const token = environment?.SMARTLINGO_RUNTIME_LAYOUT_FIXTURE_TOKEN?.trim() ?? "";
  return /^[A-Za-z0-9_-]{32,128}$/.test(token) ? token : null;
}

function cookieValue(header: string, name: string) {
  const found = header.split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

function sameSecret(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sha256Base64(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Authenticate the isolated release-layout fixture without restoring the
 * retired compatibility-cookie path in production. The per-run random token
 * is present only in the temporary Wrangler config, and both the request host
 * and current request context must be loopback before D1 is consulted.
 */
export async function getLoopbackLayoutFixtureUser<T>(input: {
  database: () => Database;
  request?: Request;
  selection: string;
}) {
  const expectedToken = fixtureToken();
  if (!expectedToken) return null;

  let incoming: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    incoming = await headers();
  } catch {
    // Route handlers can still supply their actual Request below.
  }
  const requestURL = input.request ? new URL(input.request.url) : null;
  const host = (incoming?.get("host") ?? requestURL?.host ?? "").toLowerCase();
  const hostname = host.split(":", 1)[0];
  if (hostname !== "127.0.0.1" && hostname !== "localhost") return null;

  const cookieHeader = input.request?.headers.get("cookie") ?? incoming?.get("cookie") ?? "";
  const suppliedToken = cookieValue(cookieHeader, "smartlingo_session");
  if (!suppliedToken || !sameSecret(suppliedToken, expectedToken)) return null;

  const sessionId = await sha256Base64(suppliedToken);
  const now = Math.floor(Date.now() / 1000);
  return input.database().prepare(`${input.selection} FROM sessions s
    JOIN users u ON u.id=s.user_id
    LEFT JOIN platform_member_access access ON access.user_id=u.id
    WHERE s.id=? AND s.expires_at>?
      AND u.id=u.clerk_user_id AND u.email_verified=1
      AND u.clerk_identity_checked_at>0
      AND COALESCE(access.status,'active')='active' LIMIT 1`)
    .bind(sessionId, now)
    .first<T>();
}
