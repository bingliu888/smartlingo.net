import { clerkClient, currentUser } from "@clerk/nextjs/server";
import {
  isSoleVerifiedClerkEmailOwner,
  resolveActiveClerkPrimaryEmail,
} from "@/lib/clerk-primary-identity";
import {
  bindVerifiedLegacyClerkUser,
  rebindPermanentAdminClerkId,
  rekeyLinkedClerkUser,
} from "@/lib/permanent-admin-rebind";
import { getLoopbackLayoutFixtureUser } from "@/lib/layout-fixture-auth";

const COOKIE_NAME = "smartlingo_session";
const REFERRAL_COOKIE_NAME = "smartlingo_referral_code";
const REFERRAL_SECONDS = 60 * 60 * 24 * 30;

type D1Result<T> = { results?: T[]; success: boolean; meta?: { changes?: number } };
type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<D1Result<T>>;
  run: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
};
type Database = {
  prepare: (query: string) => Statement;
  batch: <T = Record<string, unknown>>(statements: Statement[]) => Promise<D1Result<T>[]>;
};

export type SessionUser = {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string;
  preferredLanguage: "en" | "zh";
  aiProviderPreference: "auto" | "openai" | "deepseek";
  role: "member" | "admin";
  emailVerified: number;
  identityCheckedAt: number;
};

type ClerkIdentityRow = {
  id: string;
  email: string;
  clerkUserId: string | null;
  emailVerified: number;
  identityCheckedAt: number;
  role: "member" | "admin";
};

export const BOOTSTRAP_ADMIN_EMAIL = "bingliu@cybeye.com";

function db(): Database {
  const binding = (globalThis as unknown as { __SMARTLINGO_DB__?: Database }).__SMARTLINGO_DB__;
  if (!binding) throw new Error("D1 binding DB is unavailable");
  return binding;
}

function normalizedLanguage(language: string | null | undefined): "en" | "zh" {
  return language === "en" ? "en" : "zh";
}

const sessionUserSelection = `SELECT u.id,u.clerk_user_id AS clerkUserId,u.email,
  u.email_verified AS emailVerified,u.display_name AS displayName,
  u.preferred_language AS preferredLanguage,u.ai_provider_preference AS aiProviderPreference,
  u.role,u.clerk_identity_checked_at AS identityCheckedAt`;

function suggestedDisplayName(name: string, email: string, emailVerified: boolean) {
  if (emailVerified && email === BOOTSTRAP_ADMIN_EMAIL) return "Admin";
  return (
    /^bingliu\+([^@]+)@/i.exec(email)?.[1]
      || name.trim()
      || email.split("@")[0]
      || "SmartLingo"
  ).slice(0, 60);
}

async function confirmSolePermanentAdminOwner(clerkUserId: string, email: string) {
  try {
    const directory = await (await clerkClient()).users.getUserList({
      emailAddress: [email],
      limit: 2,
    });
    return isSoleVerifiedClerkEmailOwner(directory, clerkUserId, email);
  } catch {
    return false;
  }
}

