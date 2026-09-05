import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { boundedJsonBody } from "../../../../lib/bounded-request-body";
import { consumeAccountRequestLimit } from "../../../../lib/account-request-limit";
import { resolveActiveClerkPrimaryEmail } from "../../../../lib/clerk-primary-identity";

export const dynamic = "force-dynamic";

function clerkIssueCode(issue:unknown) {
  return (issue as {errors?:Array<{code?:string}>})?.errors?.[0]?.code || "";
}

export async function POST(request: Request) {
  const networkLimited = await consumeAccountRequestLimit({
    request, scope:"account-password-network", limit:12, windowSeconds:60,
  });
  if (networkLimited) return networkLimited;
  const session = await auth();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  }
  const memberLimited = await consumeAccountRequestLimit({
    request, scope:"account-password-member", limit:6, windowSeconds:60,
    userId:session.userId,
  });
  if (memberLimited) return memberLimited;

  let input:{currentPassword?:string;password?:string}|null;
  try { input = await boundedJsonBody<{currentPassword?:string;password?:string}>(request,16*1024); }
  catch (error) {
    return error instanceof Response ? error : NextResponse.json({error:"Invalid request"},{status:400});
  }
  const password = input?.password || "";
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(session.userId);
    if (!resolveActiveClerkPrimaryEmail(user)) {
      return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
    }
    if (user.passwordEnabled) {
      if (!input?.currentPassword)
        return NextResponse.json({code:"CURRENT_PASSWORD_REQUIRED",error:"Enter your current password"},{status:400});
      try {
        await clerk.users.verifyPassword({userId:session.userId,password:input.currentPassword});
      } catch (issue) {
        if (clerkIssueCode(issue) === "form_password_incorrect")
          return NextResponse.json({code:"CURRENT_PASSWORD_INCORRECT",error:"Your current password is incorrect"},{status:400});
        return NextResponse.json({code:"PASSWORD_SAVE_UNAVAILABLE",error:"Password verification is temporarily unavailable"},{
          status:503,headers:{"retry-after":"30","cache-control":"no-store"},
        });
      }
    }
    await clerk.users.updateUser(session.userId, { password, signOutOfOtherSessions: false });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({
      code:"PASSWORD_SAVE_UNAVAILABLE",
      error:"Password could not be saved. Try again.",
    },{status:503,headers:{"retry-after":"30","cache-control":"no-store"}});
  }
}
