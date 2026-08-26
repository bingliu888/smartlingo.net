import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const withClerk = clerkMiddleware();

export default function proxy(request: NextRequest, event: unknown) {
  // A missing production Clerk configuration must not turn public class and
  // sign-in shells—or protected-page redirects—into blanket 503 responses.
  // Route handlers still enforce app sessions, and the Clerk bridge itself
  // fails closed until its verified server-side keys are present.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }
  return withClerk(request, event as never);
}

export const config = {
  // Match only application pages and APIs. Static files never need Clerk, and
  // explicit locale alternatives avoid the ambiguous negative-lookahead form
  // rejected by Vinext's safe matcher compiler.
  matcher: [
    "/:lang(zh|en|es|ja|ko|fr|de|ru|it|pt|ar|hi)/:path*",
    "/api/:path*",
  ],
};