async function synchronizeClerkIdentity(input: {
  clerkUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  language: string | null | undefined;
}) {
  const database = db();
  const clerkUserId = input.clerkUserId;
  const email = input.email.trim().toLowerCase();
  const identityCheckedAt = Math.floor(Date.now() / 1000);
  if (!clerkUserId || !email) return null;

  let linked = await database.prepare(`SELECT id,email,
      clerk_user_id AS clerkUserId,email_verified AS emailVerified,
      clerk_identity_checked_at AS identityCheckedAt,role
    FROM users WHERE clerk_user_id=? LIMIT 1`)
    .bind(clerkUserId)
    .first<ClerkIdentityRow>();
  const previousEmail = linked?.email.trim().toLowerCase() ?? null;

  if (linked && linked.id !== clerkUserId) {
    const rekeyed = await rekeyLinkedClerkUser({
      database,
      clerkUserId,
      email,
      emailVerified: input.emailVerified,
      identityCheckedAt,
    });
    if (!rekeyed) return null;
    linked = await database.prepare(`SELECT id,email,
        clerk_user_id AS clerkUserId,email_verified AS emailVerified,
        clerk_identity_checked_at AS identityCheckedAt,role
      FROM users WHERE id=? AND clerk_user_id=? LIMIT 1`)
      .bind(clerkUserId, clerkUserId)
      .first<ClerkIdentityRow>();
    if (!linked) return null;
  }

  const currentIdOwner = await database.prepare(`SELECT id,email,
      clerk_user_id AS clerkUserId,email_verified AS emailVerified,
      clerk_identity_checked_at AS identityCheckedAt,role
    FROM users WHERE id=? LIMIT 1`)
    .bind(clerkUserId)
    .first<ClerkIdentityRow>();
  if (currentIdOwner && currentIdOwner.clerkUserId !== clerkUserId) {
    if (
      currentIdOwner.clerkUserId !== null
        || !input.emailVerified
        || currentIdOwner.email.trim().toLowerCase() !== email
    ) return null;
    if (
      email === BOOTSTRAP_ADMIN_EMAIL
        && !await confirmSolePermanentAdminOwner(clerkUserId, email)
    ) return null;
    const bound = await bindVerifiedLegacyClerkUser({
      database,
      clerkUserId,
      email,
      emailVerified: true,
      identityCheckedAt,
    });
    if (!bound) return null;
  }

  const conflictingEmailOwner = await database.prepare(`SELECT id,email,
      clerk_user_id AS clerkUserId,email_verified AS emailVerified,
      clerk_identity_checked_at AS identityCheckedAt,role
    FROM users WHERE lower(email)=lower(?) AND id<>? LIMIT 1`)
    .bind(email, clerkUserId)
    .first<ClerkIdentityRow>();

  let reconciledPermanentAdmin = false;
  if (conflictingEmailOwner) {
    if (input.emailVerified && email === BOOTSTRAP_ADMIN_EMAIL) {
      const clerkOwnershipConfirmed = await confirmSolePermanentAdminOwner(clerkUserId, email);
      reconciledPermanentAdmin = conflictingEmailOwner.clerkUserId === null
        ? clerkOwnershipConfirmed && await bindVerifiedLegacyClerkUser({
          database,
          clerkUserId,
          email,
          emailVerified: true,
          identityCheckedAt,
        })
        : await rebindPermanentAdminClerkId({
          database,
          clerkUserId,
          email,
          identityCheckedAt,
          clerkOwnershipConfirmed,
        });
    } else if (conflictingEmailOwner.clerkUserId === null && input.emailVerified) {
      reconciledPermanentAdmin = await bindVerifiedLegacyClerkUser({
        database,
        clerkUserId,
        email,
        emailVerified: true,
        identityCheckedAt,
      });
    }
    if (!reconciledPermanentAdmin) return null;
    if (email === BOOTSTRAP_ADMIN_EMAIL) {
      await database.prepare("UPDATE users SET role='admin' WHERE id=? AND clerk_user_id=?")
        .bind(clerkUserId, clerkUserId)
        .run();
    }
  }

  if (!reconciledPermanentAdmin) {
    const now = identityCheckedAt;
    const displayName = suggestedDisplayName(input.name, email, input.emailVerified);
    try {
      await database.prepare(`INSERT INTO users
          (id,email,email_verified,display_name,password_hash,preferred_language,
           role,clerk_user_id,clerk_identity_checked_at,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          email=excluded.email,email_verified=excluded.email_verified,
          clerk_user_id=excluded.clerk_user_id,
          clerk_identity_checked_at=excluded.clerk_identity_checked_at`)
        .bind(
          clerkUserId,
          email,
          input.emailVerified ? 1 : 0,
          displayName,
          "clerk-managed",
          normalizedLanguage(input.language),
          input.emailVerified && email === BOOTSTRAP_ADMIN_EMAIL ? "admin" : "member",
          clerkUserId,
          identityCheckedAt,
          now,
        )
        .run();
    } catch {
      return null;
    }
    if (email === BOOTSTRAP_ADMIN_EMAIL) {
      await database.prepare("UPDATE users SET role=? WHERE id=?")
        .bind(input.emailVerified ? "admin" : "member", clerkUserId)
        .run();
    } else if (previousEmail === BOOTSTRAP_ADMIN_EMAIL) {
      await database.prepare("UPDATE users SET role='member' WHERE id=?")
        .bind(clerkUserId)
        .run();
    }
  }

  return database.prepare(`${sessionUserSelection} FROM users u
    LEFT JOIN platform_member_access access ON access.user_id=u.id
    WHERE u.id=? AND u.clerk_user_id=?
      AND COALESCE(access.status,'active')='active' LIMIT 1`)
    .bind(clerkUserId, clerkUserId)
    .first<SessionUser>();
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const found = header.split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

async function claimPlatformReferral(referredUserId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{6,32}$/.test(normalized)) return;
  const owner = await db().prepare(
    "SELECT id, user_id AS userId FROM referral_codes WHERE code = ? LIMIT 1",
  ).bind(normalized).first<{ id: string; userId: string }>();
  if (!owner || owner.userId === referredUserId) return;
  const now = Math.floor(Date.now() / 1000);
  await db().prepare(`INSERT OR IGNORE INTO referrals
      (id,referral_code_id,referred_user_id,status,discount_percent,created_at,updated_at)
    VALUES(?,?,?,'attributed', 0,?,?)`)
    .bind(createId(), owner.id, referredUserId, now, now)
    .run();
}

/**
 * The completion bridge performs deterministic D1 synchronization after Clerk
 * activates a first-party session. Its compatibility cookie is explicitly
 * expired; authorization on subsequent requests comes only from currentUser().
 */
export async function createSessionForClerkUser(
  clerkUserId: string,
  email: string,
  emailVerified: boolean,
  name: string,
  language: string | null | undefined,
  _clerkSessionId: string,
  referralCode?: string | null,
) {
  void _clerkSessionId;
  const user = await synchronizeClerkIdentity({
    clerkUserId,
    email,
    emailVerified,
    name,
    language,
  });
  if (!user) throw new Error("Unable to synchronize Clerk user");
  if (referralCode) await claimPlatformReferral(user.id, referralCode);
  return { cookie: clearSessionCookie() };
}

export async function getSessionUser(request?: Request): Promise<SessionUser | null> {
  const layoutFixtureUser = await getLoopbackLayoutFixtureUser<SessionUser>({
    database: db,
    request,
    selection: sessionUserSelection,
  });
  if (layoutFixtureUser) return layoutFixtureUser;
  const clerkUser = await currentUser().catch(() => null);
  const identity = resolveActiveClerkPrimaryEmail(clerkUser);
  if (!clerkUser || !identity) return null;
  return synchronizeClerkIdentity({
    clerkUserId: clerkUser.id,
    email: identity.email,
    emailVerified: identity.emailVerified,
    name: clerkUser.fullName || clerkUser.firstName || "",
    language: "zh",
  });
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

export function getDatabase() {
  return db();
}

export function createId() {
  return crypto.randomUUID();
}
