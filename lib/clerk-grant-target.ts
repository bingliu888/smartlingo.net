import { clerkClient } from "@clerk/nextjs/server";
import { isExactVerifiedClerkIdentity } from "./clerk-primary-identity";

export async function confirmVerifiedClerkGrantTarget(target: {
  id: string;
  email: string;
}) {
  try {
    const user = await (await clerkClient()).users.getUser(target.id);
    return isExactVerifiedClerkIdentity(user, target.id, target.email);
  } catch {
    return false;
  }
}
