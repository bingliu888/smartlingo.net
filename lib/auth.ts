import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "smartlingo_session";
const REFERRAL_COOKIE_NAME = "smartlingo_referral_code";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
const REFERRAL_SECONDS = 60 * 60 * 24 * 30;
const HASH_ITERATIONS = 210_000;

type D1Result<T> = { results?: T[]; success: boolean };
type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
  run: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
};
type Database = {
  prepare: (query: string) => Statement;
  batch: <T = Record<string, unknown>>(statements: Statement[]) => Promise<D1Result<T>[]>;
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  preferredLanguage: "en" | "zh";
  aiProviderPreference: "auto" | "openai" | "deepseek";
  role: "member" | "admin";
  emailVerified: number;
};

export const BOOTSTRAP_ADMIN_EMAIL = "bingliu@cybeye.com";

function db(): Database {
  const binding = (globalThis as unknown as { __SMARTLINGO_DB__?: Database }).__SMARTLINGO_DB__;
  if (!binding) throw new Error("D1 binding DB is unavailable");
  return binding;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: HASH_ITERATIONS },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return `pbkdf2-sha256$${HASH_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterations, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "pbkdf2-sha256" || Number(iterations) !== HASH_ITERATIONS || !saltValue || !hashValue) {
    return false;
  }
  const actual = await derivePassword(password, base64ToBytes(saltValue));
  const expected = base64ToBytes(hashValue);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

function randomToken(bytes = 32) {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function createSession(userId: string, clerkSessionId: string) {
  const token = randomToken();
  const id = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  // A bridge retry replaces the previous app session for the same Clerk
  // session instead of leaving parallel long-lived cookies behind.
  await db().prepare("DELETE FROM sessions WHERE clerk_session_id = ? OR expires_at <= ?")
    .bind(clerkSessionId, now)
    .run();
  await db().prepare(
    "INSERT INTO sessions (id, user_id, clerk_session_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, userId, clerkSessionId, now + SESSION_SECONDS, now).run();
  return {
    token,
    cookie: `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`,
  };
}

type ClerkIdentityRow = {
  id: string;
  email: string;
  clerkUserId: string | null;
  emailVerified: number;
};

function normalizedLanguage(language: string | null | undefined): "en" | "zh" {
  return language === "en" ? "en" : "zh";
}

async function applyBootstrapAdmin(userId: string, email: string, emailVerified: boolean) {
  if (email === BOOTSTRAP_ADMIN_EMAIL) {
    await db().prepare("UPDATE users SET role = ? WHERE id = ? AND role <> ?")
      .bind(emailVerified ? "admin" : "member", userId, emailVerified ? "admin" : "member")
      .run();
  }
  return { id: userId };
}

async function ensureClerkUser(
  clerkUserId: string,
  email: string,
  emailVerified: boolean,
  name: string,
  language: string | null | undefined,
) {
  const normalizedEmail = email.trim().toLowerCase();
  let user = await db().prepare(
    "SELECT id, email, clerk_user_id AS clerkUserId, email_verified AS emailVerified FROM users WHERE clerk_user_id = ? AND NOT EXISTS (SELECT 1 FROM platform_member_access a WHERE a.user_id = users.id AND a.status = 'removed') LIMIT 1",
  ).bind(clerkUserId).first<ClerkIdentityRow>();

  if (user) {
    if (user.email !== normalizedEmail) {
      const emailOwner = await db().prepare(
        "SELECT id, email, clerk_user_id AS clerkUserId, email_verified AS emailVerified FROM users WHERE email = ? LIMIT 1",
      ).bind(normalizedEmail).first<ClerkIdentityRow>();
      if (emailOwner && emailOwner.id !== user.id) {
        throw new Error("Verified email is already linked to another app account");
      }
      await db().prepare("UPDATE users SET email = ?, email_verified = ? WHERE id = ? AND clerk_user_id = ?")
        .bind(normalizedEmail, emailVerified ? 1 : 0, user.id, clerkUserId)
        .run();
    } else if (user.emailVerified !== (emailVerified ? 1 : 0)) {
      await db().prepare("UPDATE users SET email_verified = ? WHERE id = ? AND clerk_user_id = ?")
        .bind(emailVerified ? 1 : 0, user.id, clerkUserId)
        .run();
    }
    return applyBootstrapAdmin(user.id, normalizedEmail, emailVerified);
  }

  const emailUser = emailVerified ? await db().prepare(
    "SELECT id, email, clerk_user_id AS clerkUserId, email_verified AS emailVerified FROM users WHERE email = ? LIMIT 1",
  ).bind(normalizedEmail).first<ClerkIdentityRow>() : null;
  if (emailUser) {
    if (emailUser.clerkUserId && emailUser.clerkUserId !== clerkUserId) {
      throw new Error("Verified email is already linked to another Clerk user");
    }
    await db().prepare(
      "UPDATE users SET clerk_user_id = ? WHERE id = ? AND (clerk_user_id IS NULL OR clerk_user_id = ?)",
    ).bind(clerkUserId, emailUser.id, clerkUserId).run();
    user = await db().prepare(
      "SELECT id, email, clerk_user_id AS clerkUserId, email_verified AS emailVerified FROM users WHERE clerk_user_id = ? AND NOT EXISTS (SELECT 1 FROM platform_member_access a WHERE a.user_id = users.id AND a.status = 'removed') LIMIT 1",
    ).bind(clerkUserId).first<ClerkIdentityRow>();
    if (user) {
      await db().prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(user.id).run();
      return applyBootstrapAdmin(user.id, normalizedEmail, true);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const displayName = name.slice(0, 60) || "SmartLingo";
  // The bridge can retry while Safari establishes its first-party Clerk
  // cookie. Both the Clerk subject and verified email are unique, so this is
  // safe and idempotent under concurrent requests.
  await db().prepare(
    "INSERT OR IGNORE INTO users (id, email, email_verified, display_name, password_hash, preferred_language, clerk_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    clerkUserId,
    normalizedEmail,
    emailVerified ? 1 : 0,
    displayName,
    `clerk$${await sha256(crypto.randomUUID())}`,
    normalizedLanguage(language),
    clerkUserId,
    now,
  ).run();
  user = await db().prepare(
    "SELECT id, email, clerk_user_id AS clerkUserId, email_verified AS emailVerified FROM users WHERE clerk_user_id = ? AND NOT EXISTS (SELECT 1 FROM platform_member_access a WHERE a.user_id = users.id AND a.status = 'removed') LIMIT 1",
  ).bind(clerkUserId).first<ClerkIdentityRow>();
  if (!user) {
    const conflict = await db().prepare(
      "SELECT id, email, clerk_user_id AS clerkUserId, email_verified AS emailVerified FROM users WHERE email = ? LIMIT 1",
    ).bind(normalizedEmail).first<ClerkIdentityRow>();
    if (conflict?.clerkUserId && conflict.clerkUserId !== clerkUserId) {
      throw new Error("Email is already linked to another Clerk user");
    }
  }
  if (!user) throw new Error("Unable to create or load Clerk user");
  return applyBootstrapAdmin(user.id, normalizedEmail, emailVerified);
}

export async function createSessionForClerkUser(
  clerkUserId: string,
  email: string,
  emailVerified: boolean,
  name: string,
  language: string | null | undefined,
  clerkSessionId: string,
  referralCode?: string | null,
) {
  const user = await ensureClerkUser(clerkUserId, email, emailVerified, name, language);
  if (referralCode) await claimPlatformReferral(user.id, referralCode);
  return createSession(user.id, clerkSessionId);
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function clearReferralCookie() {
  return `${REFERRAL_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function setReferralCookie(code: string) {
  const normalized = code.trim().toUpperCase();
  return `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(normalized)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${REFERRAL_SECONDS}`;
}

export function referralCodeFromRequest(request: Request) {
  const value = cookieValue(request, REFERRAL_COOKIE_NAME);
  return value ? decodeURIComponent(value).trim().toUpperCase().slice(0, 32) : null;
}

async function claimPlatformReferral(referredUserId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{6,32}$/.test(normalized)) return;
  const owner = await db().prepare(
    "SELECT id, user_id AS userId FROM referral_codes WHERE code = ? LIMIT 1",
  ).bind(normalized).first<{ id: string; userId: string }>();
  if (!owner || owner.userId === referredUserId) return;
  const now = Math.floor(Date.now() / 1000);
  await db().prepare(
    "INSERT OR IGNORE INTO referrals (id, referral_code_id, referred_user_id, status, discount_percent, created_at, updated_at) VALUES (?, ?, ?, 'attributed', 0, ?, ?)",
  ).bind(createId(), owner.id, referredUserId, now, now).run();
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const found = header.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

export async function getSessionUser(request?: Request): Promise<SessionUser | null> {
  const token = request ? cookieValue(request, COOKIE_NAME) : (await cookies()).get(COOKIE_NAME)?.value ?? null;
  let user: SessionUser | null = null;
  if (token) {
    try {
      const now = Math.floor(Date.now() / 1000);
      user = await db().prepare(
        "SELECT u.id, u.email, u.email_verified AS emailVerified, u.display_name AS displayName, u.preferred_language AS preferredLanguage, u.ai_provider_preference AS aiProviderPreference, u.role FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN platform_member_access a ON a.user_id = u.id WHERE s.id = ? AND COALESCE(a.status, 'active') = 'active' AND s.clerk_session_id IS NOT NULL AND s.expires_at > ? LIMIT 1",
      ).bind(await sha256(token), now).first<SessionUser>();
    } catch {
      // A stale legacy session cookie must not turn a public page into an error page.
    }
  }
  if (!user) {
    let clerkUser: Awaited<ReturnType<typeof currentUser>> = null;
    try {
      // Local builds and degraded edge requests may not have Clerk middleware
      // context. In that case this endpoint must remain an anonymous session
      // check instead of turning the public header into a background 500.
      if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
        clerkUser = await currentUser();
      }
    } catch {
      clerkUser = null;
    }
    const primaryEmail = clerkUser?.primaryEmailAddress;
    const email = primaryEmail?.emailAddress.toLowerCase() ?? "";
    const emailVerified = primaryEmail?.verification?.status === "verified";
    if (clerkUser && email && !clerkUser.banned && !clerkUser.locked) {
      try {
        await ensureClerkUser(
          clerkUser.id,
          email,
          emailVerified,
          clerkUser.fullName || clerkUser.firstName || email.split("@")[0] || "SmartLingo",
          "zh",
        );
        user = await db().prepare(
          "SELECT id, email, email_verified AS emailVerified, display_name AS displayName, preferred_language AS preferredLanguage, ai_provider_preference AS aiProviderPreference, role FROM users WHERE clerk_user_id = ? AND NOT EXISTS (SELECT 1 FROM platform_member_access a WHERE a.user_id = users.id AND a.status = 'removed') LIMIT 1",
        ).bind(clerkUser.id).first<SessionUser>();
      } catch {
        // Identity conflicts fail closed and must be resolved by an Admin.
      }
    }
  }
  if (!user) return null;
  return user;
}

export async function deleteCurrentSession(request: Request) {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token) return;
  await db().prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
}

export function getDatabase() {
  return db();
}

export function createId() {
  return crypto.randomUUID();
}
