type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
};

export type RebindDatabase = {
  prepare: (query: string) => Statement;
};

const PERMANENT_ADMIN_EMAIL = "bingliu@cybeye.com";

export function canRebindPreviousPermanentAdmin(input: {
  emailVerified: number | boolean;
  identityCheckedAt: number;
  previousClerkUserId: string | null;
}) {
  return Boolean(
    input.emailVerified
      && input.identityCheckedAt > 0
      && input.previousClerkUserId,
  );
}

export async function rekeyLinkedClerkUser(input: {
  database: RebindDatabase;
  clerkUserId: string;
  email: string;
  emailVerified: boolean;
  identityCheckedAt: number;
}) {
  const { database, clerkUserId, email, emailVerified, identityCheckedAt } = input;
  const linked = await database.prepare(
    "SELECT id FROM users WHERE clerk_user_id=? LIMIT 1",
  ).bind(clerkUserId).first<{ id: string }>();
  if (!linked) return false;
  if (linked.id === clerkUserId) return true;
  const collision = await database.prepare(
    "SELECT id FROM users WHERE (id=? OR lower(email)=lower(?)) AND id<>? LIMIT 1",
  ).bind(clerkUserId, email, linked.id).first<{ id: string }>();
  if (collision) return false;
  const rebound = await database.prepare(`UPDATE users SET
      id=?,email=?,email_verified=?,clerk_identity_checked_at=?
    WHERE id=? AND clerk_user_id=? RETURNING id`)
    .bind(
      clerkUserId,
      email.trim().toLowerCase(),
      emailVerified ? 1 : 0,
      identityCheckedAt,
      linked.id,
      clerkUserId,
    )
    .first<{ id: string }>();
  return rebound?.id === clerkUserId;
}

export async function bindVerifiedLegacyClerkUser(input: {
  database: RebindDatabase;
  clerkUserId: string;
  email: string;
  identityCheckedAt: number;
  emailVerified: boolean;
}) {
  const { database, clerkUserId, email, identityCheckedAt, emailVerified } = input;
  if (!emailVerified || identityCheckedAt <= 0) return false;
  const owner = await database.prepare(`SELECT COUNT(*) AS ownerCount,
      MIN(id) AS previousId,MAX(clerk_user_id) AS previousClerkUserId,
      EXISTS(SELECT 1 FROM users WHERE id=?) AS currentIdExists
    FROM users WHERE lower(email)=lower(?)`)
    .bind(clerkUserId, email)
    .first<{
      ownerCount: number;
      previousId: string | null;
      previousClerkUserId: string | null;
      currentIdExists: number;
    }>();
  if (
    !owner
      || Number(owner.ownerCount) !== 1
      || !owner.previousId
      || owner.previousClerkUserId
      || (owner.currentIdExists && owner.previousId !== clerkUserId)
  ) return false;
  const rebound = await database.prepare(`UPDATE users SET
      id=?,clerk_user_id=?,email=?,email_verified=1,
      clerk_identity_checked_at=?
    WHERE id=? AND lower(email)=lower(?) AND clerk_user_id IS NULL
    RETURNING id`)
    .bind(
      clerkUserId,
      clerkUserId,
      email.trim().toLowerCase(),
      identityCheckedAt,
      owner.previousId,
      email,
    )
    .first<{ id: string }>();
  return rebound?.id === clerkUserId;
}

export async function rebindPermanentAdminClerkId(input: {
  database: RebindDatabase;
  clerkUserId: string;
  email: string;
  identityCheckedAt: number;
  clerkOwnershipConfirmed: boolean;
}) {
  const {
    database,
    clerkUserId,
    email,
    identityCheckedAt,
    clerkOwnershipConfirmed,
  } = input;
  if (
    !clerkOwnershipConfirmed
      || email.trim().toLowerCase() !== PERMANENT_ADMIN_EMAIL
      || identityCheckedAt <= 0
  ) return false;
  const owner = await database.prepare(`SELECT COUNT(*) AS ownerCount,
      MIN(id) AS previousId,MAX(email_verified) AS emailVerified,
      MAX(clerk_identity_checked_at) AS identityCheckedAt,
      MAX(clerk_user_id) AS previousClerkUserId,
      EXISTS(SELECT 1 FROM users WHERE id=?) AS currentIdExists
    FROM users WHERE lower(email)=lower(?)`)
    .bind(clerkUserId, email)
    .first<{
      ownerCount: number;
      previousId: string | null;
      emailVerified: number;
      identityCheckedAt: number;
      previousClerkUserId: string | null;
      currentIdExists: number;
    }>();
  if (!owner || Number(owner.ownerCount) !== 1 || !owner.previousId) return false;
  if (owner.previousId === clerkUserId) return true;
  if (owner.currentIdExists || !canRebindPreviousPermanentAdmin(owner)) return false;

  const rebound = await database.prepare(`UPDATE users SET
      id=?,clerk_user_id=?,email=?,email_verified=1,
      clerk_identity_checked_at=?,role='admin'
    WHERE id=? AND lower(email)=lower(?) AND email_verified=1
      AND clerk_identity_checked_at>0 AND clerk_user_id IS NOT NULL
    RETURNING id`)
    .bind(
      clerkUserId,
      clerkUserId,
      email.trim().toLowerCase(),
      identityCheckedAt,
      owner.previousId,
      email,
    )
    .first<{ id: string }>();
  return rebound?.id === clerkUserId;
}
