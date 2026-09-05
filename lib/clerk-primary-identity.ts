export type ClerkPrimaryIdentityInput = {
  banned?: boolean | null;
  locked?: boolean | null;
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{
    id: string;
    emailAddress: string;
    verification?: { status?: string | null } | null;
  }>;
};

export function resolveActiveClerkPrimaryEmail(
  user: ClerkPrimaryIdentityInput | null | undefined,
) {
  if (!user || user.banned || user.locked || !user.primaryEmailAddressId) return null;
  const primary = (user.emailAddresses ?? []).find(
    address => address.id === user.primaryEmailAddressId,
  );
  const email = primary?.emailAddress?.trim().toLowerCase();
  if (!primary || !email) return null;
  return {
    email,
    emailVerified: primary.verification?.status === "verified",
  };
}

export function isSoleVerifiedClerkEmailOwner(
  input: {
    data?: Array<ClerkPrimaryIdentityInput & { id?: string | null }>;
    totalCount?: number;
  },
  clerkUserId: string,
  email: string,
) {
  if (input.totalCount !== 1 || input.data?.length !== 1) return false;
  const only = input.data[0];
  const identity = resolveActiveClerkPrimaryEmail(only);
  return only.id === clerkUserId
    && identity?.emailVerified === true
    && identity.email === email.trim().toLowerCase();
}

export function isExactVerifiedClerkIdentity(
  user: ClerkPrimaryIdentityInput & { id?: string | null },
  clerkUserId: string,
  email: string,
) {
  const identity = resolveActiveClerkPrimaryEmail(user);
  return user.id === clerkUserId
    && identity?.emailVerified === true
    && identity.email === email.trim().toLowerCase();
}
